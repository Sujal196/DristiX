import { usePreferencesStore } from '../../store/usePreferencesStore';
import type { EarconPlayOptions, EarconType } from './AudioTypes';

/**
 * EarconManager synthesizes standardized, accessible auditory cues (Earcons)
 * using the browser's Web Audio API without requiring any external mp3 files.
 *
 * Reuses a single shared AudioContext across the application to prevent memory
 * leaks and resource exhaustion.
 */
class EarconManager {
  private ctx: AudioContext | null = null;

  private initCtx(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Resumes AudioContext on user interaction to comply with browser autoplay policies.
   */
  public unlock(): void {
    this.initCtx();
  }

  /**
   * Returns the shared AudioContext for modules like SonificationEngine, ensuring a single context.
   */
  public getAudioContext(): AudioContext | null {
    return this.initCtx();
  }

  private isSoundAllowed(): boolean {
    const prefs = usePreferencesStore.getState();
    const masterAudio = prefs.audioFeedbackEnabled ?? true;
    const earconsEnabled = prefs.earconsEnabled ?? prefs.soundEffectsEnabled ?? true;
    return masterAudio && earconsEnabled;
  }

  /**
   * Plays a single oscillator tone with exponential decay.
   */
  private playTone(
    frequency: number,
    type: OscillatorType,
    duration: number,
    baseGain = 0.2,
    gainMultiplier = 1.0
  ): void {
    if (!this.isSoundAllowed()) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const finalGain = Math.max(0.001, baseGain * gainMultiplier);
      const now = ctx.currentTime;

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);

      gain.gain.setValueAtTime(finalGain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Audio failsafe
    }
  }

  /**
   * Plays a sequence of tones with precise delays.
   */
  private playSequence(
    tones: Array<{ freq: number; type?: OscillatorType; delay: number; duration: number; gain?: number }>,
    gainMultiplier = 1.0
  ): void {
    if (!this.isSoundAllowed()) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;

      const now = ctx.currentTime;
      tones.forEach((tone) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const toneGain = (tone.gain ?? 0.22) * gainMultiplier;

        osc.type = tone.type ?? 'sine';
        osc.frequency.setValueAtTime(tone.freq, now + tone.delay);

        gain.gain.setValueAtTime(toneGain, now + tone.delay);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.delay + tone.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + tone.delay);
        osc.stop(now + tone.delay + tone.duration);
      });
    } catch {
      // Audio failsafe
    }
  }

  // --- Semantic Earcon Handlers ---

  /** OPTION_SELECTED: short subtle tone (660Hz sine, 90ms) */
  public playOptionSelected(options?: EarconPlayOptions): void {
    this.playTone(660, 'sine', 0.09, 0.22, options?.gainMultiplier);
  }

  /** MARK_REVIEW: two-note ascending chime (C5 523.25Hz -> E5 659.25Hz) */
  public playMarkReview(options?: EarconPlayOptions): void {
    this.playSequence(
      [
        { freq: 523.25, type: 'sine', delay: 0.0, duration: 0.1, gain: 0.2 },
        { freq: 659.25, type: 'sine', delay: 0.08, duration: 0.14, gain: 0.24 },
      ],
      options?.gainMultiplier
    );
  }

  /** CLEAR_RESPONSE: short descending tone (triangle 440Hz -> 330Hz) */
  public playClearResponse(options?: EarconPlayOptions): void {
    this.playSequence(
      [
        { freq: 440, type: 'triangle', delay: 0.0, duration: 0.07, gain: 0.2 },
        { freq: 330, type: 'triangle', delay: 0.06, duration: 0.11, gain: 0.18 },
      ],
      options?.gainMultiplier
    );
  }

  /** ANSWER_CONFIRMED: clear confirmation chord (C5 + E5 + G5 major triad) */
  public playAnswerConfirmed(options?: EarconPlayOptions): void {
    this.playSequence(
      [
        { freq: 523.25, type: 'sine', delay: 0.0, duration: 0.12, gain: 0.18 },
        { freq: 659.25, type: 'sine', delay: 0.04, duration: 0.14, gain: 0.2 },
        { freq: 783.99, type: 'sine', delay: 0.08, duration: 0.18, gain: 0.22 },
      ],
      options?.gainMultiplier
    );
  }

  /** QUESTION_CHANGE: short crisp transition tone (440Hz, 60ms) */
  public playQuestionChange(options?: EarconPlayOptions): void {
    this.playTone(440, 'sine', 0.06, 0.18, options?.gainMultiplier);
  }

  /** SECTION_CHANGE: distinct harmonic dual-tone transition */
  public playSectionChange(options?: EarconPlayOptions): void {
    this.playSequence(
      [
        { freq: 523.25, type: 'sine', delay: 0.0, duration: 0.15, gain: 0.2 },
        { freq: 783.99, type: 'sine', delay: 0.06, duration: 0.2, gain: 0.24 },
      ],
      options?.gainMultiplier
    );
  }

  /** SUCCESS: four-note positive celebration fanfare */
  public playSuccess(options?: EarconPlayOptions): void {
    this.playSequence(
      [
        { freq: 440, type: 'sine', delay: 0.0, duration: 0.09, gain: 0.22 },
        { freq: 554.37, type: 'sine', delay: 0.09, duration: 0.09, gain: 0.22 },
        { freq: 659.25, type: 'sine', delay: 0.18, duration: 0.12, gain: 0.24 },
        { freq: 880, type: 'sine', delay: 0.28, duration: 0.25, gain: 0.26 },
      ],
      options?.gainMultiplier
    );
  }

  /** ERROR: low buzzer dual-tone */
  public playError(options?: EarconPlayOptions): void {
    this.playSequence(
      [
        { freq: 220, type: 'sawtooth', delay: 0.0, duration: 0.08, gain: 0.16 },
        { freq: 174.61, type: 'triangle', delay: 0.07, duration: 0.12, gain: 0.18 },
      ],
      options?.gainMultiplier
    );
  }

  /** WARNING: three distinct alert pulses */
  public playWarning(options?: EarconPlayOptions): void {
    this.playSequence(
      [
        { freq: 880, type: 'sine', delay: 0.0, duration: 0.08, gain: 0.22 },
        { freq: 880, type: 'sine', delay: 0.12, duration: 0.08, gain: 0.22 },
        { freq: 880, type: 'sine', delay: 0.24, duration: 0.1, gain: 0.24 },
      ],
      options?.gainMultiplier
    );
  }

  /** FOCUS_CHANGE: very subtle short tick (800Hz, 25ms, soft gain 0.06) */
  public playFocusChange(options?: EarconPlayOptions): void {
    this.playTone(800, 'sine', 0.025, 0.06, options?.gainMultiplier);
  }

  /** MIC_START: ascending double chime */
  public playMicStart(options?: EarconPlayOptions): void {
    this.playSequence(
      [
        { freq: 523.25, type: 'sine', delay: 0.0, duration: 0.09, gain: 0.2 },
        { freq: 783.99, type: 'sine', delay: 0.08, duration: 0.14, gain: 0.24 },
      ],
      options?.gainMultiplier
    );
  }

  /** MIC_STOP: descending gentle chime */
  public playMicStop(options?: EarconPlayOptions): void {
    this.playSequence(
      [
        { freq: 659.25, type: 'sine', delay: 0.0, duration: 0.08, gain: 0.18 },
        { freq: 440, type: 'sine', delay: 0.07, duration: 0.12, gain: 0.16 },
      ],
      options?.gainMultiplier
    );
  }

  /**
   * Universal dispatch helper mapping EarconType to corresponding handler.
   */
  public playEarcon(type: EarconType, options?: EarconPlayOptions): void {
    switch (type) {
      case 'OPTION_SELECTED':
        this.playOptionSelected(options);
        break;
      case 'MARK_REVIEW':
        this.playMarkReview(options);
        break;
      case 'CLEAR_RESPONSE':
        this.playClearResponse(options);
        break;
      case 'ANSWER_CONFIRMED':
        this.playAnswerConfirmed(options);
        break;
      case 'QUESTION_CHANGE':
        this.playQuestionChange(options);
        break;
      case 'SECTION_CHANGE':
        this.playSectionChange(options);
        break;
      case 'SUCCESS':
        this.playSuccess(options);
        break;
      case 'ERROR':
        this.playError(options);
        break;
      case 'WARNING':
        this.playWarning(options);
        break;
      case 'FOCUS_CHANGE':
        this.playFocusChange(options);
        break;
      case 'MIC_START':
        this.playMicStart(options);
        break;
      case 'MIC_STOP':
        this.playMicStop(options);
        break;
    }
  }
}

export const earconManager = new EarconManager();

// Automatically unlock Web Audio on first user interaction
if (typeof window !== 'undefined') {
  const unlockListener = () => {
    earconManager.unlock();
  };
  window.addEventListener('click', unlockListener, { passive: true, once: true });
  window.addEventListener('keydown', unlockListener, { passive: true, once: true });
  window.addEventListener('touchstart', unlockListener, { passive: true, once: true });
}
