import { create } from 'zustand';
import { EXAMS_CATALOG } from '../data/exams';
import { PRACTICE_DRILLS_CATALOG } from '../data/practiceDrills';
import type { Exam } from '../data/exams';
import type { QuestionItem } from '../data/questions';
import { soundEffects } from '../utils/soundEffects';
import { useAnnouncerStore } from './useAnnouncerStore';
import { verbalizeMath } from '../utils/mathVerbalizer';
import { useAuthStore } from './useAuthStore';

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

interface ExamState {
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

  // View & Exam Actions
  setPortalTab: (tab: 'exams' | 'practice') => void;
  selectExam: (examId: string, forceMode?: 'exam' | 'practice') => void;
  returnToCatalog: () => void;
  openAnalytics: () => void;
  addNewExam: (newExam: Exam, mode: 'exam' | 'practice') => void;
  deleteCustomExam: (examId: string) => void;

  // Question navigation actions
  nextQuestion: () => void;
  previousQuestion: () => void;
  jumpToQuestion: (index: number) => void;
  selectOption: (optionNumber: number) => void;
  clearOption: () => void;
  toggleMarkForReview: () => void;
  setExamMode: (mode: 'exam' | 'practice') => void;
  setTimer: (sec: number, formatted: string) => void;
  setPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setSubmitModalOpen: (open: boolean) => void;
  setActiveSectionFilter: (section: string) => void;
  submitExam: () => void;
  resetExam: () => void;
  getDiagnosticReport: () => DiagnosticReportData;
  announceCurrentQuestion: (speakTTS?: boolean) => void;
}

const loadStoredExams = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const initialExams = loadStoredExams<Exam[]>('dristix_exams', EXAMS_CATALOG);
const initialDrills = loadStoredExams<Exam[]>('dristix_practice_drills', PRACTICE_DRILLS_CATALOG);
const defaultExam = initialExams[0] || EXAMS_CATALOG[0];

export const useExamStore = create<ExamState>((set, get) => ({
  portalTab: 'exams',
  availableExams: initialExams,
  availablePracticeDrills: initialDrills,
  currentExam: defaultExam,
  activeView: 'catalog', // Default landing on the accessible catalog dashboard
  questions: defaultExam.questions,
  currentIndex: 0,
  selectedOptions: {},
  markedForReview: {},
  visitedQuestions: { [defaultExam.questions[0].id]: true },
  examMode: 'exam',
  isSubmitted: false,
  submissionTime: null,
  timeRemaining: defaultExam.durationMinutes * 60,
  formattedTime: `${String(Math.floor(defaultExam.durationMinutes / 60)).padStart(2, '0')}:${String(
    defaultExam.durationMinutes % 60
  ).padStart(2, '0')}:00`,
  isPaletteOpen: false,
  isSettingsOpen: false,
  isShortcutsOpen: false,
  isSubmitModalOpen: false,
  activeSectionFilter: 'All',

  nextQuestion: () => {
    const { currentIndex, questions } = get();
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      const nextQ = questions[nextIdx];
      set((state) => ({
        currentIndex: nextIdx,
        visitedQuestions: { ...state.visitedQuestions, [nextQ.id]: true },
      }));
      soundEffects.playNavigate();
    } else {
      useAnnouncerStore.getState().announce('You are at the last question.', 'polite', true);
    }
  },

  previousQuestion: () => {
    const { currentIndex, questions } = get();
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      const prevQ = questions[prevIdx];
      set((state) => ({
        currentIndex: prevIdx,
        visitedQuestions: { ...state.visitedQuestions, [prevQ.id]: true },
      }));
      soundEffects.playNavigate();
    } else {
      useAnnouncerStore.getState().announce('You are at the first question.', 'polite', true);
    }
  },

  jumpToQuestion: (index: number) => {
    const { questions } = get();
    if (index >= 0 && index < questions.length) {
      const targetQ = questions[index];
      set((state) => ({
        currentIndex: index,
        isPaletteOpen: false,
        visitedQuestions: { ...state.visitedQuestions, [targetQ.id]: true },
      }));
      soundEffects.playNavigate();
    }
  },

  selectOption: (optionNumber: number) => {
    const { currentIndex, questions, selectedOptions } = get();
    const currentQ = questions[currentIndex];
    const opt = currentQ.options.find((o) => o.number === optionNumber);
    if (!opt) return;

    const updated = { ...selectedOptions, [currentQ.id]: optionNumber };
    set({ selectedOptions: updated });
    soundEffects.playSelect();

    const optSpeech = opt.mathLatex ? `${opt.text}, ${verbalizeMath(opt.mathLatex)}` : opt.text;
    useAnnouncerStore.getState().announce(
      `Option ${optionNumber} selected: ${optSpeech}.`,
      'assertive',
      true,
      true
    );
  },

  clearOption: () => {
    const { currentIndex, questions, selectedOptions } = get();
    const currentQ = questions[currentIndex];
    if (selectedOptions[currentQ.id]) {
      const next = { ...selectedOptions };
      delete next[currentQ.id];
      set({ selectedOptions: next });
      soundEffects.playClear();
      useAnnouncerStore.getState().announce(
        `Selection cleared for Question ${currentQ.questionNumber}.`,
        'polite',
        true
      );
    } else {
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
    const isMarked = !!markedForReview[currentQ.id];
    const updated = { ...markedForReview, [currentQ.id]: !isMarked };
    set({ markedForReview: updated });
    soundEffects.playMark();

    const statusMsg = !isMarked
      ? `Question ${currentQ.questionNumber} marked for review.`
      : `Question ${currentQ.questionNumber} unmarked from review.`;
    useAnnouncerStore.getState().announce(statusMsg, 'polite', true);
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

  selectExam: (examId: string, forceMode?: 'exam' | 'practice') => {
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
    const isPractice = availablePracticeDrills.some((e) => e.id === exam.id);
    const targetMode = forceMode || (isPractice ? 'practice' : 'exam');

    const durationSec = exam.durationMinutes * 60;
    const h = String(Math.floor(durationSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((durationSec % 3600) / 60)).padStart(2, '0');

    set({
      currentExam: exam,
      questions: exam.questions,
      currentIndex: 0,
      selectedOptions: {},
      markedForReview: {},
      visitedQuestions: { [exam.questions[0].id]: true },
      examMode: targetMode,
      isSubmitted: false,
      submissionTime: null,
      timeRemaining: durationSec,
      formattedTime: `${h}:${m}:00`,
      activeView: 'exam',
      activeSectionFilter: 'All',
      isPaletteOpen: false,
      isSubmitModalOpen: false,
      isSettingsOpen: false,
      isShortcutsOpen: false,
    });

    soundEffects.playNavigate();
    const speechMsg =
      targetMode === 'practice'
        ? `Starting Practice Drill: ${exam.title}. Total ${exam.questions.length} questions. Helpful Hints and Step-by-Step Solutions are enabled. Question 1 loaded.`
        : `Starting ${exam.title}. Total ${exam.questions.length} questions. Time limit: ${exam.durationMinutes} minutes. Question 1 loaded.`;

    useAnnouncerStore.getState().announce(speechMsg, 'assertive', true);
  },

  returnToCatalog: () => {
    const { activeView, isSubmitted, portalTab } = get();

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
        `Returned to ${portalTab === 'practice' ? 'Practice Arena' : 'Examination Catalog'}. Choose a module to begin.`,
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

  submitExam: () => {
    soundEffects.playSuccess();
    const { currentExam, examMode, getDiagnosticReport } = get();
    const report = getDiagnosticReport();

    // Automatically record exam submission for student tracking & admin analytics
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
    });
    useAnnouncerStore.getState().announce(
      'Exam successfully submitted. Showing diagnostic and performance analytics report.',
      'assertive',
      true
    );
  },

  addNewExam: (newExam: Exam, mode: 'exam' | 'practice') => {
    if (mode === 'practice') {
      const updated = [newExam, ...get().availablePracticeDrills];
      set({ availablePracticeDrills: updated });
      try {
        localStorage.setItem('dristix_practice_drills', JSON.stringify(updated));
      } catch {}
    } else {
      const updated = [newExam, ...get().availableExams];
      set({ availableExams: updated });
      try {
        localStorage.setItem('dristix_exams', JSON.stringify(updated));
      } catch {}
    }
    soundEffects.playSuccess();
    useAnnouncerStore
      .getState()
      .announce(`New examination "${newExam.title}" published successfully.`, 'assertive', true);
  },

  deleteCustomExam: (examId: string) => {
    const updatedExams = get().availableExams.filter((e) => e.id !== examId);
    const updatedDrills = get().availablePracticeDrills.filter((e) => e.id !== examId);
    set({ availableExams: updatedExams, availablePracticeDrills: updatedDrills });
    try {
      localStorage.setItem('dristix_exams', JSON.stringify(updatedExams));
      localStorage.setItem('dristix_practice_drills', JSON.stringify(updatedDrills));
    } catch {}
    soundEffects.playSelect();
    useAnnouncerStore.getState().announce('Examination removed from catalog.', 'polite', true);
  },

  resetExam: () => {
    const { currentExam } = get();
    const durationSec = currentExam.durationMinutes * 60;
    const h = String(Math.floor(durationSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((durationSec % 3600) / 60)).padStart(2, '0');

    set({
      currentIndex: 0,
      selectedOptions: {},
      markedForReview: {},
      visitedQuestions: { [currentExam.questions[0].id]: true },
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

    let msg = `Question ${currentQ.questionNumber} of ${questions.length}. Section: ${currentQ.section}. ${currentQ.questionText}. `;
    if (currentQ.mathLatex) {
      msg += `Equation: ${verbalizeMath(currentQ.mathLatex)}. `;
    }

    if (includeOptions && currentQ.options && currentQ.options.length > 0) {
      msg += `Options are: `;
      currentQ.options.forEach((opt) => {
        const optText = opt.mathLatex ? `${opt.text}, ${verbalizeMath(opt.mathLatex)}` : opt.text;
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

  getDiagnosticReport: (): DiagnosticReportData => {
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

    const unattemptedCount = totalQuestions - attemptedCount;
    const scorePercentage = Math.round((correctCount / totalQuestions) * 100);
    const totalScore = correctCount * 2 - incorrectCount * 0.5; // +2 for correct, -0.5 for incorrect
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
