import { usePreferencesStore } from '../../store/usePreferencesStore';

/**
 * HapticManager provides tactile multi-sensory feedback via the standard
 * Web Vibration API (navigator.vibrate).
 *
 * Implements cognitive offloading for visually impaired students:
 * instead of requiring constant verbal confirmation for routine clicks,
 * subtle micro-vibrations provide immediate haptic confirmation.
 *
 * Silently falls back if vibration is unsupported on the browser/device.
 */
class HapticManager {
  /**
   * Checks whether the current runtime environment supports device vibration.
   */
  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  /**
   * Low-level pattern vibration with preference check and error handling.
   */
  public vibrate(pattern: number | number[]): boolean {
    if (!this.isSupported()) return false;

    // Check master preference
    const enabled = usePreferencesStore.getState().hapticEnabled;
    if (!enabled) return false;

    try {
      return navigator.vibrate(pattern);
    } catch {
      // Browsers may block vibration when page is not focused or user has not interacted
      return false;
    }
  }

  /**
   * Cancels any active vibration pattern immediately.
   */
  public cancel(): void {
    if (!this.isSupported()) return;
    try {
      navigator.vibrate(0);
    } catch {}
  }

  // --- Semantic Vibration Patterns ---

  /** Subtle single pulse for selecting an exam option (40ms) */
  public vibrateOptionSelected(): boolean {
    return this.vibrate(40);
  }

  /** Double rhythmic pulse for flagging a question for review (40ms on, 60ms off, 40ms on) */
  public vibrateMarkReview(): boolean {
    return this.vibrate([40, 60, 40]);
  }

  /** Descending tactile feedback when clearing an answer (50ms on, 40ms off, 30ms on) */
  public vibrateClearResponse(): boolean {
    return this.vibrate([50, 40, 30]);
  }

  /** Ascending affirmation when locking/confirming an answer */
  public vibrateAnswerConfirmed(): boolean {
    return this.vibrate([30, 40, 60]);
  }

  /** Crisp light tick when moving between questions (25ms) */
  public vibrateQuestionChange(): boolean {
    return this.vibrate(25);
  }

  /** Distinct dual vibration when entering a new exam section */
  public vibrateSectionChange(): boolean {
    return this.vibrate([30, 50, 50]);
  }

  /** Distinct triple vibration alert for timer warnings */
  public vibrateWarning(): boolean {
    return this.vibrate([80, 80, 80]);
  }

  /** Urgent warning pulse pattern for final minutes / critical countdown */
  public vibrateCritical(): boolean {
    return this.vibrate([150, 100, 150, 100, 300]);
  }

  /** Celebratory positive pulse for successful test submission */
  public vibrateSuccess(): boolean {
    return this.vibrate([40, 50, 80]);
  }

  /** Solid rejection buzz for invalid action or boundary limits */
  public vibrateError(): boolean {
    return this.vibrate(100);
  }

  // --- Sonification Feedback ---

  /** Light tactile pulse for stepping to a data point (20ms) */
  public vibrateGraphPoint(): boolean {
    return this.vibrate(20);
  }

  /** High crisp double pulse for peak / maximum data point */
  public vibratePeak(): boolean {
    return this.vibrate([30, 40, 50]);
  }

  /** Gentle low pulse for low / minimum data point */
  public vibrateLow(): boolean {
    return this.vibrate([60, 40, 20]);
  }
}

export const hapticManager = new HapticManager();
