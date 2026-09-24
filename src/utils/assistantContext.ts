import { useExamStore } from '../store/useExamStore';
import { useAuthStore } from '../store/useAuthStore';
import type { QuestionItem } from '../data/questions';

export interface PageContextSnapshot {
  activeView: 'catalog' | 'exam' | 'analytics' | 'report';
  isSubmitted: boolean;
  portalTab: 'exams' | 'practice';
  studentName: string;
  studentRoll: string;
  totalSubmissions: number;
  bestScorePercentage: number;
  bestScoreTitle: string;
  averageAccuracy: number;

  // Diagnostic Report context (if activeView === 'report')
  diagnosticReport?: {
    examTitle: string;
    totalScore: number;
    maxScore: number;
    scorePercentage: number;
    attemptedCount: number;
    correctCount: number;
    incorrectCount: number;
    unattemptedCount: number;
    verbalSummary: string[];
  };

  // Catalog context
  availableExams: {
    id: string;
    code: string;
    title: string;
    durationMinutes: number;
    questionCount: number;
    category: string;
    difficulty: string;
    negativeMarking: string;
  }[];
  availableDrills: {
    id: string;
    code: string;
    title: string;
    durationMinutes: number;
    questionCount: number;
    category: string;
  }[];

  // Active Exam context (if activeView === 'exam')
  currentExam?: {
    id: string;
    code: string;
    title: string;
    totalQuestions: number;
    currentQuestionNumber: number;
    durationMinutes: number;
    timeRemainingFormatted: string;
    remainingMinutes: number;
    remainingSeconds: number;
    isPractice: boolean;
  };
  currentQuestion?: {
    number: number;
    text: string;
    section: string;
    equationLatex?: string;
    options: { number: number; text: string; isSelected: boolean }[];
    selectedOption: number | null;
    isMarkedForReview: boolean;
    hint?: string;
    explanation?: string;
  };
}

export function getAssistantContext(): PageContextSnapshot {
  const examStore = useExamStore.getState();
  const authStore = useAuthStore.getState();

  const student = authStore.currentStudent || {
    name: 'Candidate',
    rollNumber: 'DX-000',
    id: 'std-guest',
    accessibilityPreference: 'Standard',
  };

  const studentSubs = authStore.submissions.filter(
    (s) =>
      s.studentRoll.toLowerCase() === student.rollNumber.toLowerCase() ||
      s.studentId === student.id
  );

  let bestScorePercentage = 0;
  let bestScoreTitle = 'None';
  let sumAcc = 0;
  studentSubs.forEach((s) => {
    sumAcc += s.percentage;
    if (s.percentage > bestScorePercentage) {
      bestScorePercentage = Math.round(s.percentage);
      bestScoreTitle = s.examTitle;
    }
  });
  const avgAccuracy = studentSubs.length > 0 ? Math.round(sumAcc / studentSubs.length) : 0;

  const catalogExams = examStore.availableExams.map((e) => ({
    id: e.id,
    code: e.code,
    title: e.title,
    durationMinutes: e.durationMinutes,
    questionCount: e.questions.length,
    category: e.category,
    difficulty: e.difficulty,
    negativeMarking: e.negativeMarking,
  }));

  const catalogDrills = examStore.availablePracticeDrills.map((d) => ({
    id: d.id,
    code: d.code,
    title: d.title,
    durationMinutes: d.durationMinutes,
    questionCount: d.questions.length,
    category: d.category,
  }));

  let activeView: 'catalog' | 'exam' | 'analytics' | 'report' = examStore.activeView;

  // Ground truth check from DOM: what is ACTUALLY rendered in front of the user's eyes?
  let portalTab = examStore.portalTab;
  if (typeof document !== 'undefined') {
    const catalogHeadingEl = document.getElementById('catalog-heading');
    const isCatalogInDOM = !!catalogHeadingEl || !!document.querySelector('input[placeholder*="Search"]');
    const isReportInDOM = !!document.getElementById('report-main-title') || (examStore.activeView === 'exam' && examStore.isSubmitted);
    const isExamInDOM = !isReportInDOM && (!!document.getElementById('q-heading') || !!document.querySelector('[role="radiogroup"]'));
    const isAnalyticsInDOM = !!document.getElementById('student-analytics-view');

    if (isReportInDOM) {
      activeView = 'report';
    } else if (isCatalogInDOM && !isExamInDOM) {
      activeView = 'catalog';
      if (examStore.activeView !== 'catalog') {
        useExamStore.setState({ activeView: 'catalog' });
      }
      if (catalogHeadingEl) {
        const headingText = catalogHeadingEl.textContent || '';
        if (headingText.includes('Practice')) {
          portalTab = 'practice';
          if (examStore.portalTab !== 'practice') {
            useExamStore.setState({ portalTab: 'practice' });
          }
        } else if (headingText.includes('Examination') || headingText.includes('Mock')) {
          portalTab = 'exams';
          if (examStore.portalTab !== 'exams') {
            useExamStore.setState({ portalTab: 'exams' });
          }
        }
      }
    } else if (isExamInDOM) {
      activeView = 'exam';
      if (examStore.activeView !== 'exam') {
        useExamStore.setState({ activeView: 'exam' });
      }
    } else if (isAnalyticsInDOM) {
      activeView = 'analytics';
      if (examStore.activeView !== 'analytics') {
        useExamStore.setState({ activeView: 'analytics' });
      }
    }
  }

  const snapshot: PageContextSnapshot = {
    activeView: activeView,
    isSubmitted: examStore.isSubmitted,
    portalTab: portalTab,
    studentName: student.name,
    studentRoll: student.rollNumber,
    totalSubmissions: studentSubs.length,
    bestScorePercentage,
    bestScoreTitle,
    averageAccuracy: avgAccuracy,
    availableExams: catalogExams,
    availableDrills: catalogDrills,
  };

  if (activeView === 'report') {
    try {
      const rep = examStore.getDiagnosticReport();
      snapshot.diagnosticReport = {
        examTitle: rep.examTitle,
        totalScore: rep.totalScore,
        maxScore: rep.maxScore,
        scorePercentage: rep.scorePercentage,
        attemptedCount: rep.attemptedCount,
        correctCount: rep.correctCount,
        incorrectCount: rep.incorrectCount,
        unattemptedCount: rep.unattemptedCount,
        verbalSummary: rep.verbalSummary,
      };
    } catch {
      // fallback
    }
  }

  if (activeView === 'exam' && examStore.currentExam) {
    const curExam = examStore.currentExam;
    const curQ: QuestionItem | undefined = examStore.questions[examStore.currentIndex];
    const selectedOpt = curQ ? examStore.selectedOptions[curQ.id] || null : null;
    const isMarked = curQ ? !!examStore.markedForReview[curQ.id] : false;

    snapshot.currentExam = {
      id: curExam.id,
      code: curExam.code,
      title: curExam.title,
      totalQuestions: examStore.questions.length,
      currentQuestionNumber: examStore.currentIndex + 1,
      durationMinutes: curExam.durationMinutes,
      timeRemainingFormatted: examStore.formattedTime,
      remainingMinutes: Math.floor(examStore.timeRemaining / 60),
      remainingSeconds: examStore.timeRemaining % 60,
      isPractice: examStore.examMode === 'practice',
    };

    if (curQ) {
      snapshot.currentQuestion = {
        number: curQ.questionNumber,
        text: curQ.questionText,
        section: curQ.section,
        equationLatex: curQ.mathLatex,
        options: curQ.options.map((opt) => ({
          number: opt.number,
          text: opt.text,
          isSelected: selectedOpt === opt.number,
        })),
        selectedOption: selectedOpt,
        isMarkedForReview: isMarked,
        hint: curQ.hint,
        explanation: curQ.explanation,
      };
    }
  }

  return snapshot;
}
