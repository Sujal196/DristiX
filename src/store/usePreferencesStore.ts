import { create } from 'zustand';
import { speechEngine } from '../utils/speechEngine';
import { soundEffects } from '../utils/soundEffects';

export type ThemeMode = 'dark-hc' | 'light-hc' | 'yellow-black' | 'cream-dark';
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

  const theme = initial.theme || 'dark-hc';
  const fontSize = initial.fontSize || 100;
  const ttsEnabled = initial.ttsEnabled !== undefined ? initial.ttsEnabled : true;
  const ttsRate = initial.ttsRate || 1.0;
  const ttsPitch = initial.ttsPitch || 1.0;
  const soundEffectsEnabled = initial.soundEffectsEnabled !== undefined ? initial.soundEffectsEnabled : true;
  const autoReadOnNavigate = initial.autoReadOnNavigate !== undefined ? initial.autoReadOnNavigate : true;

  // Sync external engines
  speechEngine.enabled = ttsEnabled;
  speechEngine.rate = ttsRate;
  speechEngine.pitch = ttsPitch;
  soundEffects.enabled = soundEffectsEnabled;

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
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  };

  const applyDOMStyles = () => {
    if (typeof document === 'undefined') return;
    const { theme, fontSize, dyslexicFont } = get();

    document.documentElement.setAttribute('data-theme', theme);
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
      set({ soundEffectsEnabled });
      saveState({ soundEffectsEnabled });
    },

    applyToDOM: applyDOMStyles,
  };
});
