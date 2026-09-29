import { usePreferencesStore } from '../store/usePreferencesStore';
import { acousticManager } from './audio/AcousticManager';
import { earconManager } from './audio/EarconManager';
import { hapticManager } from './haptic/HapticManager';
import {
  accessibilityEventBus,
  dispatchAccessibilityEvent,
} from './events/AccessibilityEventBus';
import type { EarconType, SpeakOptions } from './audio/AudioTypes';
import type {
  AccessibilityEvent,
  AccessibilityEventType,
  AcousticPriority,
} from './events/AccessibilityEvents';

/**
 * Custom React hook exposing full access to the DristiX Accessibility Architecture.
 */
export function useAccessibility() {
  const preferences = usePreferencesStore();

  return {
    // Event System
    dispatchAccessibilityEvent: <T extends AccessibilityEventType>(
      type: T,
      payload: AccessibilityEvent<T>['payload'],
      priority?: AcousticPriority
    ) => dispatchAccessibilityEvent(type, payload, priority),

    subscribeToEvent: <T extends AccessibilityEventType>(
      type: T,
      listener: (event: AccessibilityEvent<T>) => void
    ) => accessibilityEventBus.subscribe(type, listener),

    // Acoustic Engine
    speak: (options: SpeakOptions) => acousticManager.speak(options),
    stopSpeech: () => acousticManager.stopSpeech(),
    pauseSpeech: () => acousticManager.pauseSpeech(),
    resumeSpeech: () => acousticManager.resumeSpeech(),
    isSpeaking: () => acousticManager.isSpeaking(),

    // Earcon System
    playEarcon: (type: EarconType) => earconManager.playEarcon(type),

    // Haptic Feedback Engine
    vibrate: (pattern: number | number[]) => hapticManager.vibrate(pattern),
    isHapticSupported: hapticManager.isSupported(),

    // Accessibility Preferences
    settings: {
      audioFeedbackEnabled: preferences.audioFeedbackEnabled ?? true,
      earconsEnabled: preferences.earconsEnabled ?? preferences.soundEffectsEnabled ?? true,
      hapticEnabled: preferences.hapticEnabled ?? true,
      acousticStagingEnabled: preferences.acousticStagingEnabled ?? true,
      speechEnabled: preferences.ttsEnabled ?? true,
      a11yDebugMode: preferences.a11yDebugMode ?? false,
    },
  };
}
