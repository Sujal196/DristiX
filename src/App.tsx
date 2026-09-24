import React, { useEffect, useRef, useState } from 'react';
import { usePreferencesStore } from './store/usePreferencesStore';
import { useExamStore } from './store/useExamStore';
import { useAnnouncerStore } from './store/useAnnouncerStore';
import { useAuthStore } from './store/useAuthStore';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { createTimerWorker } from './workers/timerWorker';
import { soundEffects } from './utils/soundEffects';

import { SkipLinks } from './components/layout/SkipLinks';
import { LiveAnnouncer } from './components/a11y/LiveAnnouncer';
import { Header } from './components/layout/Header';
import { ExamCatalogScreen } from './components/catalog/ExamCatalogScreen';
import { ExamScreen } from './components/exam/ExamScreen';
import { DiagnosticReport } from './components/exam/DiagnosticReport';
import { QuestionPalette } from './components/exam/QuestionPalette';
import { A11ySettingsModal } from './components/a11y/A11ySettingsModal';
import { ShortcutsHelpModal } from './components/a11y/ShortcutsHelpModal';
import { SubmitConfirmModal } from './components/exam/SubmitConfirmModal';
import { A11yInspector } from './components/a11y/A11yInspector';
import { StudentAuthScreen } from './components/auth/StudentAuthScreen';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminPanel } from './components/admin/AdminPanel';
import { StudentAnalyticsView } from './components/analytics/StudentAnalyticsView';
import { VoiceAssistantOrb } from './components/voice/VoiceAssistantOrb';

export const App: React.FC = () => {
  const { applyToDOM } = usePreferencesStore();
  const {
    activeView,
    currentExam,
    isSubmitted,
    setTimer,
    submitExam,
    returnToCatalog,
  } = useExamStore();
  const { currentStudent, isAdminAuthenticated } = useAuthStore();
  const [currentRoute, setCurrentRoute] = useState<string>(() => window.location.pathname);
  const workerRef = useRef<Worker | null>(null);

  // Helper to change URL and trigger re-render
  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentRoute(path);
  };

  // Listen to browser Back / Forward buttons and internal popstate dispatches with exam protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const store = useExamStore.getState();
      if (store.activeView === 'exam' && !store.isSubmitted) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    const handlePopState = () => {
      const store = useExamStore.getState();
      // Prevent browser back button from leaving an active unsubmitted exam
      if (store.activeView === 'exam' && !store.isSubmitted) {
        window.history.pushState(null, '', window.location.pathname);
        store.setSubmitModalOpen(true);
        soundEffects.playTimerAlert();
        useAnnouncerStore
          .getState()
          .announce(
            'You cannot go back before submitting the exam. Submit confirmation window opened. Please submit your test first.',
            'assertive',
            true
          );
        return;
      }
      setCurrentRoute(window.location.pathname);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Initialize global keyboard shortcuts listener
  useGlobalShortcuts();

  // Apply saved theme and text scaling to DOM on mount
  useEffect(() => {
    applyToDOM();
  }, [applyToDOM]);

  // Off-Thread Timer Web Worker Management
  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = createTimerWorker();
      workerRef.current = worker;

      worker.onmessage = (e) => {
        const { type, remainingSeconds, formattedTime, milestone } = e.data;

        if (type === 'TICK') {
          const store = useExamStore.getState();
          if (store.isSubmitted || store.activeView !== 'exam') return;
          setTimer(remainingSeconds, formattedTime);

          // Milestone announcements (30m, 15m, 10m, 5m, 2m, 1m warnings)
          if (milestone && milestone.alert) {
            soundEffects.playTimerAlert();
            useAnnouncerStore
              .getState()
              .announce(milestone.message, 'assertive', true);
          }
        } else if (type === 'TIMEOUT') {
          const store = useExamStore.getState();
          if (store.isSubmitted || store.activeView !== 'exam') return;
          soundEffects.playTimerAlert();
          useAnnouncerStore
            .getState()
            .announce(
              'Exam time has expired! Automatically submitting your responses now.',
              'assertive',
              true
            );
          submitExam();
        }
      };
    } catch {
      // Fallback timer if Worker constructor is restricted
      const interval = setInterval(() => {
        const state = useExamStore.getState();
        if (state.activeView === 'exam' && state.timeRemaining > 0 && !state.isSubmitted) {
          const nextSec = state.timeRemaining - 1;
          const h = Math.floor(nextSec / 3600).toString().padStart(2, '0');
          const m = Math.floor((nextSec % 3600) / 60).toString().padStart(2, '0');
          const s = (nextSec % 60).toString().padStart(2, '0');
          state.setTimer(nextSec, `${h}:${m}:${s}`);
        }
      }, 1000);
      return () => clearInterval(interval);
    }

    return () => {
      if (worker) {
        worker.terminate();
      }
    };
  }, [setTimer, submitExam]);

  // Synchronize timer worker with activeView, currentExam, currentRoute, and submission state
  useEffect(() => {
    if (!workerRef.current) return;

    if (
      currentRoute.startsWith('/admin') ||
      activeView === 'catalog' ||
      isSubmitted ||
      !currentStudent
    ) {
      workerRef.current.postMessage({ action: 'PAUSE' });
    } else if (activeView === 'exam' && !isSubmitted) {
      const examSeconds = currentExam.durationMinutes * 60;
      workerRef.current.postMessage({ action: 'RESET', payload: { seconds: examSeconds } });
      workerRef.current.postMessage({ action: 'START', payload: { seconds: examSeconds } });
    }
  }, [
    currentRoute,
    activeView,
    currentExam.id,
    currentExam.durationMinutes,
    isSubmitted,
    currentStudent,
  ]);

  // Initial welcome announcement for assistive technologies
  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.location.pathname.startsWith('/admin')) {
        useAnnouncerStore
          .getState()
          .announce('Welcome to DristiX Administrator Studio.', 'polite', false);
      } else {
        useAnnouncerStore
          .getState()
          .announce(
            'Welcome to DristiX Accessible Online Examination Platform.',
            'polite',
            false
          );
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // 1. ADMIN ROUTE: STRICTLY ACCESSIBLE ONLY AT /admin
  if (currentRoute.startsWith('/admin')) {
    return (
      <div className="min-h-screen bg-theme-bg text-theme-text transition-colors flex flex-col font-sans">
        <SkipLinks />
        <LiveAnnouncer />
        {!isAdminAuthenticated ? (
          <AdminLogin onReturnToStudent={() => navigateTo('/')} />
        ) : (
          <AdminPanel onReturnToStudent={() => navigateTo('/')} />
        )}
        <A11ySettingsModal />
        <A11yInspector />
      </div>
    );
  }

  // 2. STUDENT AUTH GATE: If no candidate is active, show Accessible Sign In / Register
  if (!currentStudent) {
    return (
      <div className="min-h-screen bg-theme-bg text-theme-text transition-colors flex flex-col font-sans">
        <SkipLinks />
        <LiveAnnouncer />
        <header className="p-3 sm:p-4 border-b-2 border-theme-border bg-theme-surface">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full border-2 border-theme-border bg-theme-primary text-white flex items-center justify-center font-black text-sm">
                DX
              </span>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-theme-text leading-tight">DristiX</h1>
                <p className="text-xs text-theme-text/70">Accessible Online Examination Platform</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 pb-16">
          <StudentAuthScreen onAuthenticated={() => navigateTo('/')} />
        </main>
        <A11ySettingsModal />
        <A11yInspector />
      </div>
    );
  }

  // 3. STUDENT PORTAL: Active logged-in candidate view
  return (
    <div className="min-h-screen bg-theme-bg text-theme-text transition-colors flex flex-col font-sans">
      {/* Skip Navigation Links for Keyboard & Screen Reader Users */}
      <SkipLinks />

      {/* Persistent Global Live Broadcaster (polite & assertive live regions) */}
      <LiveAnnouncer />

      {/* Main Semantic Banner / Header */}
      <Header />

      {/* Primary Content Container: Catalog Dashboard vs Active Exam vs Diagnostic Report vs Analytics */}
      <main id="main-content" className="flex-1 pb-16">
        {activeView === 'analytics' ? (
          <StudentAnalyticsView onReturnToCatalog={returnToCatalog} />
        ) : activeView === 'catalog' ? (
          <ExamCatalogScreen />
        ) : isSubmitted ? (
          <DiagnosticReport />
        ) : (
          <ExamScreen />
        )}
      </main>

      {/* Accessible Modals and Drawers (only active during Exam) */}
      {activeView === 'exam' && <QuestionPalette />}
      <A11ySettingsModal />
      <ShortcutsHelpModal />
      {activeView === 'exam' && <SubmitConfirmModal />}

      {/* Live WCAG 2.1 AA Audit Inspector */}
      <A11yInspector />

      {/* AI Conversational Voice Assistant (Live Gem-style Floating Orb) */}
      <VoiceAssistantOrb />
    </div>
  );
};

export default App;
