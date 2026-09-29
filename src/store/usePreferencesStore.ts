import { create } from 'zustand';
import { speechEngine } from '../utils/speechEngine';
import { soundEffects } from '../utils/soundEffects';

export type ThemeMode = 'teal-cream' | 'liquid-glass' | 'dark' | 'high-contrast';
export type TextScale = 100 | 125 | 150 | 175 | 200;

interface PreferencesState {
  theme: ThemeMode;
  fontSize: TextScale;
  lineHeight: 'normal' | 'relaxed' | 'loose';
  letterSpacing: 'normal' | 'wide' | 'wider';
  dyslexicFont: boolean;
  ttsEnabled: boolean;
  ttsRate: number;
  ttsPitch: number;
  ttsVoice: string;
  autoReadOnNavigate: boolean;
  soundEffectsEnabled: boolean;
  audioFeedbackEnabled: boolean;
  earconsEnabled: boolean;
  hapticEnabled: boolean;
  acousticStagingEnabled: boolean;
  a11yDebugMode: boolean;

  // Actions
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (fontSize: TextScale) => void;
  setLineHeight: (lineHeight: 'normal' | 'relaxed' | 'loose') => void;
  setLetterSpacing: (letterSpacing: 'normal' | 'wide' | 'wider') => void;
  setDyslexicFont: (enabled: boolean) => void;
  setTtsEnabled: (enabled: boolean) => void;
  setTtsRate: (rate: number) => void;
  setTtsPitch: (pitch: number) => void;
  setTtsVoice: (voice: string) => void;
  setAutoReadOnNavigate: (enabled: boolean) => void;
  setSoundEffectsEnabled: (enabled: boolean) => void;
  setAudioFeedbackEnabled: (enabled: boolean) => void;
  setEarconsEnabled: (enabled: boolean) => void;
  setHapticEnabled: (enabled: boolean) => void;
  setAcousticStagingEnabled: (enabled: boolean) => void;
  setA11yDebugMode: (enabled: boolean) => void;
  applyToDOM: () => void;
}

const STORAGE_KEY = 'dristix_a11y_prefs_v1';

function getInitialState(): Partial<PreferencesState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return {};
}

export const usePreferencesStore = create<PreferencesState>((set, get) => {
  const initial = getInitialState();

  // Migrate old theme IDs to new scheme
  const rawTheme = initial.theme as string | undefined;
  const migratedTheme: ThemeMode = (
    rawTheme === 'dark-hc' ? 'dark' :
    rawTheme === 'light-hc' ? 'teal-cream' :
    rawTheme === 'yellow-black' ? 'high-contrast' :
    rawTheme === 'cream-dark' ? 'teal-cream' :
    (rawTheme as ThemeMode) || 'teal-cream'
  );
  const theme = (['teal-cream','liquid-glass','dark','high-contrast'] as ThemeMode[]).includes(migratedTheme)
    ? migratedTheme
    : 'teal-cream';
  const fontSize = initial.fontSize || 100;
  const ttsEnabled = initial.ttsEnabled !== undefined ? initial.ttsEnabled : true;
  const ttsRate = initial.ttsRate || 1.0;
  const ttsPitch = initial.ttsPitch || 1.0;
  const soundEffectsEnabled = initial.soundEffectsEnabled !== undefined ? initial.soundEffectsEnabled : true;
  const audioFeedbackEnabled = initial.audioFeedbackEnabled !== undefined ? initial.audioFeedbackEnabled : true;
  const earconsEnabled = initial.earconsEnabled !== undefined ? initial.earconsEnabled : soundEffectsEnabled;
  const hapticEnabled = initial.hapticEnabled !== undefined ? initial.hapticEnabled : true;
  const acousticStagingEnabled = initial.acousticStagingEnabled !== undefined ? initial.acousticStagingEnabled : true;
  const a11yDebugMode = initial.a11yDebugMode !== undefined ? initial.a11yDebugMode : false;
  const autoReadOnNavigate = initial.autoReadOnNavigate !== undefined ? initial.autoReadOnNavigate : true;

  // Sync external engines
  speechEngine.enabled = ttsEnabled;
  speechEngine.rate = ttsRate;
  speechEngine.pitch = ttsPitch;
  speechEngine.selectedVoiceURI = initial.ttsVoice || '';
  soundEffects.enabled = soundEffectsEnabled && audioFeedbackEnabled && earconsEnabled;

  const saveState = (updated: Partial<PreferencesState>) => {
    try {
      const current = get();
      const payload = {
        theme: updated.theme ?? current.theme,
        fontSize: updated.fontSize ?? current.fontSize,
        lineHeight: updated.lineHeight ?? current.lineHeight,
        letterSpacing: updated.letterSpacing ?? current.letterSpacing,
        dyslexicFont: updated.dyslexicFont ?? current.dyslexicFont,
        ttsEnabled: updated.ttsEnabled ?? current.ttsEnabled,
        ttsRate: updated.ttsRate ?? current.ttsRate,
        ttsPitch: updated.ttsPitch ?? current.ttsPitch,
        ttsVoice: updated.ttsVoice ?? current.ttsVoice,
        autoReadOnNavigate: updated.autoReadOnNavigate ?? current.autoReadOnNavigate,
        soundEffectsEnabled: updated.soundEffectsEnabled ?? current.soundEffectsEnabled,
        audioFeedbackEnabled: updated.audioFeedbackEnabled ?? current.audioFeedbackEnabled,
        earconsEnabled: updated.earconsEnabled ?? current.earconsEnabled,
        hapticEnabled: updated.hapticEnabled ?? current.hapticEnabled,
        acousticStagingEnabled: updated.acousticStagingEnabled ?? current.acousticStagingEnabled,
        a11yDebugMode: updated.a11yDebugMode ?? current.a11yDebugMode,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  };

  const applyDOMStyles = () => {
    if (typeof document === 'undefined') return;
    const { theme, fontSize, dyslexicFont } = get();

    // Set data-theme on both root and body for resilient CSS selector matching
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);

    // Sync Tailwind darkMode class and native color-scheme
    const isDark = theme === 'dark' || theme === 'high-contrast';
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }

    document.documentElement.style.setProperty('--font-scale', `${fontSize / 100}`);

    if (dyslexicFont) {
      document.body.classList.add('font-accessible');
    } else {
      document.body.classList.remove('font-accessible');
    }
  };

  return {
    theme,
    fontSize,
    lineHeight: initial.lineHeight || 'normal',
    letterSpacing: initial.letterSpacing || 'normal',
    dyslexicFont: initial.dyslexicFont || false,
    ttsEnabled,
    ttsRate,
    ttsPitch,
    ttsVoice: initial.ttsVoice || '',
    autoReadOnNavigate,
    soundEffectsEnabled,
    audioFeedbackEnabled,
    earconsEnabled,
    hapticEnabled,
    acousticStagingEnabled,
    a11yDebugMode,

    setTheme: (theme) => {
      set({ theme });
      saveState({ theme });
      get().applyToDOM();
    },

    setFontSize: (fontSize) => {
      set({ fontSize });
      saveState({ fontSize });
      get().applyToDOM();
    },

    setLineHeight: (lineHeight) => {
      set({ lineHeight });
      saveState({ lineHeight });
    },

    setLetterSpacing: (letterSpacing) => {
      set({ letterSpacing });
      saveState({ letterSpacing });
    },

    setDyslexicFont: (dyslexicFont) => {
      set({ dyslexicFont });
      saveState({ dyslexicFont });
      get().applyToDOM();
    },

    setTtsEnabled: (ttsEnabled) => {
      speechEngine.enabled = ttsEnabled;
      if (!ttsEnabled) speechEngine.stop();
      set({ ttsEnabled });
      saveState({ ttsEnabled });
    },

    setTtsRate: (ttsRate) => {
      speechEngine.rate = ttsRate;
      set({ ttsRate });
      saveState({ ttsRate });
    },

    setTtsPitch: (ttsPitch) => {
      speechEngine.pitch = ttsPitch;
      set({ ttsPitch });
      saveState({ ttsPitch });
    },

    setTtsVoice: (ttsVoice) => {
      speechEngine.selectedVoiceURI = ttsVoice;
      set({ ttsVoice });
      saveState({ ttsVoice });
    },

    setAutoReadOnNavigate: (autoReadOnNavigate) => {
      set({ autoReadOnNavigate });
      saveState({ autoReadOnNavigate });
    },

    setSoundEffectsEnabled: (soundEffectsEnabled) => {
      soundEffects.enabled = soundEffectsEnabled;
      set({ soundEffectsEnabled, earconsEnabled: soundEffectsEnabled });
      saveState({ soundEffectsEnabled, earconsEnabled: soundEffectsEnabled });
    },

    setAudioFeedbackEnabled: (audioFeedbackEnabled) => {
      set({ audioFeedbackEnabled });
      saveState({ audioFeedbackEnabled });
    },

    setEarconsEnabled: (earconsEnabled) => {
      set({ earconsEnabled, soundEffectsEnabled: earconsEnabled });
      soundEffects.enabled = earconsEnabled;
      saveState({ earconsEnabled, soundEffectsEnabled: earconsEnabled });
    },

    setHapticEnabled: (hapticEnabled) => {
      set({ hapticEnabled });
      saveState({ hapticEnabled });
    },

    setAcousticStagingEnabled: (acousticStagingEnabled) => {
      set({ acousticStagingEnabled });
      saveState({ acousticStagingEnabled });
    },

    setA11yDebugMode: (a11yDebugMode) => {
      set({ a11yDebugMode });
      saveState({ a11yDebugMode });
    },

    applyToDOM: applyDOMStyles,
  };
});

// Immediately apply theme and font scaling to DOM on startup without waiting for component mount
if (typeof window !== 'undefined') {
  try {
    usePreferencesStore.getState().applyToDOM();
  } catch {
    // Failsafe for SSR or test environments
  }
}
