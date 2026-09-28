import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Ear,
  Keyboard,
  Contrast,
  Languages,
  BarChart3,
  Play,
  Volume2,
} from 'lucide-react';

interface LandingHeroProps {
  onSignIn: () => void;
}

/**
 * Lines the demo speaks, verbatim from the product's own confirmation copy
 * (src/utils/optionSpeech.ts and the catalogue loader). Invented marketing
 * dialogue in the hero would prove nothing; these strings are what a real
 * candidate actually hears.
 */
const DEMO_LINES = [
  'Option 3 selected: 60 degrees. Say "Next question" to continue.',
  'Question 3 of 10. Section: Quantitative Aptitude.',
  '"SSC CGL Tier-1 Comprehensive Mock Test" has been opened successfully!',
];

const TOP_CHIPS = [
  { icon: Ear, label: 'Question Read Aloud' },
  { icon: Keyboard, label: 'Keyboard Navigation' },
  { icon: Contrast, label: 'High Contrast Themes' },
];

const BOTTOM_CHIPS = [
  { icon: Languages, label: 'Multi-language Voice' },
  { icon: BarChart3, label: 'Personalized Progress' },
  { icon: Volume2, label: 'Spoken Confirmations' },
];

const OPTIONS = [
  { key: 'A', text: '60 degrees' },
  { key: 'B', text: '90 degrees' },
  { key: 'C', text: '120 degrees' },
  { key: 'D', text: '180 degrees' },
];

/**
 * Read once at module load. Reduced-motion users get the first confirmation
 * line at rest with no interval at all, so nothing is ever hidden behind an
 * animation that may not run.
 */
const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Hero for the public landing page.
 *
 * The right-hand column is not a picture of the product: it is the product's
 * exam interface rebuilt from the same tokens, with the assistant speaking its
 * real confirmation line underneath. The brief asked for a CSS/SVG visual
 * rather than an asset, and geometry that describes what the software does
 * carries more weight than an illustration of a person using it.
 */
export const LandingHero: React.FC<LandingHeroProps> = ({ onSignIn }) => {
  const [lineIndex, setLineIndex] = useState(0);
  // The first confirmation is on screen before any timer runs, so the panel is
  // never briefly blank.
  const [charCount, setCharCount] = useState(DEMO_LINES[0].length);

  useEffect(() => {
    if (REDUCED_MOTION) return;

    let index = 0;
    let count = DEMO_LINES[0].length;
    let typing = false;
    let hold = 40;

    const tick = window.setInterval(() => {
      if (hold > 0) {
        hold -= 1;
        return;
      }

      const line = DEMO_LINES[index];
      if (typing) {
        count += 1;
        if (count >= line.length) {
          count = line.length;
          typing = false;
          hold = 44; // ~2s to read the finished line
        }
      } else {
        count -= 3;
        if (count <= 0) {
          count = 0;
          typing = true;
          index = (index + 1) % DEMO_LINES.length;
          hold = 10;
        }
      }

      setLineIndex(index);
      setCharCount(count);
    }, 45);

    return () => window.clearInterval(tick);
  }, []);

  const activeLine = DEMO_LINES[lineIndex];
  const visibleLine = activeLine.slice(0, charCount);

  return (
    <section id="top" className="dx-wash dx-hero-ambient border-b-2 border-theme-border/70 overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center relative z-10">
        {/* ---------------- Copy column ---------------- */}
        <div className="max-w-[42rem]">
          <p className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border-2 border-theme-border/80 bg-theme-surface/90 text-xs font-black uppercase tracking-wider text-theme-text shadow-sm backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
            <BadgeCheck className="w-4 h-4 text-theme-primary shrink-0" aria-hidden="true" />
            100% WCAG 2.1 AA Compliant · Designed for Everyone
          </p>

          <h1 className="mt-6 text-4xl sm:text-5xl xl:text-6xl font-black leading-[1.04] tracking-[-0.03em] text-balance text-theme-text">
            Learn. Practice. Achieve.
            <br />
            <span className="text-theme-primary drop-shadow-sm">With No Barriers.</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg leading-relaxed max-w-[68ch] text-theme-text-secondary font-medium">
            DristiX delivers mock tests, practice drills and previous-year papers built for
            candidates who are blind, low-vision or keyboard-only — and for everyone else who
            simply wants a faster exam experience. Every question can be read aloud, every answer
            can be spoken back, and no action on the screen requires a mouse.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSignIn}
              className="h-12 px-7 rounded-xl bg-theme-primary text-theme-primary-text font-black text-base dx-glow-button hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 shadow-md"
            >
              Start Practicing
              <Play className="w-4.5 h-4.5 fill-current" aria-hidden="true" />
            </button>
            <a
              href="#why"
              className="h-12 px-6 rounded-xl border-2 border-theme-border bg-theme-bg font-extrabold text-base text-theme-text hover:bg-theme-surface-elevated hover:border-theme-primary/60 transition-all duration-200 active:scale-95 inline-flex items-center no-underline shadow-sm"
            >
              See how it works
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5 list-none m-0 p-0 text-sm font-bold text-theme-text-secondary">
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-theme-primary/10 grid place-items-center text-theme-primary shrink-0">
                <Keyboard className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              No mouse required
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-theme-primary/10 grid place-items-center text-theme-primary shrink-0">
                <Languages className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              Hindi &amp; English voice replies
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-theme-primary/10 grid place-items-center text-theme-primary shrink-0">
                <Contrast className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              Four contrast themes
            </li>
          </ul>
        </div>

        {/* ---------------- Demonstration column ---------------- */}
        <div className="relative dx-rise">
          <svg
            aria-hidden="true"
            viewBox="0 0 400 320"
            className="hidden sm:block absolute -inset-x-6 -inset-y-8 w-[calc(100%+3rem)] h-[calc(100%+4rem)] pointer-events-none opacity-40"
            preserveAspectRatio="none"
          >
            <path
              d="M6 40 C 120 6, 280 6, 394 44"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              className="dx-wire"
            />
            <path
              d="M6 276 C 120 312, 280 312, 394 272"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              className="dx-wire"
            />
          </svg>

          <div className="relative flex flex-col gap-3.5">
            <ul className="grid grid-cols-3 gap-3 list-none m-0 p-0">
              {TOP_CHIPS.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="dx-chip-card flex items-center justify-center gap-2 px-2 py-2.5 rounded-xl border-2 border-theme-border/80 bg-theme-surface/90 text-center shadow-sm backdrop-blur-xs"
                >
                  <Icon className="w-4 h-4 shrink-0 text-theme-primary" aria-hidden="true" />
                  <span className="text-xs font-extrabold leading-tight text-theme-text">
                    {label}
                  </span>
                </li>
              ))}
            </ul>

            {/* The exam interface, rebuilt from the app's own tokens. */}
            <div className="dx-hero-card rounded-2xl border-2 border-theme-border/90 bg-theme-surface shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b-2 border-theme-border bg-theme-surface-elevated/90">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                  <span className="text-xs font-black uppercase tracking-wider text-theme-text-secondary">
                    SSC-CGL · Mock 01
                  </span>
                </div>
                <span
                  className="px-2.5 py-1 rounded-lg border-2 border-theme-border bg-theme-bg text-xs font-black tabular-nums text-theme-text shadow-xs"
                  aria-hidden="true"
                >
                  ⏱️ 00:42:18
                </span>
              </div>

              <div className="px-4 sm:px-5 pt-4 pb-3">
                <div className="flex items-center justify-between gap-3 text-xs font-extrabold text-theme-text-secondary">
                  <span>Question 3 of 10</span>
                  <span className="px-2 py-0.5 rounded bg-theme-primary/10 text-theme-primary border border-theme-primary/20">Quantitative Aptitude</span>
                </div>

                <p className="mt-2.5 text-sm sm:text-[15px] font-extrabold leading-snug text-theme-text">
                  What is the measure of each interior angle of an equilateral triangle?
                </p>

                {/* Static illustration with option letters */}
                <ul className="mt-3.5 flex flex-col gap-2 list-none m-0 p-0">
                  {OPTIONS.map((option) => {
                    const selected = option.key === 'C';
                    return (
                      <li
                        key={option.key}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border-2 text-sm transition-all ${
                          selected
                            ? 'border-theme-primary dx-chip-fill font-extrabold text-theme-text shadow-sm'
                            : 'border-theme-border/70 bg-theme-bg/60 text-theme-text-secondary'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`w-5 h-5 shrink-0 rounded-full border-2 grid place-items-center text-[10px] font-black ${
                            selected
                              ? 'border-theme-primary bg-theme-primary text-theme-primary-text'
                              : 'border-theme-border bg-theme-surface text-theme-text-secondary'
                          }`}
                        >
                          {selected ? '✓' : ''}
                        </span>
                        <span className="w-5 shrink-0 font-black">{option.key}.</span>
                        <span className="font-semibold">{option.text}</span>
                        {selected ? <span className="sr-only">(selected)</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* The assistant, mid-confirmation. */}
              <div className="dx-chip-fill border-t-2 border-theme-border/80 px-4 sm:px-5 py-3.5">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 w-8 h-8 shrink-0 grid place-items-center rounded-xl bg-theme-primary text-theme-primary-text shadow-sm"
                  >
                    <Volume2 className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      aria-hidden="true"
                      className="flex items-end gap-[4px] h-4 mb-2"
                    >
                      {[8, 14, 6, 16, 10, 14, 5, 15, 9].map((height, i) => (
                        <span
                          key={i}
                          className="dx-bar w-[3px] rounded-full bg-theme-primary"
                          style={{
                            height: `${height}px`,
                            animationDelay: `${i * 90}ms`,
                          }}
                        />
                      ))}
                    </div>
                    <p className="min-h-[2.5rem] text-sm font-extrabold leading-snug text-theme-text">
                      {visibleLine}
                      <span aria-hidden="true" className="dx-caret inline-block w-[2.5px] h-[1em] align-middle bg-theme-primary ml-0.5" />
                    </p>
                    <p className="sr-only">
                      The assistant reads each question aloud and confirms an answer in full, for
                      example: {DEMO_LINES[0]}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <ul className="grid grid-cols-3 gap-3 list-none m-0 p-0">
              {BOTTOM_CHIPS.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="dx-chip-card flex items-center justify-center gap-2 px-2 py-2.5 rounded-xl border-2 border-theme-border/80 bg-theme-surface/90 text-center shadow-sm backdrop-blur-xs"
                >
                  <Icon className="w-4 h-4 shrink-0 text-theme-primary" aria-hidden="true" />
                  <span className="text-xs font-extrabold leading-tight text-theme-text">
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
