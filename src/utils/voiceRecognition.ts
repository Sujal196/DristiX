import { speechEngine } from './speechEngine';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface VoiceRecognitionCallbacks {
  onTranscript: (transcript: string, isFinal: boolean, alternatives?: string[]) => void;
  onStateChange: (state: VoiceState) => void;
  onError: (errorMsg: string) => void;
}

class VoiceRecognitionService {
  private recognition: any = null;
  private isListeningActive: boolean = false;
  private shouldAutoRestart: boolean = false;
  private currentLanguage: 'hi-IN' | 'en-IN' | 'en-US' = 'hi-IN';
  private listeners: Set<VoiceRecognitionCallbacks> = new Set();
  private currentState: VoiceState = 'idle';
  private restartTimeout: any = null;

  // MediaRecorder audio capture for 100% reliable direct recording
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];

  constructor() {
    this.initRecognition();
    this.bindSpeechEngineLifecycle();
  }

  private bindSpeechEngineLifecycle() {
    speechEngine.onSpeechStart(() => {
      // When TTS is vocalizing, visually indicate speaking and ignore mic input
      if (this.isListeningActive) {
        this.setState('speaking');
      }
    });

    speechEngine.onSpeechEnd(() => {
      // When TTS finishes, wait for speaker room echo to decay before resuming listening state
      if (this.isListeningActive) {
        setTimeout(() => {
          if (this.isListeningActive && !speechEngine.isSpeaking()) {
            this.setState('listening');
            this.scheduleRestart(100);
          }
        }, 750);
      }
    });
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn('SpeechRecognition API not available in this browser environment.');
      return;
    }

    try {
      const rec = new SpeechRecognitionAPI();
      // Using continuous mode with clean seamless restart
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = this.currentLanguage;
      rec.maxAlternatives = 5;

      rec.onstart = () => {
        this.isListeningActive = true;
        this.setState('listening');
      };

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        const alternatives: string[] = [];

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const text = result[0]?.transcript || '';
          if (result.isFinal) {
            finalTranscript += text;
            for (let a = 0; a < result.length; a++) {
              const altText = result[a]?.transcript?.trim();
              if (altText && !alternatives.includes(altText)) {
                alternatives.push(altText);
              }
            }
          } else {
            interimTranscript += text;
          }
        }

        if (finalTranscript.trim()) {
          this.notifyTranscript(finalTranscript.trim(), true, alternatives);
        } else if (interimTranscript.trim()) {
          this.notifyTranscript(interimTranscript.trim(), false);
        }
      };

      rec.onerror = (event: any) => {
        const error = event.error;

        // In Chrome, 'no-speech' and 'aborted' are normal lifecycle timeouts during pauses.
        // They are expected and should be handled smoothly without logging red warnings or stopping.
        if (error === 'no-speech' || error === 'aborted') {
          return;
        }

        if (error === 'not-allowed' || error === 'service-not-allowed') {
          console.warn('Microphone permission denied:', error);
          this.shouldAutoRestart = false;
          this.isListeningActive = false;
          this.setState('error');
          this.notifyError(
            'Microphone access was denied. Please allow microphone permission in your browser address bar.'
          );
          return;
        }

        // On any transient connection error, schedule a smooth restart
        if (this.shouldAutoRestart) {
          this.scheduleRestart(400);
        }
      };

      rec.onend = () => {
        // Auto-restart if listening is active and user has not stopped it
        if (this.shouldAutoRestart && this.isListeningActive) {
          if (speechEngine.isSpeaking()) {
            this.setState('speaking');
          } else {
            this.scheduleRestart(150);
          }
        } else {
          this.isListeningActive = false;
          if (this.currentState !== 'error') {
            this.setState('idle');
          }
        }
      };

      this.recognition = rec;
    } catch (err) {
      console.error('Failed to initialize SpeechRecognition:', err);
    }
  }

  private scheduleRestart(delayMs = 150) {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (!this.shouldAutoRestart || !this.isListeningActive) return;

    this.restartTimeout = setTimeout(() => {
      if (!this.shouldAutoRestart || !this.isListeningActive) return;
      if (speechEngine.isSpeaking()) {
        this.scheduleRestart(250);
        return;
      }

      try {
        if (!this.recognition) {
          this.initRecognition();
        }
        this.recognition?.start();
        this.setState('listening');
      } catch (err: any) {
        if (err?.name === 'InvalidStateError') {
          // Already running, which is fine
          this.setState('listening');
        } else {
          // Re-create instance and retry
          this.initRecognition();
          try {
            this.recognition?.start();
            this.setState('listening');
          } catch {
            setTimeout(() => this.scheduleRestart(350), 350);
          }
        }
      }
    }, delayMs);
  }

  private notifyTranscript(transcript: string, isFinal: boolean, alternatives?: string[]) {
    // Suppress if the transcript is an echo of the assistant's own voice
    if (speechEngine.isTextEcho(transcript)) {
      console.log('🔇 Suppressed acoustic speaker echo transcript:', transcript);
      return;
    }

    // If user speaks a clear command while assistant is talking, interrupt speech so candidate is heard immediately
    if (isFinal && speechEngine.isSpeaking()) {
      speechEngine.stop();
    }

    this.listeners.forEach((cb) => cb.onTranscript(transcript, isFinal, alternatives));
  }

  private notifyError(error: string) {
    this.listeners.forEach((cb) => cb.onError(error));
  }

  private notifyState(state: VoiceState) {
    this.listeners.forEach((cb) => cb.onStateChange(state));
  }

  public addListener(callbacks: VoiceRecognitionCallbacks): () => void {
    this.listeners.add(callbacks);
    return () => {
      this.listeners.delete(callbacks);
    };
  }

  public setCallbacks(callbacks: VoiceRecognitionCallbacks) {
    this.listeners.clear();
    this.listeners.add(callbacks);
  }

  public setState(state: VoiceState) {
    this.currentState = state;
    this.notifyState(state);
  }

  public getState(): VoiceState {
    return this.currentState;
  }

  public isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    );
  }

  public getLanguage(): 'hi-IN' | 'en-IN' | 'en-US' {
    return this.currentLanguage;
  }

  public setLanguage(lang: 'hi-IN' | 'en-IN' | 'en-US') {
    if (this.currentLanguage === lang) return;
    this.currentLanguage = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
      if (this.isListeningActive) {
        try {
          this.recognition.stop();
        } catch {}
        this.scheduleRestart(200);
      }
    }
  }

  public start() {
    this.shouldAutoRestart = true;
    this.isListeningActive = true;

    if (!this.recognition) {
      this.initRecognition();
    }

    if (!this.recognition) {
      this.notifyError(
        'Speech recognition is not supported in this browser. Please use Chrome, Edge, or a WebSpeech-enabled browser.'
      );
      return;
    }

    try {
      this.recognition.start();
      this.setState('listening');
    } catch (err: any) {
      if (err?.name === 'InvalidStateError') {
        this.setState('listening');
      } else {
        this.initRecognition();
        try {
          this.recognition.start();
          this.setState('listening');
        } catch {
          this.scheduleRestart(250);
        }
      }
    }
  }

  public stop() {
    this.shouldAutoRestart = false;
    this.isListeningActive = false;

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
    }

    this.stopAudioRecording();
    this.setState('idle');
  }

  public toggle(): boolean {
    if (this.isListeningActive) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  // ==========================================
  // Direct MediaRecorder Audio Stream Support
  // ==========================================
  public async startAudioRecording(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    try {
      this.audioChunks = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      recorder.start(250);
      this.mediaRecorder = recorder;
      return true;
    } catch (err) {
      console.warn('Failed to start audio recording stream:', err);
      return false;
    }
  }

  public stopAudioRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach((track) => track.stop());
          this.mediaStream = null;
        }
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });
        this.audioChunks = [];
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach((track) => track.stop());
          this.mediaStream = null;
        }
        this.mediaRecorder = null;
        resolve(blob);
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        resolve(null);
      }
    });
  }
}

export const voiceRecognition = new VoiceRecognitionService();
