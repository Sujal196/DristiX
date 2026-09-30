import { create } from 'zustand';
import type { Exam, QuestionItem } from '../../shared/types';
import { soundEffects } from '../utils/soundEffects';
import { useAnnouncerStore } from './useAnnouncerStore';
import { verbalizeMath, verbalizeForSpeech } from '../utils/mathVerbalizer';
import { describeOptionSelection } from '../utils/optionSpeech';
import { isHindiPreferred } from '../utils/voiceRecognition';
import { useAuthStore } from './useAuthStore';
import { getDataSource } from '../services/dataSource';
import { dispatchAccessibilityEvent } from '../accessibility';
import type { GradeResult, StartAttemptResult } from '../../shared/types';

export interface SectionDiagnostic {
  section: string;
  total: number;
  attempted: number;
  correct: number;
  accuracy: number;
}

export interface DiagnosticReportData {
  examTitle: string;
  totalQuestions: number;
  attemptedCount: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  markedCount: number;
  scorePercentage: number;
  totalScore: number;
  maxScore: number;
  sectionDiagnostics: SectionDiagnostic[];
  verbalSummary: string[];
  weakAreas: string[];
  strongAreas: string[];
}

export interface AnalyticsSnapshot {
  totalTests: number;
  timedExamsCount: number;
  drillsCount: number;
  bestScorePercentage: number;
  bestScoreTitle: string;
  bestScoreMarks: string;
  averageAccuracy: number;
  questionsSolved: number;
  correctCount: number;
  wrongCount: number;
  recentSubmissions: Array<{
    examTitle: string;
    examCode: string;
    examType: 'exam' | 'practice';
    date: string;
    time: string;
    score: number;
    maxScore: number;
    percentage: number;
    correctCount: number;
    incorrectCount: number;
    unattemptedCount: number;
  }>;
}

interface ExamState {
  currentAnalytics: AnalyticsSnapshot | null;
  setCurrentAnalytics: (analytics: AnalyticsSnapshot | null) => void;
  portalTab: 'exams' | 'practice';
  availableExams: Exam[];
  availablePracticeDrills: Exam[];
  currentExam: Exam;
  activeView: 'catalog' | 'exam' | 'analytics';
  questions: QuestionItem[];
  currentIndex: number;
  selectedOptions: Record<string, number>; // questionId -> option number (1-4)
  markedForReview: Record<string, boolean>; // questionId -> boolean
  visitedQuestions: Record<string, boolean>;
  examMode: 'exam' | 'practice';
  isSubmitted: boolean;
  submissionTime: number | null;
  timeRemaining: number;
  formattedTime: string;
  isPaletteOpen: boolean;
  isSettingsOpen: boolean;
  isShortcutsOpen: boolean;
  isSubmitModalOpen: boolean;
  activeSectionFilter: string;

  /**
   * True while the catalog is being fetched or lazily seeded. The listing
   * screen uses this to show a loading state instead of a misleading
   * "no examinations match" message.
   */
  isCatalogLoading: boolean;

  /**
   * Why the catalog could not be loaded, if it could not. Distinguishes "no
   * exams exist" from "cannot reach the server" / "session expired", which
   * need completely different advice.
   */
  catalogError: string | null;

  /**
   * Server-side attempt id. Null before an attempt starts, and in offline mode
   * the local data source mints its own so the rest of the code is identical.
   */
  attemptId: string | null;
  /** Server-authoritative deadline (epoch ms). Null when offline. */
  expiresAtMs: number | null;
  /** Last grade result returned by the server, if any. */
  serverReport: GradeResult | null;

  // View & Exam Actions
  setPortalTab: (tab: 'exams' | 'practice') => void;
  /** Loads the catalog from the active data source. Call once on boot. */
  loadCatalog: () => Promise<void>;
  /**
   * Starts (or resumes) an attempt and opens the exam.
   *
   * `options.announce` exists because the voice assistant speaks its own
   * confirmation for the same action. Letting this one speak too meant two
   * messages for one command, and since every announcement interrupts, the
   * second cancelled the first mid-sentence — the assistant sounded like it was
   * starting its reply over.
   */
  selectExam: (
    examId: string,
    forceMode?: 'exam' | 'practice',
    options?: { announce?: boolean }
  ) => Promise<void>;
  /** Pushes the current progress to the server. Debounced internally. */
  persistState: () => void;
  returnToCatalog: () => void;
  openAnalytics: () => void;
  addNewExam: (
    newExam: Exam,
    mode: 'exam' | 'practice'
  ) => Promise<{ ok: boolean; message?: string }>;
  updateExistingExam: (
    examId: string,
    updatedExam: Exam,
    mode: 'exam' | 'practice'
  ) => Promise<{ ok: boolean; message?: string }>;
  loadExamForEdit: (examId: string) => Promise<Exam | null>;
  deleteCustomExam: (examId: string) => Promise<void>;

  // Question navigation actions
  nextQuestion: (options?: { announce?: boolean }) => void;
  previousQuestion: (options?: { announce?: boolean }) => void;
  jumpToQuestion: (index: number, options?: { announce?: boolean }) => void;
  suppressAutoRead: boolean;
  setSuppressAutoRead: (val: boolean) => void;
  /**
   * `options.announce` lets a caller that is about to confirm the choice itself
   * stay the only voice. Two confirmations for one action means the second
   * cancels the first mid-sentence, and the candidate never hears the option.
   */
  selectOption: (optionNumber: number, options?: { announce?: boolean }) => void;
  clearOption: (options?: { announce?: boolean }) => void;
  toggleMarkForReview: () => void;
  setExamMode: (mode: 'exam' | 'practice') => void;
  setTimer: (sec: number, formatted: string) => void;
  setPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setSubmitModalOpen: (open: boolean) => void;
  setActiveSectionFilter: (section: string) => void;
  submitExam: () => Promise<void>;
  resetExam: () => void;
  getDiagnosticReport: () => DiagnosticReportData;
  announceCurrentQuestion: (speakTTS?: boolean, includeOptions?: boolean) => void;
  readCurrentQuestion: () => void;
  readTimer: () => void;
}

/**
 * Placeholder used until `loadCatalog()` fills the store from the backend.
 * The catalog is never seeded from localStorage any more: it lives in MongoDB,
 * which is also what keeps the answer key out of this bundle.
 */
const EMPTY_EXAM: Exam = {
  id: '',
  code: '',
  title: 'Loading examinations…',
  description: '',
  category: 'Staff Selection',
  durationMinutes: 60,
  totalMarks: 0,
  negativeMarking: 'No negative marking (Practice)',
  difficulty: 'Moderate',
  sections: [],
  questionCount: 0,
  questions: [],
};

export const useExamStore = create<ExamState>((set, get) => ({
  currentAnalytics: null,
  setCurrentAnalytics: (analytics) => set({ currentAnalytics: analytics }),
  portalTab: 'exams',
  availableExams: [],
  availablePracticeDrills: [],
  currentExam: EMPTY_EXAM,
  activeView: 'catalog', // Default landing on the accessible catalog dashboard
  questions: [],
  currentIndex: 0,
  selectedOptions: {},
  markedForReview: {},
  visitedQuestions: {},
  examMode: 'exam',
  isSubmitted: false,
  submissionTime: null,
  // The real duration arrives with the attempt, from the server's own clock.
  timeRemaining: 0,
  formattedTime: '00:00:00',
  isPaletteOpen: false,
  isSettingsOpen: false,
  isShortcutsOpen: false,
  isSubmitModalOpen: false,
  activeSectionFilter: 'All',
  isCatalogLoading: true,
  catalogError: null,
  attemptId: null,
  expiresAtMs: null,
  serverReport: null,
  suppressAutoRead: false,
  setSuppressAutoRead: (val: boolean) => set({ suppressAutoRead: val }),

  nextQuestion: (options?: { announce?: boolean }) => {
    const { currentIndex, questions } = get();
    if (currentIndex < questions.length - 1) {
      const currentQ = questions[currentIndex];
      const nextIdx = currentIndex + 1;
      const nextQ = questions[nextIdx];
      set((state) => ({
        currentIndex: nextIdx,
        suppressAutoRead: options?.announce === false,
        visitedQuestions: { ...state.visitedQuestions, [nextQ.id]: true },
      }));

      if (currentQ && nextQ && nextQ.section && currentQ.section && nextQ.section !== currentQ.section) {
        dispatchAccessibilityEvent('SECTION_CHANGED', {
          previousSection: currentQ.section,
          newSection: nextQ.section,
        });
      }

      dispatchAccessibilityEvent('QUESTION_CHANGED', {
        questionIndex: nextIdx,
        questionNumber: nextQ.questionNumber,
        totalQuestions: questions.length,
        questionText: nextQ.questionText,
        sectionName: nextQ.section,
        previousQuestionIndex: currentIndex,
      });
    } else {
      dispatchAccessibilityEvent('NAVIGATION_ERROR', {
        reason: 'LAST_QUESTION',
        message: 'You are at the last question.',
      });
      if (options?.announce !== false) {
        useAnnouncerStore.getState().announce('You are at the last question.', 'polite', true);
      }
    }
  },

  previousQuestion: (options?: { announce?: boolean }) => {
    const { currentIndex, questions } = get();
    if (currentIndex > 0) {
      const currentQ = questions[currentIndex];
      const prevIdx = currentIndex - 1;
      const prevQ = questions[prevIdx];
      set((state) => ({
        currentIndex: prevIdx,
        suppressAutoRead: options?.announce === false,
        visitedQuestions: { ...state.visitedQuestions, [prevQ.id]: true },
      }));

      if (currentQ && prevQ && prevQ.section && currentQ.section && prevQ.section !== currentQ.section) {
        dispatchAccessibilityEvent('SECTION_CHANGED', {
          previousSection: currentQ.section,
          newSection: prevQ.section,
        });
      }

      dispatchAccessibilityEvent('QUESTION_CHANGED', {
        questionIndex: prevIdx,
        questionNumber: prevQ.questionNumber,
        totalQuestions: questions.length,
        questionText: prevQ.questionText,
        sectionName: prevQ.section,
        previousQuestionIndex: currentIndex,
      });
    } else {
      dispatchAccessibilityEvent('NAVIGATION_ERROR', {
        reason: 'FIRST_QUESTION',
        message: 'You are at the first question.',
      });
      if (options?.announce !== false) {
        useAnnouncerStore.getState().announce('You are at the first question.', 'polite', true);
      }
    }
  },

  jumpToQuestion: (index: number, options?: { announce?: boolean }) => {
    const { questions, currentIndex } = get();
    if (index >= 0 && index < questions.length) {
      const currentQ = questions[currentIndex];
      const targetQ = questions[index];
      set((state) => ({
        currentIndex: index,
        suppressAutoRead: options?.announce === false,
        isPaletteOpen: false,
        visitedQuestions: { ...state.visitedQuestions, [targetQ.id]: true },
      }));

      if (currentQ && targetQ && targetQ.section && currentQ.section && targetQ.section !== currentQ.section) {
        dispatchAccessibilityEvent('SECTION_CHANGED', {
          previousSection: currentQ.section,
          newSection: targetQ.section,
        });
      }

      dispatchAccessibilityEvent('QUESTION_CHANGED', {
        questionIndex: index,
        questionNumber: targetQ.questionNumber,
        totalQuestions: questions.length,
        questionText: targetQ.questionText,
        sectionName: targetQ.section,
        previousQuestionIndex: currentIndex,
      });
    }
  },

  selectOption: (optionNumber: number, options?: { announce?: boolean }) => {
    const { currentIndex, questions, selectedOptions } = get();
    const currentQ = questions[currentIndex];
    const opt = currentQ?.options?.find((o) => o.number === optionNumber);
    if (!opt || !currentQ) return;

    const updated = { ...selectedOptions, [currentQ.id]: optionNumber };
    set({ selectedOptions: updated });

    dispatchAccessibilityEvent('OPTION_SELECTED', {
      questionId: currentQ.id,
      questionNumber: currentQ.questionNumber,
      optionNumber,
      optionText: opt.text,
      silentSpeech: options?.announce === false,
    });

    if (options?.announce !== false) {
      useAnnouncerStore
        .getState()
        .announce(describeOptionSelection(currentQ, optionNumber), 'assertive', true, true);
    }
  },

  clearOption: (options?: { announce?: boolean }) => {
    const { currentIndex, questions, selectedOptions } = get();
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    if (selectedOptions[currentQ.id]) {
      const next = { ...selectedOptions };
      delete next[currentQ.id];
      set({ selectedOptions: next });

      dispatchAccessibilityEvent('ANSWER_CLEARED', {
        questionId: currentQ.id,
        questionNumber: currentQ.questionNumber,
      });

      if (options?.announce !== false) {
        useAnnouncerStore.getState().announce(
          `Selection cleared for Question ${currentQ.questionNumber}.`,
          'polite',
          true
        );
      }
    } else if (options?.announce !== false) {
      useAnnouncerStore.getState().announce(
        `No option was selected for Question ${currentQ.questionNumber}.`,
        'polite',
        true
      );
    }
  },

  toggleMarkForReview: () => {
    const { currentIndex, questions, markedForReview } = get();
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const isMarked = !!markedForReview[currentQ.id];
    const updated = { ...markedForReview, [currentQ.id]: !isMarked };
    set({ markedForReview: updated });

    dispatchAccessibilityEvent('MARK_FOR_REVIEW', {
      questionId: currentQ.id,
      questionNumber: currentQ.questionNumber,
      isMarked: !isMarked,
    });
  },

  /**
   * Loads the exam catalog from the active data source.
   *
   * In api mode this is the ONLY way questions enter the app, and the server
   * strips the answer key before sending. In offline mode it is a no-op
   * because the catalog is already seeded from the bundled data.
   */
  loadCatalog: async () => {
    set({ isCatalogLoading: true, catalogError: null });
    try {
      const { exams, drills } = await getDataSource().exams.getFullCatalog();
      set({ availableExams: exams, availablePracticeDrills: drills, catalogError: null });

      // Keep the placeholder currentExam pointing at something real so the
      // header does not read "Loading examinations…" forever.
      const all = get();
      if (!all.currentExam.id) {
        const first = all.availableExams[0] ?? all.availablePracticeDrills[0];
        if (first) set({ currentExam: first });
      }
    } catch (err) {
      // Swallowing this used to leave an empty catalog and a "no examinations
      // have been published yet" message, which reads as an empty database when
      // the truth is usually "the server is unreachable" or "your session
      // expired". Both need very different responses from the user.
      const message =
        err instanceof Error ? err.message : 'Could not reach the DristiX server.';
      set({ catalogError: message });
    } finally {
      set({ isCatalogLoading: false });
    }
  },

  setExamMode: (mode) => {
    set({ examMode: mode });
    useAnnouncerStore.getState().announce(
      `Switched to ${mode === 'exam' ? 'Exam Mode (timed simulation)' : 'Practice Mode (with hints and solutions)'}.`,
      'polite',
      true
    );
  },

  setTimer: (sec, formatted) => {
    set({ timeRemaining: sec, formattedTime: formatted });
  },

  setPaletteOpen: (open) => set({ isPaletteOpen: open }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setShortcutsOpen: (open) => set({ isShortcutsOpen: open }),
  setSubmitModalOpen: (open) => set({ isSubmitModalOpen: open }),
  setActiveSectionFilter: (section) => set({ activeSectionFilter: section }),

  setPortalTab: (tab) => {
    set({ portalTab: tab });
    soundEffects.playSelect();
    useAnnouncerStore
      .getState()
      .announce(
        tab === 'exams'
           ? 'Switched to Mock Examinations Catalog. Showing timed tests with negative marking.'
           : 'Switched to Practice Arena. Showing topic-wise drills with helpful hints and step-by-step solutions.',
        'assertive',
        true
      );
  },

  selectExam: async (
    examId: string,
    forceMode?: 'exam' | 'practice',
    options?: { announce?: boolean }
  ) => {
    const { activeView, isSubmitted, currentExam } = get();

    // STRICT INTEGRITY: If candidate is taking a test, prevent switching exams before submitting
    if (activeView === 'exam' && !isSubmitted && currentExam?.id !== examId) {
      set({ isSubmitModalOpen: true });
      soundEffects.playTimerAlert();
      useAnnouncerStore
        .getState()
        .announce(
          'An exam is currently in progress. You cannot leave or start another test before submitting this one. Please confirm submission.',
          'assertive',
          true
        );
      return;
    }

    const { availableExams, availablePracticeDrills } = get();
    const allAvailable = [...availableExams, ...availablePracticeDrills];
    const exam = allAvailable.find((e) => e.id === examId) || allAvailable[0];
    if (!exam || !exam.id) {
      useAnnouncerStore
        .getState()
        .announce('No examinations are available yet. Please contact your administrator.', 'assertive', true);
      return;
    }
    const isPractice = availablePracticeDrills.some((e) => e.id === exam.id);
    const targetMode = forceMode || (isPractice ? 'practice' : 'exam');

    // Start (or resume) the attempt through the data source. In api mode this
    // is where the server hands over the question set and the deadline, and
    // where the answer key is withheld.
    let started: StartAttemptResult;
    try {
      started = await getDataSource().exams.startAttempt(exam.id, targetMode);
    } catch (err) {
      useAnnouncerStore
        .getState()
        .announce(
          err instanceof Error ? err.message : 'Could not start this examination.',
          'assertive',
          true
        );
      return;
    }

    // In api mode the server owns the clock; the Web Worker then only keeps the
    // display ticking smoothly between heartbeats.
    const remaining = started.clock.remainingSeconds;
    const h = String(Math.floor(remaining / 3600)).padStart(2, '0');
    const m = String(Math.floor((remaining % 3600) / 60)).padStart(2, '0');
    const s = String(remaining % 60).padStart(2, '0');

    const questions = started.questions as unknown as QuestionItem[];

    // Never navigate into an exam the server gave no questions for. The server
    // refuses to start an empty exam, so this should be unreachable — but the
    // screen it produces is a dead end, and an explicit message beats it.
    if (questions.length === 0) {
      useAnnouncerStore
        .getState()
        .announce(
          `${exam.title} has no questions yet. Please contact your administrator.`,
          'assertive',
          true
        );
      return;
    }

    set({
      currentExam: { ...exam, questions },
      questions,
      attemptId: started.attemptId,
      expiresAtMs: new Date(started.clock.expiresAt).getTime(),
      currentIndex: started.state?.currentIndex ?? 0,
      selectedOptions: started.state?.selectedOptions ?? {},
      markedForReview: started.state?.markedForReview ?? {},
      visitedQuestions: started.state?.visitedQuestions ?? (questions.length > 0 ? { [questions[0].id]: true } : {}),
      examMode: started.questions[0]?.hint !== undefined ? 'practice' : targetMode,
      isSubmitted: false,
      submissionTime: null,
      serverReport: null,
      timeRemaining: remaining,
      formattedTime: `${h}:${m}:${s}`,
      activeView: 'exam',
      activeSectionFilter: 'All',
      isPaletteOpen: false,
      isSubmitModalOpen: false,
      isSettingsOpen: false,
      isShortcutsOpen: false,
    });

    soundEffects.playNavigate();
    const mode = get().examMode;
    const speechMsg =
      mode === 'practice'
        ? `Starting Practice Drill: ${exam.title}. Total ${questions.length} questions. Helpful Hints and Step-by-Step Solutions are enabled. Question 1 loaded.`
        : `Starting ${exam.title}. Total ${questions.length} questions. Time limit: ${exam.durationMinutes} minutes. Question 1 loaded.`;

    // Skipped when the caller has already said its own piece. Every
    // announcement interrupts the last, so two of them for one action means the
    // first is cut off part-way through.
    if (options?.announce !== false) {
      useAnnouncerStore.getState().announce(speechMsg, 'assertive', true);
    }
  },

  /**
   * Pushes the current progress to the server immediately.
   *
   * Normally the automatic debounced save below handles this, so components do
   * not call it. It exists for the flush that must happen right before submit.
   */
  persistState: () => {
    const { attemptId } = get();
    if (!attemptId) return;
    const s = get();
    void getDataSource()
      .exams.saveState(attemptId, {
        currentIndex: s.currentIndex,
        selectedOptions: s.selectedOptions,
        markedForReview: s.markedForReview,
        visitedQuestions: s.visitedQuestions,
      })
      .catch(() => {
        // Best-effort; submit sends the authoritative copy anyway.
      });
  },

  returnToCatalog: () => {
    const { activeView, isSubmitted } = get();

    // STRICT INTEGRITY: Cannot leave an active mock test or practice exam before submitting it
    if (activeView === 'exam' && !isSubmitted) {
      set({ isSubmitModalOpen: true });
      soundEffects.playTimerAlert();
      useAnnouncerStore
        .getState()
        .announce(
          'You cannot go back before submitting the exam. Submit confirmation modal is open. Please submit your test first.',
          'assertive',
          true
        );
      return;
    }

    set({
      activeView: 'catalog',
      portalTab: 'exams',
      isSubmitted: false,
      isPaletteOpen: false,
      isSubmitModalOpen: false,
      isSettingsOpen: false,
      isShortcutsOpen: false,
    });
    soundEffects.playNavigate();
    useAnnouncerStore
      .getState()
      .announce(
        'Returned to Examination Catalog. All available mock tests are ready for you. Say "Start SSC CGL" or "Start Exam 1" to begin.',
        'polite',
        true
      );
  },

  openAnalytics: () => {
    const { activeView, isSubmitted } = get();

    // STRICT INTEGRITY: Cannot open analytics during active unsubmitted exam
    if (activeView === 'exam' && !isSubmitted) {
      set({ isSubmitModalOpen: true });
      soundEffects.playTimerAlert();
      useAnnouncerStore
        .getState()
        .announce(
          'You cannot navigate away to analytics during an active test. Please submit your exam first.',
          'assertive',
          true
        );
      return;
    }

    set({
      activeView: 'analytics',
      isSubmitted: false,
      isPaletteOpen: false,
      isSubmitModalOpen: false,
    });
    soundEffects.playSelect();
    useAnnouncerStore
      .getState()
      .announce(
        'Opened Student Performance Analytics Dashboard. Press B or Escape to return to tests.',
        'assertive',
        true
      );
  },

  submitExam: async () => {
    const { currentExam, examMode, attemptId } = get();

    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }

    let report: GradeResult | null = null;

    if (attemptId) {
      try {
        // Authoritative grading. The server holds the answer key, so the score
        // shown to the student is the server's, never the browser's.
        // Send final selected options directly with the submit call so debounced autosaves don't drop answers.
        const finalState = {
          currentIndex: get().currentIndex,
          selectedOptions: get().selectedOptions,
          markedForReview: get().markedForReview,
          visitedQuestions: get().visitedQuestions,
        };
        report = await getDataSource().exams.submitAttempt(attemptId, finalState);
      } catch (err) {
        useAnnouncerStore
          .getState()
          .announce(
            err instanceof Error
              ? `Could not submit: ${err.message}`
              : 'Could not submit this examination. Please try again.',
            'assertive',
            true
          );
        return;
      }
    }

    // Offline mode still grades locally, because there is no server to ask.
    if (!report) {
      const local = get().getDiagnosticReport();
      report = {
        ...local,
        attemptId: attemptId ?? 'local',
        examTitle: local.examTitle,
        status: 'submitted',
        questions: get().questions as unknown as GradeResult['questions'],
      } as GradeResult;
    }

    soundEffects.playSuccess();

    // The server's graded questions now legitimately carry correctOption and
    // explanation, so swapping them in lets DiagnosticReport work unchanged.
    if (report.questions?.length) {
      set({ questions: report.questions as unknown as QuestionItem[] });
    }

    useAuthStore.getState().addSubmission({
      examId: currentExam.id,
      examTitle: currentExam.title,
      examCode: currentExam.code,
      examType: examMode,
      score: report.totalScore,
      maxScore: report.maxScore,
      percentage: report.scorePercentage,
      correctCount: report.correctCount,
      incorrectCount: report.incorrectCount,
      unattemptedCount: report.unattemptedCount,
    });

    set({
      isSubmitted: true,
      isSubmitModalOpen: false,
      submissionTime: Date.now(),
      serverReport: report,
    });

    useAnnouncerStore.getState().announce(
      `Exam successfully submitted. You scored ${report.totalScore} out of ${report.maxScore}, which is ${report.scorePercentage} percent correct. Showing your diagnostic and performance analytics report.`,
      'assertive',
      true
    );
  },

  addNewExam: async (newExam: Exam, mode: 'exam' | 'practice') => {
    try {
      // The data source decides where this lands. Publishing has to go through
      // the server or no student would ever see the exam.
      await getDataSource().exams.createExam(newExam, mode);
      await get().loadCatalog();
    } catch (err) {
      // The caller needs this text, not just a boolean: "it may already exist,
      // or the server rejected it" leaves an examiner guessing at which field
      // was wrong when the server has already said so.
      const message = err instanceof Error ? err.message : 'The server rejected the examination.';
      useAnnouncerStore
        .getState()
        .announce(`Could not publish the examination: ${message}`, 'assertive', true);
      return { ok: false, message };
    }

    soundEffects.playSuccess();
    useAnnouncerStore
      .getState()
      .announce(`New examination "${newExam.title}" published successfully.`, 'assertive', true);
    return { ok: true };
  },

  loadExamForEdit: async (examId: string) => {
    try {
      const exam = await getDataSource().exams.getExamForEdit(examId);
      return exam;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not fetch exam for editing.';
      useAnnouncerStore.getState().announce(message, 'assertive', true);
      return null;
    }
  },

  updateExistingExam: async (examId: string, updatedExam: Exam, mode: 'exam' | 'practice') => {
    try {
      await getDataSource().exams.updateExam(examId, updatedExam, mode);
      await get().loadCatalog();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The server rejected the examination update.';
      useAnnouncerStore
        .getState()
        .announce(`Could not update the examination: ${message}`, 'assertive', true);
      return { ok: false, message };
    }

    soundEffects.playSuccess();
    useAnnouncerStore
      .getState()
      .announce(`Examination "${updatedExam.title}" updated successfully.`, 'assertive', true);
    return { ok: true };
  },

  deleteCustomExam: async (examId: string) => {
    try {
      await getDataSource().exams.deleteExam(examId);
    } catch (err) {
      useAnnouncerStore
        .getState()
        .announce(
          err instanceof Error
            ? `Could not remove the examination: ${err.message}`
            : 'Could not remove the examination.',
          'assertive',
          true
        );
      return;
    }

    // Re-read from the source rather than patching local state, so a server
    // delete that also removed attempts stays consistent.
    await get().loadCatalog();

    if (!get().currentExam.id) {
      set({ currentExam: EMPTY_EXAM, questions: [] });
    }

    soundEffects.playSelect();
    useAnnouncerStore.getState().announce('Examination removed from catalog.', 'polite', true);
  },

  resetExam: () => {
    const { currentExam, questions } = get();

    // There is nothing to retake unless a question set is actually loaded.
    //
    // This used to set activeView to 'exam' unconditionally, which navigated to
    // the exam screen with an empty `questions` array whenever it was triggered
    // from the catalog — via a voice intent or the retake shortcut — producing
    // "No Questions Found". Staying put is the honest response.
    if (questions.length === 0) {
      useAnnouncerStore
        .getState()
        .announce(
          'There is no examination to retake yet. Open a test from the catalog first.',
          'assertive',
          true
        );
      return;
    }

    const durationSec = currentExam.durationMinutes * 60;
    const h = String(Math.floor(durationSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((durationSec % 3600) / 60)).padStart(2, '0');

    set({
      currentIndex: 0,
      selectedOptions: {},
      markedForReview: {},
      visitedQuestions: questions.length > 0 ? { [questions[0].id]: true } : {},
      isSubmitted: false,
      submissionTime: null,
      timeRemaining: durationSec,
      formattedTime: `${h}:${m}:00`,
      activeView: 'exam',
    });
    useAnnouncerStore
      .getState()
      .announce(`Examination reset for ${currentExam.title}. Ready to start.`, 'polite', true);
  },

  announceCurrentQuestion: (speakTTS = true, includeOptions = true) => {
    const { currentIndex, questions, selectedOptions, markedForReview } = get();
    const currentQ = questions[currentIndex];
    const isMarked = markedForReview[currentQ.id];
    const selectedOpt = selectedOptions[currentQ.id];

    let msg = `Question ${currentQ.questionNumber} of ${questions.length}. Section: ${currentQ.section}. ${verbalizeForSpeech(currentQ.questionText)}. `;
    if (currentQ.mathLatex) {
      msg += `Equation: ${verbalizeMath(currentQ.mathLatex)}. `;
    }
    if (currentQ.diagramAiExplanation?.audioNarration || currentQ.diagramDescription) {
      msg += `Diagram details: ${currentQ.diagramAiExplanation?.audioNarration || currentQ.diagramDescription}. `;
    }
    if (currentQ.graph && currentQ.graph.enabled && currentQ.graph.data?.length) {
      const g = currentQ.graph;
      const unit = g.unit ? ` ${g.unit}` : '';
      const dataStr = g.data.map((d) => `${d.label}: ${d.value}${unit}`).join(', ');
      msg += `This question includes an interactive audio ${g.type} chart titled "${g.title || 'Data Graph'}". Chart data points are: ${dataStr}. You can press Left and Right arrow keys on the chart to hear the pitch tones, or say "play graph" for a guided audio tour. `;
    }

    if (includeOptions && currentQ.options && currentQ.options.length > 0) {
      msg += `Options are: `;
      currentQ.options.forEach((opt) => {
        const mathVerbal = opt.mathLatex ? verbalizeMath(opt.mathLatex).trim() : '';
        const rawText = opt.text ? opt.text.trim() : '';
        let optCombined = rawText;
        if (mathVerbal) {
          const normRaw = rawText.toLowerCase().replace(/\s+/g, ' ');
          const normMath = mathVerbal.toLowerCase().replace(/\s+/g, ' ');
          if (normRaw && (normRaw.includes(normMath) || normMath.includes(normRaw))) {
            optCombined = rawText || mathVerbal;
          } else if (rawText) {
            optCombined = `${rawText}, ${mathVerbal}`;
          } else {
            optCombined = mathVerbal;
          }
        }
        const optText = verbalizeForSpeech(optCombined);
        msg += `Option ${opt.number}: ${optText}. `;
      });
    }

    if (selectedOpt) {
      msg += `Currently selected: Option ${selectedOpt}. `;
    } else {
      msg += `Not yet answered. `;
    }
    if (isMarked) {
      msg += `Marked for review.`;
    }

    useAnnouncerStore.getState().announce(msg, 'polite', speakTTS);
  },

  /**
   * Voice-assistant entry point for "read question". Assertive priority and TTS
   * are forced on so the spoken answer is not swallowed by polite live regions.
   */
  readCurrentQuestion: () => {
    const { currentIndex, questions } = get();
    const currentQ = questions[currentIndex];
    if (!currentQ) {
      useAnnouncerStore
        .getState()
        .announce('There is no question loaded right now.', 'assertive', true);
      return;
    }
    get().announceCurrentQuestion(true, true);
  },

  /**
   * Voice-assistant entry point for "how much time is left".
   */
  readTimer: () => {
    const { timeRemaining, formattedTime, isSubmitted } = get();
    const isHindi = isHindiPreferred();
    if (isSubmitted) {
      useAnnouncerStore
        .getState()
        .announce(
          isHindi
            ? 'यह परीक्षा पहले ही सबमिट हो चुकी है, इसलिए टाइमर अब नहीं चल रहा है।'
            : 'This test has already been submitted, so the timer is no longer running.',
          'assertive',
          true
        );
      return;
    }
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    useAnnouncerStore
      .getState()
      .announce(
        isHindi
          ? `शेष समय: ${minutes} मिनट और ${seconds} सेकंड। टाइमर: ${formattedTime}।`
          : `Time remaining: ${minutes} minutes and ${seconds} seconds. Timer display: ${formattedTime}.`,
        'assertive',
        true
      );
  },

  getDiagnosticReport: (): DiagnosticReportData => {
    // In api mode the grade was computed on the server. Returning it keeps a
    // single source of truth, and avoids recomputing a score the client has no
    // answer key to compute correctly.
    const server = get().serverReport;
    if (server) {
      return {
        examTitle: server.examTitle,
        totalQuestions: server.totalQuestions,
        attemptedCount: server.attemptedCount,
        correctCount: server.correctCount,
        incorrectCount: server.incorrectCount,
        unattemptedCount: server.unattemptedCount,
        markedCount: server.markedCount,
        scorePercentage: server.scorePercentage,
        totalScore: server.totalScore,
        maxScore: server.maxScore,
        sectionDiagnostics: server.sectionDiagnostics,
        verbalSummary: server.verbalSummary,
        weakAreas: server.weakAreas,
        strongAreas: server.strongAreas,
      };
    }

    const { currentExam, questions, selectedOptions, markedForReview } = get();
    const totalQuestions = questions.length;
    let attemptedCount = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let markedCount = 0;

    const sectionMap: Record<string, { total: number; attempted: number; correct: number }> = {};

    questions.forEach((q) => {
      if (!sectionMap[q.section]) {
        sectionMap[q.section] = { total: 0, attempted: 0, correct: 0 };
      }
      sectionMap[q.section].total++;

      if (markedForReview[q.id]) {
        markedCount++;
      }

      const userAns = selectedOptions[q.id];
      if (userAns !== undefined) {
        attemptedCount++;
        sectionMap[q.section].attempted++;
        if (userAns === q.correctOption) {
          correctCount++;
          sectionMap[q.section].correct++;
        } else {
          incorrectCount++;
        }
      }
    });

    const unattemptedCount = Math.max(0, totalQuestions - attemptedCount);
    const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const totalScore = Number((correctCount * 2 - incorrectCount * 0.5).toFixed(2)); // +2 for correct, -0.5 for incorrect
    const maxScore = totalQuestions * 2;

    const sectionDiagnostics: SectionDiagnostic[] = Object.entries(sectionMap).map(
      ([secName, stats]) => ({
        section: secName,
        total: stats.total,
        attempted: stats.attempted,
        correct: stats.correct,
        accuracy: stats.attempted > 0 ? Math.round((stats.correct / stats.attempted) * 100) : 0,
      })
    );

    const weakAreas: string[] = [];
    const strongAreas: string[] = [];

    sectionDiagnostics.forEach((s) => {
      if (s.attempted === 0 || s.accuracy < 60) {
        weakAreas.push(`${s.section} (Accuracy: ${s.accuracy}%)`);
      } else {
        strongAreas.push(`${s.section} (Accuracy: ${s.accuracy}%)`);
      }
    });

    const verbalSummary: string[] = [
      `Overall Score: ${totalScore} out of ${maxScore} maximum points (${scorePercentage}% correct).`,
      `Attempted: ${attemptedCount} of ${totalQuestions} questions (${correctCount} correct, ${incorrectCount} incorrect).`,
      `Unattempted: ${unattemptedCount} questions.`,
      `Marked for review during exam: ${markedCount} questions.`,
      weakAreas.length > 0
        ? `Focus areas recommended for practice: ${weakAreas.join(', ')}.`
        : `Excellent performance across all sections.`,
    ];

    return {
      examTitle: currentExam.title,
      totalQuestions,
      attemptedCount,
      correctCount,
      incorrectCount,
      unattemptedCount,
      markedCount,
      scorePercentage,
      totalScore,
      maxScore,
      sectionDiagnostics,
      verbalSummary,
      weakAreas,
      strongAreas,
    };
  },
}));

/**
 * Debounced autosave.
 *
 * Option clicks, navigation and mark-for-review all mutate local state
 * synchronously so the UI never waits on the network, and this subscriber
 * pushes a snapshot a moment after the student stops interacting. Subscribing
 * rather than calling a save from each action means a newly added mutation
 * cannot silently forget to persist.
 *
 * The server merges each patch, so a dropped request never loses earlier
 * answers, and submit sends an authoritative copy regardless.
 */
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

useExamStore.subscribe((state, prev) => {
  if (!state.attemptId) return;
  if (state.activeView !== 'exam' || state.isSubmitted) return;

  const changed =
    state.selectedOptions !== prev.selectedOptions ||
    state.markedForReview !== prev.markedForReview ||
    state.visitedQuestions !== prev.visitedQuestions ||
    state.currentIndex !== prev.currentIndex;
  if (!changed) return;

  if (autosaveTimer !== null) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    const s = useExamStore.getState();
    if (!s.attemptId) return;
    void getDataSource()
      .exams.saveState(s.attemptId, {
        currentIndex: s.currentIndex,
        selectedOptions: s.selectedOptions,
        markedForReview: s.markedForReview,
        visitedQuestions: s.visitedQuestions,
      })
      .catch(() => {
        // Best-effort. The next change retries; submit sends the final copy.
      });
  }, 1200);
});
