import { geminiVoiceService } from './geminiVoiceService';
import { processVoiceCommand } from './voiceCommandProcessor';
import type { CommandProcessResult } from './voiceCommandProcessor';
import { speechEngine } from './speechEngine';
import { soundEffects } from './soundEffects';
import { voiceRecognition } from './voiceRecognition';

export type LiveSessionState = 'idle' | 'listening' | 'user_speaking' | 'processing' | 'assistant_speaking' | 'error';

export interface LiveSessionCallbacks {
  onStateChange: (state: LiveSessionState) => void;
  onVolumeChange: (volume: number) => void; // 0 to 100
  onLiveTranscript?: (transcript: string, isFinal: boolean) => void;
  onResult: (result: CommandProcessResult) => void;
  onError: (errMsg: string) => void;
}

export class GeminiLiveVoiceSession {
  private state: LiveSessionState = 'idle';
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private animFrameId: number | null = null;
  private silenceTimer: any = null;
  private hasSpokenInCurrentChunk = false;
  private isRunning = false;
  private callbacks: Partial<LiveSessionCallbacks> = {};
  private unbindSpeechEnd: (() => void) | null = null;
  private unbindTranscript: (() => void) | null = null;
  private currentSpeechTranscript: string = '';
  private currentAlternatives: string[] = [];
  private currentUtteranceId: number = 0;

  constructor(callbacks: Partial<LiveSessionCallbacks> = {}) {
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: Partial<LiveSessionCallbacks>) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public getState(): LiveSessionState {
    return this.state;
  }

  private setState(newState: LiveSessionState) {
    this.state = newState;
    this.callbacks.onStateChange?.(newState);

    // Sync with global voice state for Header and Accessibility indicators
    if (newState === 'listening' || newState === 'user_speaking') {
      voiceRecognition.setState('listening');
    } else if (newState === 'assistant_speaking') {
      voiceRecognition.setState('speaking');
    } else if (newState === 'processing') {
      voiceRecognition.setState('processing');
    } else if (newState === 'error') {
      voiceRecognition.setState('error');
    } else {
      voiceRecognition.setState('idle');
    }
  }

  /**
   * Start live bidirectional AI voice session (Gemini / ChatGPT style)
   */
  public async start(): Promise<boolean> {
    if (this.isRunning) return true;

    try {
      soundEffects.playMicStart();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaStream = stream;
      this.isRunning = true;

      // Initialize Web Audio Analyser for real-time visual waveform
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      this.audioContext = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      this.analyser = analyser;

      // Start volume monitor loop
      this.startVolumeMonitoring();

      // Start recording the first speech segment
      this.startSegmentRecording();

      // Start real-time speech recognition for live streaming words & instant zero-latency NLP fallback
      this.unbindTranscript = voiceRecognition.addListener({
        onTranscript: (transcript: string, isFinal: boolean, alternatives?: string[]) => {
          if (transcript.trim()) {
            this.currentSpeechTranscript = transcript.trim();
            if (alternatives && alternatives.length > 0) {
              this.currentAlternatives = alternatives;
            }
            this.callbacks.onLiveTranscript?.(transcript.trim(), isFinal);

            // If a final recognition arrives while user spoke, commit promptly after brief settle
            if (isFinal && this.isRunning && this.hasSpokenInCurrentChunk) {
              if (this.silenceTimer) {
                clearTimeout(this.silenceTimer);
                this.silenceTimer = null;
              }
              this.silenceTimer = setTimeout(() => {
                if (this.isRunning && this.hasSpokenInCurrentChunk) {
                  this.commitCurrentUtterance();
                }
              }, 250);
            }
          }
        },
        onStateChange: () => {},
        onError: () => {},
      });
      voiceRecognition.start();

      // Listen for assistant speech completion to resume listening
      this.unbindSpeechEnd = speechEngine.onSpeechEnd(() => {
        if (this.isRunning && this.state === 'assistant_speaking') {
          setTimeout(() => {
            if (this.isRunning && !speechEngine.isSpeaking()) {
              this.currentSpeechTranscript = '';
              this.setState('listening');
              this.startSegmentRecording();
            }
          }, 750);
        }
      });

      this.setState('listening');
      return true;
    } catch (err: any) {
      console.error('Failed to start Gemini Live voice session:', err);
      this.callbacks.onError?.('Microphone access denied. Please allow microphone access in your browser.');
      this.stop();
      return false;
    }
  }

  private startSegmentRecording() {
    if (!this.mediaStream || !this.isRunning) return;

    try {
      this.audioChunks = [];
      this.hasSpokenInCurrentChunk = false;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

      const recorder = new MediaRecorder(this.mediaStream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (this.hasSpokenInCurrentChunk && this.audioChunks.length > 0 && this.isRunning) {
          const blobType = recorder.mimeType || 'audio/webm';
          const fullAudioBlob = new Blob(this.audioChunks, { type: blobType });
          this.audioChunks = [];
          this.dispatchAudioToGemini(fullAudioBlob);
        } else if (this.isRunning && this.state !== 'processing' && this.state !== 'assistant_speaking') {
          // Restart segment if silence or no audio
          this.startSegmentRecording();
        }
      };

      recorder.start(100);
      this.mediaRecorder = recorder;
    } catch (err) {
      console.warn('Failed to start MediaRecorder segment:', err);
    }
  }

  /**
   * Monitor real-time mic volume and detect Voice Activity (VAD)
   */
  private startVolumeMonitoring() {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const checkVolume = () => {
      if (!this.isRunning || !this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);

      // Compute average audio power
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const normalizedVolume = Math.min(100, Math.round((avg / 128) * 100));

      this.callbacks.onVolumeChange?.(normalizedVolume);

      // Guard: Ignore mic input while assistant is speaking aloud to prevent speaker feedback loop
      if (speechEngine.isSpeaking() || this.state === 'assistant_speaking') {
        this.hasSpokenInCurrentChunk = false;
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
        this.animFrameId = requestAnimationFrame(checkVolume);
        return;
      }

      // Voice Activity Detection (VAD)
      if (this.state === 'listening' || this.state === 'user_speaking') {
        const SPEECH_THRESHOLD = 12;

        if (normalizedVolume > SPEECH_THRESHOLD) {
          // User is speaking
          this.hasSpokenInCurrentChunk = true;
          if (this.state !== 'user_speaking') {
            this.setState('user_speaking');
          }

          // Clear any pending silence timer
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
          }
        } else if (this.hasSpokenInCurrentChunk) {
          // User was speaking and is now silent: start silence countdown (1500ms)
          if (!this.silenceTimer) {
            this.silenceTimer = setTimeout(() => {
              if (this.hasSpokenInCurrentChunk && this.isRunning) {
                this.commitCurrentUtterance();
              }
            }, 1500);
          }
        }
      }

      this.animFrameId = requestAnimationFrame(checkVolume);
    };

    this.animFrameId = requestAnimationFrame(checkVolume);
  }

  /**
   * Force commit current utterance immediately (e.g. user taps Send / Orb)
   */
  public commitCurrentUtterance() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
  }

  /**
   * Process spoken audio with Gemini, falling back seamlessly to live transcribed speech & local NLP
   */
  private async dispatchAudioToGemini(audioBlob: Blob) {
    if (!this.isRunning) return;

    const thisUtteranceId = ++this.currentUtteranceId;
    this.setState('processing');

    // 1. Give Web Speech API up to 1400ms to deliver final transcript if user spoke
    let capturedTranscript = this.currentSpeechTranscript.trim();
    if (!capturedTranscript && this.hasSpokenInCurrentChunk) {
      const waitStart = Date.now();
      while (!this.currentSpeechTranscript.trim() && Date.now() - waitStart < 1400) {
        await new Promise((r) => setTimeout(r, 60));
        if (!this.isRunning || this.currentUtteranceId !== thisUtteranceId) return;
      }
      capturedTranscript = this.currentSpeechTranscript.trim();
    }

    const capturedAlternatives = [...this.currentAlternatives];
    this.currentSpeechTranscript = '';
    this.currentAlternatives = [];

    // If completely silent/noise with no transcript and no valid audio, resume listening smoothly
    if (!capturedTranscript && (!audioBlob || audioBlob.size < 1000)) {
      console.log('[Live Voice] Acoustic activity detected without words, resuming listening.');
      this.setState('listening');
      this.startSegmentRecording();
      return;
    }

    let result: CommandProcessResult | null = null;

    // 1. High-Precision Instant Local NLP (handles "Option 1-4", "Next question", "Read question", "Clear option", etc.)
    // Local NLP runs in 0ms without waiting for slow external APIs
    if (capturedTranscript) {
      const candidates = [capturedTranscript, ...capturedAlternatives];
      const localResult = processVoiceCommand(candidates);
      if (localResult && localResult.intent !== 'UNRECOGNIZED') {
        console.log('[Live Voice] Instantly executed via high-precision local NLP:', localResult.intent);
        result = localResult;
      }
    }

    // 2. Multimodal Audio via Gemini (only if a valid Google AI Studio key starting with AIzaSy is configured)
    if (!result && geminiVoiceService.hasValidGeminiKey() && audioBlob && audioBlob.size > 1000) {
      try {
        result = await geminiVoiceService.processAudioWithGemini(audioBlob);
      } catch (err) {
        console.warn('[Live Voice] Gemini audio processing failed:', err);
      }
    }

    // Discard stale in-flight responses if user already spoke again or stopped
    if (this.currentUtteranceId !== thisUtteranceId || !this.isRunning) {
      console.log(`[Live Voice] Utterance #${thisUtteranceId} stale, skipping.`);
      return;
    }

    // 3. Fallback to Gemini / Groq Text LLM for natural language queries (e.g. conversational questions)
    if (!result && capturedTranscript && geminiVoiceService.hasApiKey()) {
      try {
        result = await geminiVoiceService.processTextWithGemini(capturedTranscript);
      } catch (err) {
        console.warn('[Live Voice] Gemini/Groq text processing failed:', err);
      }
    }

    // Discard if newer utterance began while Gemini text was resolving
    if (this.currentUtteranceId !== thisUtteranceId || !this.isRunning) {
      console.log(`[Live Voice] Utterance #${thisUtteranceId} stale, skipping.`);
      return;
    }

    // 4. Final attempt with local NLP if text LLM returned null
    if (!result && capturedTranscript) {
      result = processVoiceCommand([capturedTranscript, ...capturedAlternatives]);
    }

    if (this.currentUtteranceId !== thisUtteranceId || !this.isRunning) return;

    if (result && result.intent !== 'UNRECOGNIZED') {
      this.callbacks.onResult?.(result);

      // Assistant speaking state: speech is already triggered by useAnnouncerStore
      if (result.assistantReply) {
        this.setState('assistant_speaking');
        this.currentSpeechTranscript = '';
        if (!speechEngine.isSpeaking()) {
          speechEngine.speak(result.assistantReply, true);
        }
      } else {
        this.setState('listening');
        this.startSegmentRecording();
      }
    } else {
      // Only announce prompt if user actually said words that were not recognized
      if (capturedTranscript) {
        const promptReply =
          'I heard "' +
          capturedTranscript +
          '". For questions or options, say "Option 1", "Option 2", "Next question", or "Read question".';
        this.callbacks.onResult?.({
          success: false,
          intent: 'UNRECOGNIZED',
          userQuery: capturedTranscript,
          assistantReply: promptReply,
          actionExecuted: undefined,
        });
        this.setState('assistant_speaking');
        speechEngine.speak(promptReply, true);
      } else {
        // Acoustic noise only: resume listening silently
        this.setState('listening');
        this.startSegmentRecording();
      }
    }
  }

  /**
   * Stop the live voice session
   */
  public stop() {
    this.isRunning = false;
    soundEffects.playMicStop();

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.unbindSpeechEnd) {
      this.unbindSpeechEnd();
      this.unbindSpeechEnd = null;
    }

    if (this.unbindTranscript) {
      this.unbindTranscript();
      this.unbindTranscript = null;
    }
    voiceRecognition.stop();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.mediaRecorder = null;
    this.audioChunks = [];

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.setState('idle');
  }

  public toggle(): boolean {
    if (this.isRunning) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }
}
