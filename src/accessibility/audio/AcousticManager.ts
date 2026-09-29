import { speechEngine } from '../../utils/speechEngine';
import { earconManager } from './EarconManager';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import type { EarconPlayOptions, EarconType, SpeakOptions } from './AudioTypes';
import type { AcousticPriority, AcousticStage } from '../events/AccessibilityEvents';

const PRIORITY_LEVELS: Record<AcousticPriority, number> = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  CRITICAL: 3,
};

/**
 * AcousticManager provides a unified cognitive audio pipeline for DristiX.
 *
 * Responsibilities:
 * 1. Wraps existing `speechEngine` (Web Speech API) without duplicating engines.
 * 2. Connects with `EarconManager` for non-speech audio cues.
 * 3. Enforces Acoustic Staging (cognitive audio identities per message type).
 * 4. Prioritizes critical audio events (e.g. Timer Critical > Focus changes).
 * 5. Prevents auditory overload by prioritizing earcons over verbose speech.
 */
class AcousticManager {
  private currentPriority: AcousticPriority = 'NORMAL';

  constructor() {
    // Reset priority when speech ends
    speechEngine.onSpeechEnd(() => {
      this.currentPriority = 'NORMAL';
    });
  }

  /**
   * Evaluates if new speech request has permission to interrupt current playback.
   */
  private canInterrupt(newPriority: AcousticPriority): boolean {
    if (!speechEngine.isSpeaking()) return true;
    return PRIORITY_LEVELS[newPriority] >= PRIORITY_LEVELS[this.currentPriority];
  }

  /**
   * Applies Acoustic Staging settings to speech parameters.
   */
  private applyAcousticStaging(stage?: AcousticStage, baseRate = 1.0, basePitch = 1.0) {
    const stagingEnabled = usePreferencesStore.getState().acousticStagingEnabled ?? true;
    if (!stagingEnabled || !stage) {
      return { rate: baseRate, pitch: basePitch };
    }

    switch (stage) {
      case 'QUESTION':
        // Authoritative, measured neutral pace
        return { rate: Math.max(0.8, baseRate * 0.98), pitch: basePitch };
      case 'OPTION':
        // Slightly brisk, clean cadence
        return { rate: Math.min(2.0, baseRate * 1.05), pitch: Math.min(1.4, basePitch * 1.03) };
      case 'WARNING':
        // Urgent, slightly higher pitch for attention
        return { rate: Math.min(2.2, baseRate * 1.08), pitch: Math.min(1.5, basePitch * 1.15) };
      case 'SUCCESS':
        // Bright, reassuring tone
        return { rate: baseRate, pitch: Math.min(1.4, basePitch * 1.08) };
      case 'ERROR':
        // Lower tone
        return { rate: baseRate * 0.95, pitch: Math.max(0.6, basePitch * 0.88) };
      case 'SYSTEM':
      case 'NAVIGATION':
      default:
        return { rate: baseRate, pitch: basePitch };
    }
  }

  /**
   * Central speech vocalizer with staging, priority management, and failsafes.
   */
  public speak(options: SpeakOptions): void {
    const prefs = usePreferencesStore.getState();
    const masterAudio = prefs.audioFeedbackEnabled ?? true;
    const speechEnabled = prefs.ttsEnabled ?? true;

    if (!masterAudio || !speechEnabled || !options.text) return;

    const priority = options.priority ?? 'NORMAL';

    // Discard lower-priority speech if higher-priority speech is actively in progress
    if (!this.canInterrupt(priority)) {
      return;
    }

    this.currentPriority = priority;

    const userRate = prefs.ttsRate || 1.0;
    const userPitch = prefs.ttsPitch || 1.0;
    const { rate, pitch } = this.applyAcousticStaging(options.type, options.rate ?? userRate, options.pitch ?? userPitch);

    // Apply temporary tuning to speechEngine
    const prevRate = speechEngine.rate;
    const prevPitch = speechEngine.pitch;

    speechEngine.rate = rate;
    speechEngine.pitch = pitch;

    const shouldInterrupt = options.interrupt !== undefined ? options.interrupt : true;

    try {
      speechEngine.speak(options.text, shouldInterrupt);
    } finally {
      // Restore base preferences
      speechEngine.rate = prevRate;
      speechEngine.pitch = prevPitch;
    }
  }

  /**
   * Plays a semantic auditory earcon through EarconManager.
   */
  public playEarcon(type: EarconType, options?: EarconPlayOptions): void {
    earconManager.playEarcon(type, options);
  }

  /**
   * Stops active speech immediately.
   */
  public stopSpeech(): void {
    this.currentPriority = 'NORMAL';
    speechEngine.stop();
  }

  /**
   * Pauses active speech.
   */
  public pauseSpeech(): void {
    speechEngine.pause();
  }

  /**
   * Resumes paused speech.
   */
  public resumeSpeech(): void {
    speechEngine.resume();
  }

  /**
   * Checks if speech engine is speaking.
   */
  public isSpeaking(): boolean {
    return speechEngine.isSpeaking();
  }

  /**
   * Unlocks Web Audio on user gesture.
   */
  public unlockAudio(): void {
    earconManager.unlock();
  }
}

export const acousticManager = new AcousticManager();
