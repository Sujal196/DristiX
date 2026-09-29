import type {
  AccessibilityEvent,
  AccessibilityEventType,
  AcousticPriority,
} from './AccessibilityEvents';
import { acousticManager } from '../audio/AcousticManager';
import { hapticManager } from '../haptic/HapticManager';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import { useAnnouncerStore } from '../../store/useAnnouncerStore';
import { getA11yDictionary } from '../i18n/a11yDictionary';

type EventListener<T extends AccessibilityEventType = AccessibilityEventType> = (
  event: AccessibilityEvent<T>
) => void;

/**
 * Central Accessibility Event Bus for DristiX.
 *
 * Implements a decoupled pub/sub pipeline:
 * UI / Store Action -> dispatchAccessibilityEvent() -> Event Bus -> Engine Coordinator
 *
 * Decouples individual components from hardcoding audio/haptic/TTS logic.
 */
class AccessibilityEventBus {
  private listeners: Map<AccessibilityEventType, Set<EventListener<any>>> = new Map();
  private globalListeners: Set<EventListener<any>> = new Set();
  private isCoordinatorInitialized = false;

  constructor() {
    this.initCoordinator();
  }

  /**
   * Subscribes to a specific accessibility event type. Returns unsubscribe function.
   */
  public subscribe<T extends AccessibilityEventType>(
    type: T,
    listener: (event: AccessibilityEvent<T>) => void
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    const set = this.listeners.get(type)!;
    set.add(listener);

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  /**
   * Subscribes to all accessibility events (useful for logging/inspection).
   */
  public subscribeAll(listener: (event: AccessibilityEvent) => void): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  /**
   * Dispatches an event through the accessibility bus.
   */
  public dispatch<T extends AccessibilityEventType>(
    type: T,
    payload: AccessibilityEvent<T>['payload'],
    priority?: AcousticPriority
  ): void {
    const event: AccessibilityEvent<T> = {
      type,
      payload,
      timestamp: Date.now(),
      priority: priority ?? 'NORMAL',
    };

    // 1. Notify specific listeners
    const specific = this.listeners.get(type);
    if (specific) {
      specific.forEach((listener) => {
        try {
          listener(event);
        } catch (err) {
          console.warn(`Error in accessibility listener for ${type}:`, err);
        }
      });
    }

    // 2. Notify global listeners
    this.globalListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.warn('Error in global accessibility listener:', err);
      }
    });
  }

  /**
   * Initializes the core sensory coordination engine.
   * Maps each event type to corresponding feedback channels (Earcon + Haptic + Voice).
   */
  private initCoordinator(): void {
    if (this.isCoordinatorInitialized) return;
    this.isCoordinatorInitialized = true;

    this.subscribeAll((event) => {
      const prefs = usePreferencesStore.getState();
      const dict = getA11yDictionary('en-IN');

      let channelSpeech = false;
      let channelEarcon = false;
      let channelHaptic = false;

      switch (event.type) {
        case 'OPTION_SELECTED': {
          const payload = event.payload as AccessibilityEvent<'OPTION_SELECTED'>['payload'];
          acousticManager.playEarcon('OPTION_SELECTED');
          hapticManager.vibrateOptionSelected();
          channelEarcon = true;
          channelHaptic = true;

          // Only speak if explicitly requested or silentSpeech is false
          if (payload.silentSpeech === false) {
            const spokenText = dict.OPTION_SELECTED(payload.optionNumber, payload.optionText);
            acousticManager.speak({
              type: 'OPTION',
              text: spokenText,
              priority: 'NORMAL',
              interrupt: true,
            });
            channelSpeech = true;
          }
          break;
        }

        case 'OPTION_DESELECTED':
        case 'ANSWER_CLEARED': {
          acousticManager.playEarcon('CLEAR_RESPONSE');
          hapticManager.vibrateClearResponse();
          channelEarcon = true;
          channelHaptic = true;
          break;
        }

        case 'ANSWER_CONFIRMED': {
          acousticManager.playEarcon('ANSWER_CONFIRMED');
          hapticManager.vibrateAnswerConfirmed();
          channelEarcon = true;
          channelHaptic = true;
          break;
        }

        case 'MARK_FOR_REVIEW': {
          const payload = event.payload as AccessibilityEvent<'MARK_FOR_REVIEW'>['payload'];
          acousticManager.playEarcon('MARK_REVIEW');
          hapticManager.vibrateMarkReview();
          channelEarcon = true;
          channelHaptic = true;

          const text = payload.isMarked
            ? dict.MARK_REVIEW(payload.questionNumber)
            : dict.UNMARK_REVIEW(payload.questionNumber);
          useAnnouncerStore.getState().announce(text, 'polite', false);
          break;
        }

        case 'UNMARK_REVIEW': {
          acousticManager.playEarcon('MARK_REVIEW');
          hapticManager.vibrateMarkReview();
          channelEarcon = true;
          channelHaptic = true;
          break;
        }

        case 'QUESTION_CHANGED': {
          const payload = event.payload as AccessibilityEvent<'QUESTION_CHANGED'>['payload'];
          acousticManager.playEarcon('QUESTION_CHANGE');
          hapticManager.vibrateQuestionChange();
          channelEarcon = true;
          channelHaptic = true;

          if (payload.autoRead) {
            channelSpeech = true;
          }
          break;
        }

        case 'SECTION_CHANGED': {
          const payload = event.payload as AccessibilityEvent<'SECTION_CHANGED'>['payload'];
          acousticManager.playEarcon('SECTION_CHANGE');
          hapticManager.vibrateSectionChange();
          channelEarcon = true;
          channelHaptic = true;

          const text = dict.SECTION_CHANGED(payload.newSection);
          acousticManager.speak({
            type: 'NAVIGATION',
            text,
            priority: 'HIGH',
            interrupt: true,
          });
          channelSpeech = true;
          break;
        }

        case 'TIMER_WARNING': {
          const payload = event.payload as AccessibilityEvent<'TIMER_WARNING'>['payload'];
          acousticManager.playEarcon('WARNING');
          hapticManager.vibrateWarning();
          channelEarcon = true;
          channelHaptic = true;

          const text = payload.message || dict.TIMER_WARNING(payload.formattedTime);
          acousticManager.speak({
            type: 'WARNING',
            text,
            priority: 'HIGH',
            interrupt: true,
          });
          channelSpeech = true;
          break;
        }

        case 'TIMER_CRITICAL': {
          const payload = event.payload as AccessibilityEvent<'TIMER_CRITICAL'>['payload'];
          acousticManager.playEarcon('WARNING');
          hapticManager.vibrateCritical();
          channelEarcon = true;
          channelHaptic = true;

          const text = payload.message || dict.TIMER_CRITICAL(payload.formattedTime);
          acousticManager.speak({
            type: 'WARNING',
            text,
            priority: 'CRITICAL',
            interrupt: true,
          });
          channelSpeech = true;
          break;
        }

        case 'NAVIGATION_ERROR':
        case 'ACTION_ERROR': {
          const payload = event.payload as AccessibilityEvent<'ACTION_ERROR'>['payload'];
          acousticManager.playEarcon('ERROR');
          hapticManager.vibrateError();
          channelEarcon = true;
          channelHaptic = true;

          if (payload.message) {
            acousticManager.speak({
              type: 'ERROR',
              text: payload.message,
              priority: 'NORMAL',
              interrupt: true,
            });
            channelSpeech = true;
          }
          break;
        }

        case 'ACTION_SUCCESS': {
          const payload = event.payload as AccessibilityEvent<'ACTION_SUCCESS'>['payload'];
          acousticManager.playEarcon('SUCCESS');
          hapticManager.vibrateSuccess();
          channelEarcon = true;
          channelHaptic = true;

          if (payload.message) {
            acousticManager.speak({
              type: 'SUCCESS',
              text: payload.message,
              priority: 'NORMAL',
              interrupt: true,
            });
            channelSpeech = true;
          }
          break;
        }

        case 'FOCUS_CHANGED': {
          acousticManager.playEarcon('FOCUS_CHANGE');
          channelEarcon = true;
          break;
        }
      }

      // Developer A11y Logging Mode
      if (prefs.a11yDebugMode || (typeof window !== 'undefined' && (window as any).__DRISTIX_A11Y_DEBUG__)) {
        console.groupCollapsed(
          `%c[DristiX A11y Event] %c${event.type}`,
          'color: #eab308; font-weight: bold;',
          'color: #38bdf8; font-weight: bold;'
        );
        console.log('Payload:', event.payload);
        console.log('Channels Active:', {
          speech: channelSpeech,
          earcon: channelEarcon,
          haptic: channelHaptic,
        });
        console.log('Timestamp:', new Date(event.timestamp).toISOString());
        console.groupEnd();
      }
    });
  }
}

export const accessibilityEventBus = new AccessibilityEventBus();

/**
 * Universal helper to dispatch an accessibility event.
 */
export function dispatchAccessibilityEvent<T extends AccessibilityEventType>(
  type: T,
  payload: AccessibilityEvent<T>['payload'],
  priority?: AcousticPriority
): void {
  accessibilityEventBus.dispatch(type, payload, priority);
}
