import React from 'react';
import {
  Accessibility,
  Ear,
  Keyboard,
  Contrast,
  Languages,
  FileText,
  Lightbulb,
  BarChart3,
  GraduationCap,
  Landmark,
  ShieldCheck,
  Train,
  ListChecks,
  BookOpen,
  BadgeCheck,
  MousePointer2,
  Timer,
  Mic,
  ArrowRight,
} from 'lucide-react';

interface SectionProps {
  onSignIn: () => void;
}

/* ------------------------------------------------------------------ */
/* Feature strip                                                       */
/* ------------------------------------------------------------------ */

const FEATURES = [
  { icon: Accessibility, label: 'Accessible for Visually Impaired' },
  { icon: Ear, label: 'Screen Reader Optimized' },
  { icon: Keyboard, label: 'Keyboard-only Navigation' },
  { icon: Contrast, label: 'High Contrast & Dark Themes' },
  { icon: Languages, label: 'Hindi, English & Hinglish' },
  { icon: FileText, label: 'Mock Tests & Practice Drills' },
  { icon: Lightbulb, label: 'Hints, Solutions & Review' },
  { icon: BarChart3, label: 'Performance Analytics' },
] as const;

export const FeatureStrip: React.FC = () => (
  <section id="features" className="bg-theme-surface border-b-2 border-theme-border/70">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <ul className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-x-4 gap-y-6 list-none m-0 p-0">
        {FEATURES.map(({ icon: Icon, label }) => (
          <li key={label} className="flex flex-col items-center text-center gap-3 group cursor-default">
            <span
              aria-hidden="true"
              className="w-12 h-12 grid place-items-center rounded-2xl border-2 border-theme-border/80 dx-chip-fill text-theme-primary shadow-sm group-hover:border-theme-primary group-hover:-translate-y-1 group-hover:shadow-md transition-all duration-200"
            >
              <Icon className="w-6 h-6" />
            </span>
            <span className="text-sm font-extrabold leading-tight text-theme-text group-hover:text-theme-primary transition-colors">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

/* ------------------------------------------------------------------ */
/* Exam categories                                                     */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  {
    icon: GraduationCap,
    name: 'Staff Selection',
    detail: 'SSC CGL Tier-1 mock and reasoning drills',
    tag: 'SSC CGL',
  },
  {
    icon: Landmark,
    name: 'Banking & Insurance',
    detail: 'IBPS PO speed drill and arithmetic sets',
    tag: 'IBPS PO',
  },
  {
    icon: ShieldCheck,
    name: 'Civil Services',
    detail: 'UPSC CSAT Paper-II and general studies',
    tag: 'UPSC',
  },
  {
    icon: Train,
    name: 'Railways',
    detail: 'RRB NTPC general awareness sprint',
    tag: 'RRB NTPC',
  },
  {
    icon: ListChecks,
    name: 'Logical Reasoning',
    detail: 'Syllogisms, seating and series drills',
    tag: 'Reasoning',
  },
  {
    icon: BookOpen,
    name: 'Verbal Ability',
    detail: 'Vocabulary, grammar and comprehension',
    tag: 'English',
  },
] as const;

export const ExamCategories: React.FC<SectionProps> = ({ onSignIn }) => (
  <section id="exams" className="border-b-2 border-theme-border/70 bg-theme-bg">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24 grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-16 items-center">
      <div>
        <span className="inline-block px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-theme-primary/10 text-theme-primary border border-theme-primary/20 mb-3">
          Explore Catalogs
        </span>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-[-0.03em] leading-tight text-balance text-theme-text">
          Explore Your Exam Preparation
        </h2>
        <p className="mt-4 text-base sm:text-lg leading-relaxed max-w-[62ch] text-theme-text-secondary font-medium">
          Choose from a wide range of competitive exams and access mock tests, practice sets and
          timed drills — each one readable aloud, answerable by voice and finishable without a
          mouse.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="mt-8 h-12 px-6 rounded-xl bg-theme-primary text-theme-primary-text font-black text-base hover:brightness-110 active:scale-95 transition-all duration-200 shadow-md inline-flex items-center gap-2.5"
        >
          Sign in to browse the catalogue
          <ArrowRight className="w-4.5 h-4.5" aria-hidden="true" />
        </button>
      </div>

      <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4.5 list-none m-0 p-0">
        {CATEGORIES.map(({ icon: Icon, name, detail, tag }) => (
          <li key={name}>
            <button
              type="button"
              onClick={onSignIn}
              aria-label={`Sign in to open ${name} tests`}
              className="w-full h-full text-left p-5 rounded-2xl dx-glass-card hover:border-theme-primary transition-all duration-250 hover:-translate-y-1 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    aria-hidden="true"
                    className="w-10 h-10 grid place-items-center rounded-xl dx-chip-fill border border-theme-border text-theme-primary shadow-xs group-hover:scale-105 transition-transform"
                  >
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-theme-border/50 text-theme-text-secondary border border-theme-border">
                    {tag}
                  </span>
                </div>
                <span className="mt-4 block text-base font-black text-theme-text group-hover:text-theme-primary transition-colors">{name}</span>
                <span className="mt-1.5 block text-sm leading-snug text-theme-text-secondary font-medium">
                  {detail}
                </span>
              </div>
              <span
                aria-hidden="true"
                className="mt-5 inline-flex items-center gap-1.5 text-xs font-black text-theme-primary"
              >
                Open tests
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

/* ------------------------------------------------------------------ */
/* Facts — every value below is verifiable in this repository.          */
/* Usage numbers are deliberately absent until there are real ones.     */
/* ------------------------------------------------------------------ */

const FACTS = [
  {
    icon: BadgeCheck,
    value: '100%',
    label: 'Built to WCAG 2.1 AA, audited with axe-core in the portal',
  },
  {
    icon: Contrast,
    value: '4',
    label: 'High-contrast themes, plus text scaling up to 200%',
  },
  {
    icon: MousePointer2,
    value: '0',
    label: 'Mouse actions — every step works by voice or keyboard',
  },
  {
    icon: Languages,
    value: '2',
    label: 'Languages read back to you, Hindi and English',
  },
] as const;

export const StatsBand: React.FC = () => (
  <section className="dx-wash-deep border-b-2 border-theme-border/70 relative overflow-hidden" aria-label="DristiX at a glance">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-14">
      <ul className="grid grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-8 list-none m-0 p-0">
        {FACTS.map(({ icon: Icon, value, label }) => (
          <li key={label} className="flex items-start gap-3.5 p-4 rounded-2xl bg-theme-surface/80 border-2 border-theme-border/70 shadow-sm backdrop-blur-xs">
            <span
              aria-hidden="true"
              className="w-11 h-11 shrink-0 grid place-items-center rounded-xl bg-theme-primary/10 border-2 border-theme-primary/30 text-theme-primary shadow-xs"
            >
              <Icon className="w-5.5 h-5.5" />
            </span>
            <div className="min-w-0">
              <p className="text-3xl sm:text-4xl font-black leading-none tracking-[-0.03em] text-theme-text">
                {value}
              </p>
              <p className="mt-2 text-sm font-bold leading-snug text-theme-text-secondary">
                {label}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

/* ------------------------------------------------------------------ */
/* Why DristiX — a ruled list, deliberately not another card grid       */
/* ------------------------------------------------------------------ */

const REASONS = [
  {
    icon: Ear,
    title: 'Every question reads itself',
    body: 'Navigate and the question, section and options are spoken in order. Ask “Read question” at any point to hear it again.',
  },
  {
    icon: Mic,
    title: 'Answer by voice, not by cursor',
    body: 'Say “Option 3” and the assistant repeats the option’s own words back — never just the number — so you know exactly what was recorded.',
  },
  {
    icon: Contrast,
    title: 'Set up your access before you sign in',
    body: 'Four contrast themes, text up to 200%, line spacing and hyper-legible type are available on this page, not buried in a settings screen.',
  },
  {
    icon: Timer,
    title: 'A clock the server owns',
    body: 'The exam deadline is held by the server, not the browser tab. A dropped connection, a refresh or a sleeping laptop cannot cost you time.',
  },
] as const;

export const WhyChoose: React.FC = () => (
  <section id="why" className="border-b-2 border-theme-border/70 bg-theme-surface">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16 items-center">
      <div>
        <span className="inline-block px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-theme-primary/10 text-theme-primary border border-theme-primary/20 mb-3">
          Accessibility First
        </span>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-[-0.03em] leading-tight text-balance text-theme-text">
          Why Choose DristiX?
        </h2>
        <p className="mt-4 text-base sm:text-lg leading-relaxed max-w-[58ch] text-theme-text-secondary font-medium">
          Accessibility here is not a bolt-on screen reader mode. It is the interaction model the
          whole exam is built around — so the shortcuts, contrast and speech that assistive-technology
          users need are the same features everyone else ends up relying on.
        </p>
        <a
          href="#features"
          className="mt-8 h-12 px-6 rounded-xl border-2 border-theme-border bg-theme-bg font-extrabold text-base text-theme-text hover:bg-theme-surface-elevated hover:border-theme-primary/60 transition-all duration-200 active:scale-95 inline-flex items-center no-underline w-fit shadow-sm"
        >
          View all features
        </a>
      </div>

      <ul className="list-none m-0 p-0 space-y-4">
        {REASONS.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="flex gap-4 sm:gap-5 p-5 rounded-2xl border-2 border-theme-border/80 bg-theme-bg/60 hover:bg-theme-surface-elevated/80 hover:border-theme-primary/50 transition-all duration-200 shadow-xs"
          >
            <span
              aria-hidden="true"
              className="w-12 h-12 shrink-0 grid place-items-center rounded-xl dx-chip-fill border-2 border-theme-border text-theme-primary shadow-xs"
            >
              <Icon className="w-5.5 h-5.5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-theme-text">{title}</h3>
              <p className="mt-1.5 text-sm sm:text-base leading-relaxed max-w-[62ch] text-theme-text-secondary font-medium">
                {body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

/* ------------------------------------------------------------------ */
/* Closing invitation                                                  */
/* ------------------------------------------------------------------ */

export const ClosingCta: React.FC<SectionProps> = ({ onSignIn }) => (
  <section className="bg-theme-primary text-theme-primary-text border-b-2 border-theme-border/70 relative overflow-hidden">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center relative z-10">
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-[-0.03em] leading-tight text-balance">
        The test starts the moment you are ready.
      </h2>
      <p className="mt-5 text-base sm:text-lg leading-relaxed max-w-[58ch] mx-auto opacity-95 font-medium">
        Sign in with the roll number and password your institution issued. If you do not have an
        account yet, registration is by invitation.
      </p>
      <div className="mt-9 flex flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={onSignIn}
          className="h-13 px-8 rounded-xl bg-theme-bg text-theme-text font-black text-base hover:bg-theme-surface-elevated hover:scale-105 active:scale-95 transition-all shadow-xl"
        >
          Sign in to your account
        </button>
        <a
          href="#exams"
          className="h-13 px-7 rounded-xl border-2 border-theme-bg font-extrabold text-base text-theme-primary-text hover:bg-theme-primary-hover hover:scale-105 active:scale-95 transition-all inline-flex items-center no-underline"
        >
          Browse exams first
        </a>
      </div>
    </div>
  </section>
);

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

const FOOTER_COLUMNS = [
  {
    heading: 'Portal',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Exams & drills', href: '#exams' },
      { label: 'Why DristiX', href: '#why' },
    ],
  },
  {
    heading: 'Accessibility',
    links: [
      { label: 'Colour themes', href: '#top' },
      { label: 'Text scaling', href: '#top' },
      { label: 'Voice commands', href: '#why' },
    ],
  },
] as const;

export const LandingFooter: React.FC<SectionProps> = ({ onSignIn }) => (
  <footer role="contentinfo" className="bg-theme-surface-elevated">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="w-10 h-10 grid place-items-center rounded-xl bg-theme-primary text-theme-primary-text font-black text-sm"
          >
            DX
          </span>
          <span className="font-black text-lg tracking-tight text-theme-text">DristiX</span>
        </div>
        <p className="mt-4 text-sm leading-relaxed max-w-[42ch] text-theme-text-secondary">
          An accessible examination and practice portal: screen-reader first, keyboard-complete and
          spoken from end to end.
        </p>
      </div>

      {FOOTER_COLUMNS.map((column) => (
        <nav key={column.heading} aria-label={column.heading}>
          <h2 className="text-xs font-black uppercase tracking-widest text-theme-text-secondary">
            {column.heading}
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5 list-none m-0 p-0">
            {column.links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="text-sm font-semibold text-theme-text no-underline hover:text-theme-primary transition"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ))}

      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-theme-text-secondary">
          Candidate
        </h2>
        <button
          type="button"
          onClick={onSignIn}
          className="mt-4 h-11 w-full px-4 rounded-xl bg-theme-primary text-theme-primary-text font-bold text-sm hover:brightness-110 transition"
        >
          Sign in
        </button>
        <p className="mt-3 text-xs leading-relaxed text-theme-text-secondary">
          Registration is invite-only.
        </p>
      </div>
    </div>

    <div className="border-t-2 border-theme-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-theme-text-secondary">
        <p className="m-0">© 2026 DristiX. Built to WCAG 2.1 level AA.</p>
        <p className="m-0">Voice, keyboard and screen reader tested throughout.</p>
      </div>
    </div>
  </footer>
);
