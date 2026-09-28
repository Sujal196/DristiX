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
import { LandingPage } from './components/landing/LandingPage';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminPanel } from './components/admin/AdminPanel';
import { StudentAnalyticsView } from './components/analytics/StudentAnalyticsView';
import { VoiceAssistantOrb } from './components/voice/VoiceAssistantOrb';
import { useBootstrapStore } from './stores/useBootstrapStore';
import { getDataSource } from './services/dataSource';
import { formatDuration } from './utils/formatDuration';

export const App: React.FC = () => {
  const { applyToDOM } = usePreferencesStore();
  const {
    activeView,
    currentExam,
    isSubmitted,
    setTimer,
    submitExam,
    returnToCatalog,
    timeRemaining,
    attemptId,
  } = useExamStore();
  const { currentStudent, isAdminAuthenticated } = useAuthStore();
  const bootstrapStatus = useBootstrapStore((s) => s.status);
  const bootstrapError = useBootstrapStore((s) => s.error);
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

  // App startup lifecycle. In local mode this resolves immediately; with the
  // API it covers the network round trip and renders an announced loading state.
  useEffect(() => {
    // One-time cleanup of state written by pre-backend builds. A stale
    // `dristix_current_student` used to make the app render as signed in while
    // the server had no session, so every request 401'd behind a convincing
    // looking portal. It is no longer read, but removing it stops old copies
    // from confusing anyone inspecting storage.
    try {
      for (const key of [
        'dristix_current_student',
        'dristix_students',
        'dristix_submissions',
        'dristix_exams',
        'dristix_practice_drills',
        'dristix_attempts_local',
      ]) {
        localStorage.removeItem(key);
      }
    } catch {
      // Private browsing can block storage; harmless.
    }

    void useBootstrapStore.getState().run();
  }, []);

  // The catalog lives in MongoDB behind authentication, so it is read once the
  // session is known — never at mount.
  //
  // Calling it unconditionally at mount raced the refresh round-trip: the
  // access token did not exist yet, the request came back 401, and that became
  // a sticky `catalogError` which no amount of navigating away cleared. The
  // catalog therefore stayed empty after signing in and only a full page
  // reload fixed it. Keying on the session covers both the restored-session
  // path and a fresh login, and re-reads on sign-out/sign-in.
  useEffect(() => {
    if (!currentStudent) return;
    void useExamStore.getState().loadCatalog();
    // Keyed on the id, not the object: the auth store creates a new profile
    // object on every update and reloading the catalog on each would be waste.
  }, [currentStudent?.id]);

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
          void submitExam();
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
      // In api mode `timeRemaining` was set by the server when the attempt
      // started, so the worker is seeded from the authoritative deadline rather
      // than recomputing durationMinutes from the local clock.
      const examSeconds = timeRemaining > 0 ? timeRemaining : currentExam.durationMinutes * 60;
      workerRef.current.postMessage({ action: 'RESET', payload: { seconds: examSeconds } });
      workerRef.current.postMessage({ action: 'START', payload: { seconds: examSeconds } });
    }
  }, [
    currentRoute,
    activeView,
    currentExam.id,
    currentExam.durationMinutes,
    timeRemaining,
    isSubmitted,
    currentStudent,
  ]);

  // Server clock re-sync while an exam is running.
  //
  // The worker keeps the display ticking smoothly, but it counts down on the
  // local clock, which drifts and can be changed by the student. Every minute
  // we ask the server how much time is genuinely left and correct the worker.
  // If the server says the deadline has passed, we submit immediately rather
  // than waiting for a local countdown that may never reach zero.
  useEffect(() => {
    if (activeView !== 'exam' || isSubmitted || !attemptId) return;

    const tick = async () => {
      const attempt = useExamStore.getState().attemptId;
      if (!attempt) return;
      try {
        const { heartbeat } = await getDataSource().exams;
        const clock = await heartbeat(attempt);

        const store = useExamStore.getState();
        if (store.isSubmitted) return;

        if (clock.remainingSeconds <= 0) {
          soundEffects.playTimerAlert();
          useAnnouncerStore
            .getState()
            .announce('Time has expired. Your examination is being submitted now.', 'assertive', true);
          void store.submitExam();
          return;
        }

        store.setTimer(clock.remainingSeconds, formatDuration(clock.remainingSeconds));

        // Nudge the worker to the authoritative value.
        const worker = workerRef.current;
        if (worker) {
          worker.postMessage({ action: 'RESET', payload: { seconds: clock.remainingSeconds } });
          worker.postMessage({ action: 'START', payload: { seconds: clock.remainingSeconds } });
        }
      } catch {
        // A dropped heartbeat is not fatal. The next one is 60s later, and the
        // server re-checks the real deadline on submit regardless.
      }
    };

    const id = setInterval(() => void tick(), 60_000);
    return () => clearInterval(id);
  }, [activeView, isSubmitted, attemptId]);

  // Pick up newly published exams without a manual refresh.
  //
  // An admin publishing an exam is a rare, out-of-band event, so polling would
  // be wasteful. Re-reading the catalog when the tab regains focus costs one
  // request and means a student who switches away and back sees new tests.
  useEffect(() => {
    if (activeView !== 'catalog') return;

    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        void useExamStore.getState().loadCatalog();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [activeView]);

  // Flush in-progress answers when the tab is hidden or closed.
  //
  // The debounced autosave can be up to 1.2s behind, so a student who answers a
  // question and immediately closes the tab would otherwise lose it.
  useEffect(() => {
    const flush = () => {
      const store = useExamStore.getState();
      if (store.activeView !== 'exam' || store.isSubmitted || !store.attemptId) return;
      store.persistState();
    };

    // `pagehide` fires for tab close and navigation; `visibilitychange` covers
    // mobile backgrounding, where pagehide may not run.
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, []);

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

  // 0. STARTUP GATE
  // Reachable only when the data source is the API. Local mode resolves this in
  // the same tick, so the current offline behaviour is unchanged.
  if (bootstrapStatus === 'loading' || bootstrapStatus === 'idle') {
    return (
      <div
        className="min-h-screen bg-theme-bg text-theme-text flex items-center justify-center p-6 font-sans"
      >
        <div role="status" aria-live="polite" className="text-center space-y-4 max-w-md">
          <div
            aria-hidden="true"
            className="w-12 h-12 mx-auto rounded-full border-4 border-theme-border border-t-theme-primary animate-spin"
          />
          <p className="text-lg font-bold">Loading DristiX</p>
          <p className="text-sm text-theme-text-secondary">
            Preparing your accessible examination portal. This will only take a moment.
          </p>
        </div>
      </div>
    );
  }

  if (bootstrapStatus === 'error') {
    return (
      <div className="min-h-screen bg-theme-bg text-theme-text p-6 flex items-center justify-center font-sans">
        <div
          role="alert"
          aria-live="assertive"
          className="max-w-lg space-y-4 border-2 border-theme-danger rounded-xl p-6 bg-theme-surface"
        >
          <h1 className="text-xl font-black text-theme-danger">
            Could not reach the DristiX server
          </h1>
          <p className="text-base">{bootstrapError}</p>
          <p className="text-sm text-theme-text-secondary">
            If you are working offline, set <code>VITE_DATA_SOURCE=local</code> to run the
            app without a backend.
          </p>
          <button
            type="button"
            onClick={() => void useBootstrapStore.getState().run()}
            className="px-4 py-2 font-bold rounded-lg border-2 border-theme-border bg-theme-primary text-theme-primary-text focus:outline-none focus:ring-4 focus:ring-theme-focus-ring"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

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

  // 2. PUBLIC GATE: no candidate is active. `/login` and `/register` show the
  // accessible sign-in flow; every other path shows the public landing page,
  // which is what a first-time visitor should meet instead of a password form.
  if (!currentStudent) {
    const wantsAuth =
      currentRoute.startsWith('/login') || currentRoute.startsWith('/register');

    if (wantsAuth) {
      return (
        <div className="min-h-screen bg-theme-bg text-theme-text transition-colors flex flex-col font-sans">
          <SkipLinks />
          <LiveAnnouncer />
          <header className="p-3 sm:p-4 border-b-2 border-theme-border bg-theme-surface">
            <div className="max-w-7xl mx-auto flex justify-between items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full border-2 border-theme-border bg-theme-primary text-theme-primary-text flex items-center justify-center font-black text-sm">
                  DX
                </span>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-theme-text leading-tight">DristiX</h1>
                  <p className="text-xs text-theme-text-secondary">Accessible Online Examination Platform</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigateTo('/')}
                className="h-10 px-4 rounded-xl border-2 border-theme-border bg-theme-bg font-bold text-sm text-theme-text hover:bg-theme-surface-elevated transition"
              >
                ← Back to home
              </button>
            </div>
          </header>

          <main id="main-content" className="flex-1 pb-16 focus:outline-none">
            <StudentAuthScreen
              initialMode={currentRoute.startsWith('/register') ? 'register' : 'login'}
              onAuthenticated={() => navigateTo('/')}
            />
          </main>
          <A11ySettingsModal />
          <A11yInspector />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-theme-bg text-theme-text transition-colors flex flex-col font-sans">
        <SkipLinks />
        <LiveAnnouncer />
        <LandingPage
          onSignIn={() => navigateTo('/login')}
          onRegister={() => navigateTo('/register')}
        />
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
      <div id="main-content" className="flex-1 pb-16">
        {activeView === 'analytics' ? (
          <StudentAnalyticsView onReturnToCatalog={returnToCatalog} />
        ) : activeView === 'catalog' ? (
          <ExamCatalogScreen />
        ) : isSubmitted ? (
          <DiagnosticReport />
        ) : (
          <ExamScreen />
        )}
      </div>

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
