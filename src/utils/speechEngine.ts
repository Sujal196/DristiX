/**
 * Built-in Web Speech API Controller for visually impaired candidates
 * Provides reliable TTS with Chrome pause/resume bug fixes and language defaults.
 */

function detectLanguage(text: string): 'hi-IN' | 'en-IN' {
  // 1. If text contains Devanagari script, it is definitely Hindi
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hi-IN';
  }
  // 2. Check for common Romanized Hindi / Hinglish keywords
  const hinglishWords = [
    'hai', 'hain', 'aapka', 'aapki', 'aapke', 'kripya', 'sawal', 'uttar', 'pariksha',
    'samay', 'chuna', 'chune', 'gaya', 'gayi', 'agla', 'pichhla', 'batao', 'bataiye',
    'karein', 'karo', 'namaste', 'shuru', 'khatam', 'nahi', 'raha', 'rahi', 'liye',
    'badla', 'diya', 'di', 'khola', 'khol', 'padha', 'pehle', 'kholiye', 'sakte'
  ];
  const lowerWords = text.toLowerCase().split(/[\s,.-]+/);
  const matchCount = lowerWords.filter((w) => hinglishWords.includes(w)).length;
  if (matchCount >= 2 || (lowerWords.length <= 6 && matchCount >= 1)) {
    return 'hi-IN';
  }
  return 'en-IN';
}

class SpeechEngine {
  private synth: SpeechSynthesis | null = null;
  public enabled: boolean = true;
  public rate: number = 1.0;
  public pitch: number = 1.0;
  public selectedVoiceURI: string = '';
  private voices: SpeechSynthesisVoice[] = [];
  private speechStartListeners: Set<() => void> = new Set();
  private speechEndListeners: Set<() => void> = new Set();
  private internalSpeaking: boolean = false;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private watchdogTimer: any = null;
  private lastSpeechEndTime: number = 0;
  private lastSpokenText: string = '';

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  public onSpeechStart(cb: () => void): () => void {
    this.speechStartListeners.add(cb);
    return () => {
      this.speechStartListeners.delete(cb);
    };
  }

  public onSpeechEnd(cb: () => void): () => void {
    this.speechEndListeners.add(cb);
    return () => {
      this.speechEndListeners.delete(cb);
    };
  }

  private notifySpeechStart() {
    this.internalSpeaking = true;
    this.speechStartListeners.forEach((cb) => cb());
  }

  private notifySpeechEnd() {
    if (!this.internalSpeaking && !this.activeUtterance) return;
    this.internalSpeaking = false;
    this.activeUtterance = null;
    this.lastSpeechEndTime = Date.now();
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    this.speechEndListeners.forEach((cb) => cb());
  }

  private loadVoices() {
    if (!this.synth) return;
    try {
      this.voices = this.synth.getVoices();
    } catch {
      // fallback
    }
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0 && this.synth) {
      this.voices = this.synth.getVoices();
    }
    return this.voices;
  }

  public stop(notify = true) {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    this.activeUtterance = null;
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {}
    }
    if (notify) {
      this.notifySpeechEnd();
    }
  }

  public pause() {
    if (this.synth) {
      this.synth.pause();
    }
  }

  public resume() {
    if (this.synth) {
      this.synth.resume();
    }
  }

  public isSpeaking(): boolean {
    return this.internalSpeaking;
  }

  /**
   * Returns true if assistant is actively speaking OR finished speaking less than 900ms ago.
   * Prevents microphone from picking up acoustic reflections/room echo from laptop speakers.
   */
  public isEchoGuardActive(): boolean {
    if (this.isSpeaking()) return true;
    return Date.now() - this.lastSpeechEndTime < 450;
  }

  /**
   * Checks if candidate recognized transcript is just an echo of what the assistant just spoke aloud.
   */
  public isTextEcho(candidateText: string): boolean {
    if (!candidateText || !this.lastSpokenText) return false;
    const normCand = candidateText.toLowerCase().replace(/[^\w\s\u0900-\u097F]/gi, '').trim();
    const normSpoken = this.lastSpokenText.replace(/[^\w\s\u0900-\u097F]/gi, '').trim();
    if (!normCand || !normSpoken) return false;

    // Direct match or substring
    if (normSpoken.includes(normCand) && normCand.length > 6) return true;
    if (normCand.includes(normSpoken) && normSpoken.length > 6) return true;

    // Word overlap (if >60% of words in candidate were spoken by assistant recently)
    const candWords = normCand.split(/\s+/).filter((w) => w.length > 2);
    if (candWords.length >= 2) {
      const matchWords = candWords.filter((w) => normSpoken.includes(w));
      if (matchWords.length / candWords.length >= 0.6) return true;
    }

    return false;
  }

  public speak(text: string, interrupt = true) {
    if (!this.enabled || typeof window === 'undefined') return;
    if (!('speechSynthesis' in window)) return;

    this.synth = window.speechSynthesis;

    // Fix Chrome bug: if paused or stuck, resume first
    if (this.synth.paused) {
      try {
        this.synth.resume();
      } catch {}
    }

    if (interrupt) {
      this.stop(false);
    } else if (this.internalSpeaking) {
      return;
    }

    // Clean HTML tags or redundant whitespace
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (!cleanText) {
      this.notifySpeechEnd();
      return;
    }
    this.lastSpokenText = cleanText.toLowerCase();

    const detectedLang = detectLanguage(cleanText);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    this.activeUtterance = utterance;
    // Retain global reference to protect against Chromium V8 garbage collection bug
    (window as any)._dristixActiveUtterance = utterance;

    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.lang = detectedLang;

    if (this.voices.length === 0) {
      this.loadVoices();
    }

    if (this.selectedVoiceURI) {
      const voice = this.voices.find((v) => v.voiceURI === this.selectedVoiceURI);
      if (voice) {
        utterance.voice = voice;
      }
    } else {
      if (detectedLang === 'hi-IN') {
        const hiVoice =
          this.voices.find((v) => v.lang.toLowerCase().startsWith('hi')) ||
          this.voices.find((v) => v.lang === 'hi-IN') ||
          this.voices.find((v) => (v.name || '').toLowerCase().includes('hindi')) ||
          this.voices.find((v) => v.lang === 'en-IN');
        if (hiVoice) {
          utterance.voice = hiVoice;
        }
      } else {
        const enVoice =
          this.voices.find((v) => v.lang === 'en-IN') ||
          this.voices.find((v) => v.lang.startsWith('en'));
        if (enVoice) {
          utterance.voice = enVoice;
        }
      }
    }

    utterance.onstart = () => {
      this.notifySpeechStart();
    };

    utterance.onend = () => {
      this.notifySpeechEnd();
    };

    utterance.onerror = (e: any) => {
      // Normal browser cancellation when new utterance preempts previous utterance
      if (e?.error === 'canceled' || e?.error === 'interrupted') {
        return;
      }
      console.warn('SpeechSynthesis error:', e?.error || e);
      if (this.synth && this.synth.paused) {
        try {
          this.synth.resume();
        } catch {}
      }
      this.notifySpeechEnd();
    };

    // Chrome Watchdog: compute dynamic duration limit so speech never gets stuck indefinitely
    const wordCount = cleanText.split(/\s+/).length;
    const estimatedDurationMs = Math.max(2500, (wordCount / (2.2 * this.rate) + 2.5) * 1000);

    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
    }
    this.watchdogTimer = setTimeout(() => {
      if (this.internalSpeaking) {
        this.notifySpeechEnd();
      }
    }, estimatedDurationMs);

    // Small delay prevents Chrome cancel() race condition
    setTimeout(() => {
      if (this.synth) {
        if (this.synth.paused) {
          try {
            this.synth.resume();
          } catch {}
        }
        try {
          this.synth.speak(utterance);
        } catch (err) {
          console.warn('SpeechSynthesis speak failed:', err);
          this.notifySpeechEnd();
        }
      }
    }, 40);
  }
}

export const speechEngine = new SpeechEngine();

