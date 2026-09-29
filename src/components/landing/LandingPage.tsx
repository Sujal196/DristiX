/*
 * ═══════════════════════════════════════════════════════════════════
 *  DIRECTION CONTRACT — public landing surface (`/`)
 *
 *  1. THESIS
 *     DristiX is the exam platform where the interface speaks first.
 *
 *  2. SURFACE + PALETTE
 *     Inherited, not invented: `theme-*` tokens from src/styles/theme.css.
 *     `color-mix()` is the only tint engine; Tailwind alpha on `var()` is
 *     not used here. Primary buttons carry `text-theme-primary-text`, never
 *     `text-white`.
 *
 *  3. BAR
 *     Landmarks, focus rings, contrast and reduced-motion are the product
 *     claim this page is selling. Every stated fact must be verifiable.
 * ═══════════════════════════════════════════════════════════════════
 */
import React from 'react';
import '../../styles/landing.css';
import { LandingHeader } from './LandingHeader';
import { LandingHero } from './LandingHero';
import {
  FeatureStrip,
  HowItWorks,
  ExamCategories,
  VoiceShowcase,
  StatsBand,
  WhyChoose,
  FaqSection,
  ClosingCta,
  LandingFooter,
} from './LandingSections';

interface LandingPageProps {
  onSignIn: () => void;
  onRegister: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSignIn, onRegister }) => (
  <div className="landing-root min-h-screen bg-theme-bg text-theme-text font-sans">

    {/* Skip-to-content link */}
    <a
      href="#main-content"
      className="sr-only sr-only-focusable absolute top-2 left-2 z-[9999] bg-theme-primary text-theme-primary-text px-4 py-2 rounded-xl font-black text-sm no-underline"
    >
      Skip to main content
    </a>



    <LandingHeader onSignIn={onSignIn} onRegister={onRegister} />

    <main id="main-content">
      <LandingHero onSignIn={onSignIn} />
      <FeatureStrip />
      <HowItWorks />
      <ExamCategories onSignIn={onSignIn} />
      <VoiceShowcase />
      <StatsBand />
      <WhyChoose />
      <FaqSection />
      <ClosingCta onSignIn={onSignIn} />
    </main>

    <LandingFooter onSignIn={onSignIn} />
  </div>
);
