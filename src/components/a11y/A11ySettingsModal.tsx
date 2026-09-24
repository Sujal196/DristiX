import React, { useEffect, useRef } from 'react';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import type { ThemeMode, TextScale } from '../../store/usePreferencesStore';
import { useExamStore } from '../../store/useExamStore';
import { speechEngine } from '../../utils/speechEngine';
import { soundEffects } from '../../utils/soundEffects';
import { useAnnouncerStore } from '../../store/useAnnouncerStore';
import { geminiVoiceService } from '../../utils/geminiVoiceService';
import { X, Sun, Volume2, Type, Sliders, Bell, Keyboard, Sparkles, Key } from 'lucide-react';

export const A11ySettingsModal: React.FC = () => {
  const {
    theme,
    fontSize,
    dyslexicFont,
    ttsEnabled,
    ttsRate,
    ttsPitch,
    ttsVoice,
    autoReadOnNavigate,
    soundEffectsEnabled,
    setTheme,
    setFontSize,
    setDyslexicFont,
    setTtsEnabled,
    setTtsRate,
    setTtsPitch,
    setTtsVoice,
    setAutoReadOnNavigate,
    setSoundEffectsEnabled,
  } = usePreferencesStore();

  const { isSettingsOpen, setSettingsOpen } = useExamStore();
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const doneButtonRef = useRef<HTMLButtonElement>(null);

  const themeButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const fontButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const themes: Array<{ id: ThemeMode; label: string; desc: string; icon: string }> = [
    {
      id: 'dark-hc',
      label: 'High-Contrast Dark',
      desc: 'Midnight Obsidian (#090D16), Pure Light Text, Yellow Focus Ring',
      icon: '🌙',
    },
    {
      id: 'light-hc',
      label: 'High-Contrast Light',
      desc: 'Clean White (#FFFFFF), Deep Charcoal Text, 17.5:1 ratio',
      icon: '☀️',
    },
    {
      id: 'yellow-black',
      label: 'Yellow on Black',
      desc: 'Pitch Black (#000000), Electric Yellow (#FFFF00), 19.5:1 ratio',
      icon: '⚡',
    },
    {
      id: 'cream-dark',
      label: 'Warm Cream / Sepia',
      desc: 'Soothing Cream (#FFFBEB), Dark Amber Text, Reduced Glare',
      icon: '📜',
    },
  ];

  const fontSizes: TextScale[] = [100, 125, 150, 175, 200];

  // Initial focus and voice speech announcement
  useEffect(() => {
    if (isSettingsOpen) {
      setTimeout(() => {
        const activeThemeIdx = themes.findIndex((t) => t.id === theme);
        if (activeThemeIdx >= 0 && themeButtonRefs.current[activeThemeIdx]) {
          themeButtonRefs.current[activeThemeIdx]?.focus();
        } else {
          closeButtonRef.current?.focus();
        }
      }, 60);

      useAnnouncerStore
        .getState()
        .announce(
          'Accessibility Preferences modal opened. Use Tab or Arrow keys to navigate between themes, text scaling, speech, and sound settings. Press Escape to close.',
          'assertive',
          true,
          true
        );
    }
  }, [isSettingsOpen]);

  // Full Keyboard Trap & Navigation Handler (Tab, Shift+Tab, Escape)
  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setSettingsOpen(false);
      soundEffects.playSelect();
      return;
    }

    if (e.key === 'Tab') {
      const container = modalContainerRef.current;
      if (!container) return;

      const focusableElements = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;

      const firstEl = focusableElements[0];
      const lastEl = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  };

  // Arrow Key Navigation for Themes (WCAG Radiogroup pattern + Direct number keys 1-4)
  const handleThemeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const currentIndex = themes.findIndex((t) => t.id === theme);
    let nextIndex = -1;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % themes.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + themes.length) % themes.length;
    } else if (e.key >= '1' && e.key <= '4') {
      e.preventDefault();
      nextIndex = parseInt(e.key, 10) - 1;
    }

    if (nextIndex >= 0 && nextIndex < themes.length) {
      const selected = themes[nextIndex];
      setTheme(selected.id);
      themeButtonRefs.current[nextIndex]?.focus();
      soundEffects.playSelect();
      useAnnouncerStore
        .getState()
        .announce(`Theme changed to ${selected.label}.`, 'assertive', true);
    }
  };

  // Arrow Key Navigation for Text Scaling
  const handleFontKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const currentIndex = fontSizes.indexOf(fontSize);
    let nextIndex = -1;

    if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === '+') {
      e.preventDefault();
      nextIndex = Math.min(currentIndex + 1, fontSizes.length - 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === '-') {
      e.preventDefault();
      nextIndex = Math.max(currentIndex - 1, 0);
    }

    if (nextIndex >= 0 && nextIndex !== currentIndex) {
      const newScale = fontSizes[nextIndex];
      setFontSize(newScale);
      fontButtonRefs.current[nextIndex]?.focus();
      soundEffects.playSelect();
      useAnnouncerStore
        .getState()
        .announce(`Text scale adjusted to ${newScale} percent.`, 'assertive', true);
    }
  };

  if (!isSettingsOpen) return null;

  const voices = speechEngine.getVoices();

  const handleTestSpeech = () => {
    soundEffects.unlock();
    useAnnouncerStore
      .getState()
      .announce(
        `Testing speech synthesis at rate ${ttsRate.toFixed(1)} and pitch ${ttsPitch.toFixed(1)}. WCAG Level AA compliant.`,
        'assertive',
        true
      );
  };

  const handleTestEarcon = () => {
    soundEffects.unlock();
    soundEffects.playMark();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-settings-title"
      onKeyDown={handleModalKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs"
    >
      <div
        ref={modalContainerRef}
        className="w-full max-w-2xl max-h-[92vh] bg-theme-surface border-2 border-theme-border rounded-2xl shadow-2xl flex flex-col overflow-hidden text-theme-text transition-colors"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b-2 border-theme-border flex justify-between items-center bg-theme-bg">
          <div className="flex items-center gap-2">
            <Sliders className="w-6 h-6 text-yellow-400" aria-hidden="true" />
            <h2 id="a11y-settings-title" className="text-xl font-bold tracking-tight">
              Accessibility Preferences
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setSettingsOpen(false)}
            aria-label="Close accessibility settings (Esc)"
            className="p-2 rounded-xl border-2 border-theme-border hover:bg-theme-surface transition focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Helpful Keyboard Instructions Banner */}
        <div
          role="note"
          aria-label="Keyboard Shortcuts"
          className="px-4 py-2.5 bg-yellow-500/10 border-b border-theme-border flex items-center gap-2 text-xs font-semibold text-theme-text"
        >
          <Keyboard className="w-4 h-4 text-yellow-400 shrink-0" aria-hidden="true" />
          <span>
            <strong>Keyboard Navigation:</strong> Use <strong>Tab</strong> to move between sections,{' '}
            <strong>Arrow keys (← ↑ → ↓)</strong> to pick themes & text size, <strong>Space</strong> to toggle, and{' '}
            <strong>Esc</strong> to close.
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* 1. Dynamic Contrast Theme */}
          <section aria-labelledby="theme-heading">
            <h3 id="theme-heading" className="text-base font-bold mb-2 flex items-center gap-2">
              <Sun className="w-4 h-4 text-yellow-400" aria-hidden="true" />
              <span>1. Dynamic Contrast Themes (WCAG 2.1 AA Compliant)</span>
            </h3>
            <p className="text-xs text-theme-text/70 mb-3">
              Use Arrow keys (Left/Right or Up/Down) or keys 1–4 to immediately switch theme.
            </p>

            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              role="radiogroup"
              aria-label="High Contrast Themes"
              onKeyDown={handleThemeKeyDown}
            >
              {themes.map((t, idx) => {
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    ref={(el) => {
                      themeButtonRefs.current[idx] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => {
                      setTheme(t.id);
                      soundEffects.playSelect();
                      useAnnouncerStore
                        .getState()
                        .announce(`Theme changed to ${t.label}.`, 'assertive', true);
                    }}
                    className={`p-3.5 rounded-xl border-2 text-left transition flex flex-col gap-1 focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400 ${
                      isSelected
                        ? 'border-yellow-400 ring-2 ring-yellow-400/50 bg-theme-bg font-bold shadow-md'
                        : 'border-theme-border bg-theme-surface hover:bg-theme-bg/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold flex items-center gap-1.5">
                        <span aria-hidden="true">{t.icon}</span>
                        <span>{t.label}</span>
                      </span>
                      {isSelected && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-yellow-400 text-black font-black uppercase tracking-wider">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-theme-text/70 leading-snug">
                      {t.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. Text Resizing & Font Scaling */}
          <section aria-labelledby="text-size-heading" className="pt-4 border-t border-theme-border">
            <div className="flex justify-between items-center mb-2">
              <h3 id="text-size-heading" className="text-base font-bold flex items-center gap-2">
                <Type className="w-4 h-4 text-yellow-400" aria-hidden="true" />
                <span>2. Text & UI Scaling (No Horizontal Scroll Overflow)</span>
              </h3>
              <span className="text-sm font-mono font-bold px-2 py-1 rounded-lg bg-theme-bg border-2 border-theme-border">
                {fontSize}%
              </span>
            </div>
            <p className="text-xs text-theme-text/70 mb-3">
              Use Arrow keys (Left/Right) or + / - keys to increase or decrease magnification.
            </p>

            <div
              className="grid grid-cols-5 gap-2"
              role="radiogroup"
              aria-label="Text scale factor"
              onKeyDown={handleFontKeyDown}
            >
              {fontSizes.map((scale, idx) => {
                const isSelected = fontSize === scale;
                return (
                  <button
                    key={scale}
                    ref={(el) => {
                      fontButtonRefs.current[idx] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => {
                      setFontSize(scale);
                      soundEffects.playSelect();
                      useAnnouncerStore
                        .getState()
                        .announce(`Text scale set to ${scale} percent.`, 'assertive', true);
                    }}
                    className={`py-2 px-1 text-center rounded-xl border-2 text-sm sm:text-base font-bold transition focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400 ${
                      isSelected
                        ? 'border-yellow-400 bg-yellow-400 text-black shadow-md'
                        : 'border-theme-border bg-theme-bg text-theme-text hover:bg-theme-surface'
                    }`}
                  >
                    {scale}%
                  </button>
                );
              })}
            </div>

            {/* Dyslexia / Hyper-legible toggle */}
            <div className="mt-4">
              <label className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-theme-border bg-theme-bg cursor-pointer hover:border-yellow-400/60 focus-within:ring-4 focus-within:ring-yellow-400 focus-within:border-yellow-400 transition">
                <input
                  type="checkbox"
                  checked={dyslexicFont}
                  onChange={(e) => {
                    setDyslexicFont(e.target.checked);
                    soundEffects.playSelect();
                    useAnnouncerStore
                      .getState()
                      .announce(
                        e.target.checked
                          ? 'Enhanced spacing and line height enabled.'
                          : 'Enhanced spacing disabled.',
                        'polite'
                      );
                  }}
                  className="w-5 h-5 accent-yellow-400 rounded focus:outline-none"
                />
                <div>
                  <span className="font-bold text-sm sm:text-base block">
                    Enhanced Letter Spacing & Line Height
                  </span>
                  <p className="text-xs text-theme-text/70 mt-0.5">
                    Increases letter spacing (0.05em) and line height (1.8) for low-vision and dyslexic candidates.
                  </p>
                </div>
              </label>
            </div>
          </section>

          {/* 3. Integrated Speech Synthesis (Web Speech API) */}
          <section aria-labelledby="speech-heading" className="pt-4 border-t border-theme-border">
            <h3 id="speech-heading" className="text-base font-bold mb-3 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-yellow-400" aria-hidden="true" />
              <span>3. Integrated Speech Synthesis (Web Speech API Engine)</span>
            </h3>

            <div className="space-y-4">
              <label className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-theme-border bg-theme-bg cursor-pointer hover:border-yellow-400/60 focus-within:ring-4 focus-within:ring-yellow-400 focus-within:border-yellow-400 transition">
                <input
                  type="checkbox"
                  checked={ttsEnabled}
                  onChange={(e) => {
                    setTtsEnabled(e.target.checked);
                    soundEffects.playSelect();
                    useAnnouncerStore
                      .getState()
                      .announce(
                        e.target.checked
                          ? 'Built-in Text to Speech enabled.'
                          : 'Built-in Text to Speech disabled.',
                        'polite'
                      );
                  }}
                  className="w-5 h-5 accent-yellow-400 rounded focus:outline-none"
                />
                <div>
                  <span className="font-bold text-sm sm:text-base block">
                    Enable Built-in Text-to-Speech (TTS)
                  </span>
                  <p className="text-xs text-theme-text/70 mt-0.5">
                    Internal reader for users without external screen readers (JAWS/NVDA).
                  </p>
                </div>
              </label>

              {ttsEnabled && (
                <div className="p-4 rounded-xl border-2 border-theme-border bg-theme-bg space-y-4">
                  {/* Auto Read on Navigate */}
                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-theme-surface focus-within:ring-4 focus-within:ring-yellow-400">
                    <input
                      type="checkbox"
                      checked={autoReadOnNavigate}
                      onChange={(e) => {
                        setAutoReadOnNavigate(e.target.checked);
                        soundEffects.playSelect();
                      }}
                      className="w-5 h-5 accent-yellow-400 rounded focus:outline-none"
                    />
                    <span className="text-sm font-semibold">
                      Automatically read question upon navigating (Next/Previous)
                    </span>
                  </label>

                  {/* Speech Rate Slider */}
                  <div>
                    <div className="flex justify-between text-xs sm:text-sm font-bold mb-1">
                      <label htmlFor="tts-rate-slider">Speech Rate: {ttsRate.toFixed(1)}x</label>
                      <span className="text-theme-text/70">Range: 0.5x - 2.5x (Use Arrow keys)</span>
                    </div>
                    <input
                      id="tts-rate-slider"
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.1"
                      value={ttsRate}
                      onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                      className="w-full accent-yellow-400 cursor-pointer focus:outline-none focus:ring-4 focus:ring-yellow-400 rounded"
                    />
                  </div>

                  {/* Speech Pitch Slider */}
                  <div>
                    <div className="flex justify-between text-xs sm:text-sm font-bold mb-1">
                      <label htmlFor="tts-pitch-slider">Voice Pitch: {ttsPitch.toFixed(1)}</label>
                      <span className="text-theme-text/70">Range: 0.5 - 1.5 (Use Arrow keys)</span>
                    </div>
                    <input
                      id="tts-pitch-slider"
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.1"
                      value={ttsPitch}
                      onChange={(e) => setTtsPitch(parseFloat(e.target.value))}
                      className="w-full accent-yellow-400 cursor-pointer focus:outline-none focus:ring-4 focus:ring-yellow-400 rounded"
                    />
                  </div>

                  {/* Voice Selector */}
                  {voices.length > 0 && (
                    <div>
                      <label htmlFor="tts-voice-select" className="block text-xs sm:text-sm font-bold mb-1">
                        Select Speech Voice:
                      </label>
                      <select
                        id="tts-voice-select"
                        value={ttsVoice}
                        onChange={(e) => setTtsVoice(e.target.value)}
                        className="w-full p-2.5 rounded-xl border-2 border-theme-border bg-theme-surface text-theme-text font-medium text-sm focus:outline-none focus:ring-4 focus:ring-yellow-400"
                      >
                        <option value="">Default System Voice</option>
                        {voices.map((v) => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="pt-2 flex justify-start">
                    <button
                      type="button"
                      onClick={handleTestSpeech}
                      className="px-4 py-2 font-bold rounded-xl border-2 border-theme-border bg-theme-surface hover:bg-theme-bg text-theme-text text-sm flex items-center gap-1.5 focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400"
                    >
                      <Volume2 className="w-4 h-4 text-yellow-400" aria-hidden="true" />
                      <span>Test Speech Output</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 4. Auditory Cues / Earcons */}
          <section aria-labelledby="sound-heading" className="pt-4 border-t border-theme-border">
            <h3 id="sound-heading" className="text-base font-bold mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4 text-yellow-400" aria-hidden="true" />
              <span>4. Non-Speech Auditory Cues (Earcons)</span>
            </h3>

            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border-2 border-theme-border bg-theme-bg focus-within:ring-4 focus-within:ring-yellow-400">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={soundEffectsEnabled}
                  onChange={(e) => {
                    setSoundEffectsEnabled(e.target.checked);
                    soundEffects.playSelect();
                  }}
                  className="w-5 h-5 accent-yellow-400 rounded focus:outline-none"
                />
                <div>
                  <span className="font-bold text-sm sm:text-base block">Auditory feedback tones</span>
                  <p className="text-xs text-theme-text/70 mt-0.5">
                    Subtle tones when options are selected, questions marked, and timer warnings fire.
                  </p>
                </div>
              </label>

              {soundEffectsEnabled && (
                <button
                  type="button"
                  onClick={handleTestEarcon}
                  className="px-3 py-1.5 font-bold rounded-lg border-2 border-theme-border bg-theme-surface hover:bg-theme-bg text-theme-text text-xs focus:outline-none focus:ring-4 focus:ring-yellow-400"
                >
                  Play Sample Tone
                </button>
              )}
            </div>
          </section>

          {/* 5. AI Voice Assistant & Gemini API */}
          {/* 5. AI Voice Assistant & Gemini/Groq Dual API Engine */}
          <section aria-labelledby="ai-heading" className="pt-4 border-t border-theme-border">
            <h3 id="ai-heading" className="text-base font-bold mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-400" aria-hidden="true" />
                <span>5. AI Dual Engine (Google Gemini + Groq LLaMA)</span>
              </span>
              <div className="flex items-center gap-1.5">
                {geminiVoiceService.getApiKey() && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                    Gemini 1st
                  </span>
                )}
                {geminiVoiceService.getGroqApiKey() && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold">
                    ⚡ Groq Active Fallback
                  </span>
                )}
              </div>
            </h3>

            <div className="p-4 rounded-xl border-2 border-theme-border bg-theme-bg space-y-4">
              <p className="text-xs text-theme-text/80 leading-relaxed">
                DristiX uses a resilient Dual-Engine architecture: it queries <strong>Google Gemini</strong> first. If Google API is slow, rate-limited, or fails, it instantaneously fails over to ultra-high-speed <strong>Groq LLaMA 3.3</strong>.
              </p>

              {/* Gemini Key Input */}
              <div className="space-y-1">
                <label htmlFor="gemini-key-input" className="text-[11px] font-bold text-theme-text/70">
                  Primary: Google Gemini API Key
                </label>
                <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                  <div className="relative flex-1">
                    <Key className="w-4 h-4 text-theme-text/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      defaultValue={geminiVoiceService.getApiKey()}
                      placeholder="Enter Google AI Studio Gemini API Key..."
                      id="gemini-key-input"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-theme-border bg-theme-surface text-theme-text text-xs focus:outline-none focus:ring-4 focus:ring-yellow-400 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('gemini-key-input') as HTMLInputElement;
                      if (el) {
                        geminiVoiceService.setApiKey(el.value);
                        soundEffects.playSelect();
                        useAnnouncerStore
                          .getState()
                          .announce('Gemini API Key preference updated.', 'assertive', true);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-theme-primary text-theme-primary-text font-bold text-xs hover:bg-theme-primary-hover transition shrink-0 focus:outline-none focus:ring-4 focus:ring-yellow-400"
                  >
                    Save Gemini
                  </button>
                </div>
              </div>

              {/* Groq Key Input */}
              <div className="space-y-1">
                <label htmlFor="groq-key-input" className="text-[11px] font-bold text-theme-text/70 flex items-center justify-between">
                  <span>Failover: Groq Cloud API Key (Pre-configured)</span>
                  <span className="text-[10px] text-cyan-400 font-normal">Lightning-fast 500 T/s</span>
                </label>
                <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                  <div className="relative flex-1">
                    <Key className="w-4 h-4 text-theme-text/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      defaultValue={geminiVoiceService.getGroqApiKey()}
                      placeholder="Enter Groq API Key (gsk_...)"
                      id="groq-key-input"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-theme-border bg-theme-surface text-theme-text text-xs focus:outline-none focus:ring-4 focus:ring-yellow-400 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('groq-key-input') as HTMLInputElement;
                      if (el) {
                        geminiVoiceService.setGroqApiKey(el.value);
                        soundEffects.playSelect();
                        useAnnouncerStore
                          .getState()
                          .announce('Groq Failover API Key saved.', 'assertive', true);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-theme-primary text-theme-primary-text font-bold text-xs hover:bg-theme-primary-hover transition shrink-0 focus:outline-none focus:ring-4 focus:ring-yellow-400"
                  >
                    Save Groq
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t-2 border-theme-border bg-theme-bg flex justify-end">
          <button
            ref={doneButtonRef}
            type="button"
            onClick={() => {
              setSettingsOpen(false);
              soundEffects.playSelect();
            }}
            className="px-6 py-2.5 font-bold rounded-xl border-2 border-theme-border bg-theme-primary text-theme-primary-text hover:bg-theme-primary-hover shadow-md focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400"
          >
            Done & Save Preferences (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
