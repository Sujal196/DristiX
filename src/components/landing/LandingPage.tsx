/*
 * ═══════════════════════════════════════════════════════════════════
 *  DIRECTION CONTRACT — public landing surface (`/`)
 *  Re-open this comment before touching any file it owns. A contract the
 *  build erased is a contract nobody can audit, so it lives in source.
 *
 *  1. THESIS
 *     DristiX is the exam platform where the interface speaks first. The
 *     landing page argues that by showing the exam panel mid-confirmation,
 *     not by illustrating a person having an experience.
 *
 *  2. ENEMY
 *     The generic SaaS hero: gradient mesh, floating laptop mockup, stock
 *     student, and the words "seamless" and "empower". Also: a decorative
 *     icon row that implies features the portal does not have.
 *
 *  3. USER + MOMENT
 *     A candidate (or an assistive-technology user acting for one) who must
 *     believe within one screen that this product will be usable by them —
 *     then tap Login. Everything on the page is arranged to shorten that
 *     distance.
 *
 *  4. SURFACE + PALETTE
 *     Inherited, not invented: `theme-*` tokens from src/styles/theme.css so
 *     all four shipped themes (high-contrast light/dark, yellow-on-black,
 *     warm sepia) render correctly before a visitor has chosen one. Washes are
 *     `color-mix()` from `--primary`; Tailwind alpha modifiers do not emit for
 *     `var()` colours and are therefore never used here. Primary buttons carry
 *     `text-theme-primary-text`, never `text-white`, which would fail contrast
 *     in dark-hc and yellow-black.
 *
 *  5. BAR
 *     Landmarks, focus rings, contrast and reduced-motion are not polish
 *     passes at the end — they are the product claim this page is selling.
 *     Every stated fact must be verifiable in this repository; no invented
 *     usage numbers.
 * ═══════════════════════════════════════════════════════════════════
 */
import React from 'react';
import '../../styles/landing.css';
import { LandingHeader } from './LandingHeader';
import { LandingHero } from './LandingHero';
import {
  FeatureStrip,
  ExamCategories,
  StatsBand,
  WhyChoose,
  ClosingCta,
  LandingFooter,
} from './LandingSections';

interface LandingPageProps {
  onSignIn: () => void;
  onRegister: () => void;
}

/**
 * The public front door. Rendered whenever nobody is signed in and the URL is
 * not an admin or auth route, so a visitor always lands on this page rather
 * than straight on a password form.
 */
export const LandingPage: React.FC<LandingPageProps> = ({ onSignIn, onRegister }) => (
  <div className="landing-root min-h-screen bg-theme-bg text-theme-text">
    <LandingHeader onSignIn={onSignIn} onRegister={onRegister} />
    <main id="main-content">
      <LandingHero onSignIn={onSignIn} />
      <FeatureStrip />
      <ExamCategories onSignIn={onSignIn} />
      <StatsBand />
      <WhyChoose />
      <ClosingCta onSignIn={onSignIn} />
    </main>
    <LandingFooter onSignIn={onSignIn} />
  </div>
);
