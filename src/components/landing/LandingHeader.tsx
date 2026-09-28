import React from 'react';
import { Volume2, VolumeX, Contrast, Type, Settings, ArrowRight } from 'lucide-react';
import {
  usePreferencesStore,
  type ThemeMode,
  type TextScale,
} from '../../store/usePreferencesStore';
import { useAnnouncerStore } from '../../store/useAnnouncerStore';
import { useExamStore } from '../../store/useExamStore';

interface LandingHeaderProps {
  onSignIn: () => void;
  onRegister: () => void;
}

/** Page order, so the nav reads exactly as the page scrolls. */
const NAV_ITEMS = [
  { label: 'Home', href: '#top' },
  { label: 'Features', href: '#features' },
  { label: 'Exams', href: '#exams' },
  { label: 'Why DristiX', href: '#why' },
] as const;

const THEME_ORDER: ThemeMode[] = ['light-hc', 'dark-hc', 'yellow-black', 'cream-dark'];

const THEME_NAMES: Record<ThemeMode, string> = {
  'light-hc': 'high contrast light',
  'dark-hc': 'high contrast dark',
  'yellow-black': 'yellow on black',
  'cream-dark': 'warm sepia',
};

const TEXT_SIZES: TextScale[] = [100, 125, 150, 175, 200];

const say = (message: string) =>
  useAnnouncerStore.getState().announce(message, 'polite', true);

/**
 * The landing control bar.
 *
 * Every control is a real preference, not a decorative icon: this is a product
 * for candidates who may need large type, a different contrast theme or spoken
 * output *before* they ever reach a form, and making them sign in first to get
 * them would be exactly the barrier the product removes.
 */
export const LandingHeader: React.FC<LandingHeaderProps> = ({ onSignIn, onRegister }) => {
  const { theme, setTheme, fontSize, setFontSize, ttsEnabled, setTtsEnabled } =
    usePreferencesStore();

  const cycleTheme = () => {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
    setTheme(next);
    say(`Colour theme: ${THEME_NAMES[next]}.`);
  };

  const cycleTextSize = () => {
    const next = TEXT_SIZES[(TEXT_SIZES.indexOf(fontSize) + 1) % TEXT_SIZES.length];
    setFontSize(next);
    say(`Text size: ${next} percent.`);
  };

  const toggleTts = () => {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    // Announced after the engine is switched, so turning it on is confirmed
    // aloud and turning it off is confirmed on screen only.
    useAnnouncerStore
      .getState()
      .announce(next ? 'Spoken output enabled.' : 'Spoken output disabled.', 'polite', next);
  };

  const controlClass =
    'h-10 w-10 shrink-0 grid place-items-center rounded-xl border-2 border-theme-border bg-theme-bg text-theme-text transition-all duration-200 hover:bg-theme-surface-elevated hover:border-theme-primary hover:scale-105 active:scale-95 shadow-sm';
  const controlKbd =
    'absolute -bottom-1.5 -right-1.5 px-1 rounded bg-theme-surface-elevated border border-theme-border text-[10px] font-black leading-tight hidden sm:block shadow-xs';

  return (
    <header role="banner" className="sticky top-0 z-40 dx-glass border-b-2 border-theme-border/70 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        {/* Brand */}
        <a
          href="#top"
          className="order-1 flex items-center gap-3 rounded-lg shrink-0 no-underline group"
        >
          <span
            aria-hidden="true"
            className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-theme-primary text-theme-primary-text font-black text-sm shadow-md group-hover:scale-105 transition-transform"
          >
            DX
          </span>
          <span className="leading-tight">
            <span className="block font-black text-xl text-theme-text tracking-tight group-hover:text-theme-primary transition-colors">
              DristiX
            </span>
            <span className="block text-xs font-semibold text-theme-text-secondary">
              Accessible Examination &amp; Practice Portal
            </span>
          </span>
        </a>

        {/* Controls + account actions */}
        <div className="order-2 lg:order-3 ml-auto flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2" role="group" aria-label="Accessibility controls">
            <div className="relative">
              <button
                type="button"
                onClick={toggleTts}
                aria-pressed={ttsEnabled}
                title={ttsEnabled ? 'Spoken output is on. Turn off.' : 'Spoken output is off. Turn on.'}
                aria-label={
                  ttsEnabled
                    ? 'Spoken output is on. Activate to turn it off.'
                    : 'Spoken output is off. Activate to turn it on.'
                }
                className={`${controlClass} ${
                  ttsEnabled ? 'bg-theme-primary text-theme-primary-text border-theme-primary' : ''
                }`}
              >
                {ttsEnabled ? (
                  <Volume2 className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <VolumeX className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
            </div>

            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={cycleTheme}
                title={`Colour theme: ${THEME_NAMES[theme]}. Activate for the next theme.`}
                aria-label={`Colour theme is ${THEME_NAMES[theme]}. Activate to change it.`}
                className={`${controlClass} hidden sm:grid`}
              >
                <Contrast className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={cycleTextSize}
                title={`Text size: ${fontSize} percent. Activate for the next size.`}
                aria-label={`Text size is ${fontSize} percent. Activate to increase it.`}
                className={`${controlClass} font-black text-sm hidden sm:grid`}
              >
                <Type className="w-5 h-5" aria-hidden="true" />
                <span className="sr-only">Text size</span>
              </button>
              <span aria-hidden="true" className={controlKbd}>
                {fontSize}%
              </span>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => useExamStore.getState().setSettingsOpen(true)}
                title="Full accessibility settings"
                aria-label="Open full accessibility settings"
                className={controlClass}
              >
                <Settings className="w-5 h-5" aria-hidden="true" />
              </button>
              <span aria-hidden="true" className={controlKbd}>
                A
              </span>
            </div>
          </div>

          <div className="hidden sm:block w-px self-stretch bg-theme-border/60" aria-hidden="true" />

          <button
            type="button"
            onClick={onSignIn}
            className="h-10 px-4 rounded-xl border-2 border-theme-border bg-theme-bg font-extrabold text-sm text-theme-text hover:bg-theme-surface-elevated hover:border-theme-primary/50 transition-all duration-200 active:scale-95 shadow-sm"
          >
            Login
          </button>
          <button
            type="button"
            onClick={onRegister}
            className="h-10 px-5 rounded-xl bg-theme-primary text-theme-primary-text font-extrabold text-sm hover:brightness-110 active:scale-95 transition-all duration-200 shadow-md flex items-center gap-2"
          >
            Sign Up
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        </div>

        {/* Primary navigation */}
        <nav
          aria-label="Primary"
          className="order-3 lg:order-2 w-full lg:w-auto lg:mx-auto -mt-1 lg:mt-0"
        >
          <ul className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 list-none m-0 p-0">
            {NAV_ITEMS.map((item) => (
              <li key={item.href} className="shrink-0">
                <a
                  href={item.href}
                  className="block px-3.5 py-1.5 rounded-xl text-sm font-extrabold text-theme-text no-underline hover:bg-theme-surface-elevated hover:text-theme-primary transition-all duration-150"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
};
