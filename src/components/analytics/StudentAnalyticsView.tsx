import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useExamStore } from '../../store/useExamStore';
import { useAnnouncerStore } from '../../store/useAnnouncerStore';
import { soundEffects } from '../../utils/soundEffects';
import {
  Award,
  TrendingUp,
  Clock,
  ArrowLeft,
  Volume2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
  RotateCcw,
  Target,
  Sparkles,
  BarChart3,
  Calendar,
} from 'lucide-react';

interface StudentAnalyticsViewProps {
  onReturnToCatalog: () => void;
}

export const StudentAnalyticsView: React.FC<StudentAnalyticsViewProps> = ({ onReturnToCatalog }) => {
  const { currentStudent, submissions } = useAuthStore();
  const { selectExam, availableExams, availablePracticeDrills } = useExamStore();
  const { announce } = useAnnouncerStore();

  const [typeFilter, setTypeFilter] = useState<'all' | 'exam' | 'practice'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(0);

  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // Filter submissions belonging strictly to the current logged-in student
  const studentSubmissions = useMemo(() => {
    if (!currentStudent) return [];
    return submissions.filter(
      (s) =>
        s.studentRoll.toLowerCase() === currentStudent.rollNumber.toLowerCase() ||
        s.studentId === currentStudent.id
    );
  }, [submissions, currentStudent]);

  // Derived Statistics & KPIs
  const stats = useMemo(() => {
    const total = studentSubmissions.length;
    if (total === 0) {
      return {
        totalTests: 0,
        examCount: 0,
        practiceCount: 0,
        bestScorePercent: 0,
        bestScoreTitle: 'N/A',
        bestScoreMarks: '0',
        avgAccuracy: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        totalAttempted: 0,
      };
    }

    const examCount = studentSubmissions.filter((s) => s.examType === 'exam').length;
    const practiceCount = studentSubmissions.filter((s) => s.examType === 'practice').length;

    // Find best score submission
    let best = studentSubmissions[0];
    let sumPercentage = 0;
    let sumCorrect = 0;
    let sumIncorrect = 0;

    studentSubmissions.forEach((s) => {
      sumPercentage += s.percentage;
      sumCorrect += s.correctCount;
      sumIncorrect += s.incorrectCount;
      if (s.percentage > best.percentage || (s.percentage === best.percentage && s.score > best.score)) {
        best = s;
      }
    });

    return {
      totalTests: total,
      examCount,
      practiceCount,
      bestScorePercent: Math.round(best.percentage),
      bestScoreTitle: best.examTitle,
      bestScoreMarks: `${best.score}/${best.maxScore}`,
      avgAccuracy: Math.round(sumPercentage / total),
      totalCorrect: sumCorrect,
      totalIncorrect: sumIncorrect,
      totalAttempted: sumCorrect + sumIncorrect,
    };
  }, [studentSubmissions]);

  // Filtered submissions based on search and type filter
  const filteredSubmissions = useMemo(() => {
    return studentSubmissions.filter((s) => {
      const matchesType = typeFilter === 'all' || s.examType === typeFilter;
      const matchesSearch =
        searchQuery.trim() === '' ||
        s.examTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.examCode.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [studentSubmissions, typeFilter, searchQuery]);

  // Read full performance summary via speech synthesis
  const handleAnnounceSummary = () => {
    soundEffects.playSelect();
    if (!currentStudent) return;
    const msg = `Performance summary for ${currentStudent.name}, Roll Number ${currentStudent.rollNumber}. Total tests completed: ${stats.totalTests}, including ${stats.examCount} timed exams and ${stats.practiceCount} practice drills. Average accuracy: ${stats.avgAccuracy} percent. Best score: ${stats.bestScorePercent} percent in ${stats.bestScoreTitle}. Total correct answers: ${stats.totalCorrect}. Press B or Escape to return to tests.`;
    announce(msg, 'assertive', true);
  };

  // Announce an individual test result
  const handleSpeakResult = (sub: typeof studentSubmissions[0]) => {
    soundEffects.playSelect();
    const dateStr = new Date(sub.submittedAt).toLocaleDateString();
    const msg = `Result for ${sub.examTitle}, code ${sub.examCode}. Attempted on ${dateStr}. Score achieved: ${sub.score} out of ${sub.maxScore} points, accuracy ${Math.round(sub.percentage)} percent. Correct: ${sub.correctCount}, Incorrect: ${sub.incorrectCount}, Unattempted: ${sub.unattemptedCount}.`;
    announce(msg, 'assertive', true);
  };

  // Retake test directly
  const handleRetakeTest = (sub: typeof studentSubmissions[0]) => {
    const all = [...availableExams, ...availablePracticeDrills];
    const target = all.find((e) => e.id === sub.examId || e.code === sub.examCode);
    if (target) {
      selectExam(target.id, sub.examType);
    } else {
      announce(`Exam ${sub.examTitle} is currently not active in the catalog.`, 'polite', true);
    }
  };

  // Keyboard navigation for the table rows
  const handleTableKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    if (filteredSubmissions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (focusedRowIndex + 1) % filteredSubmissions.length;
      setFocusedRowIndex(next);
      rowRefs.current[next]?.focus();
      soundEffects.playNavigate();
      const sub = filteredSubmissions[next];
      announce(
        `Row ${next + 1}: ${sub.examTitle}, Score ${sub.score}/${sub.maxScore}, Accuracy ${Math.round(sub.percentage)} percent.`,
        'polite',
        true
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (focusedRowIndex - 1 + filteredSubmissions.length) % filteredSubmissions.length;
      setFocusedRowIndex(prev);
      rowRefs.current[prev]?.focus();
      soundEffects.playNavigate();
      const sub = filteredSubmissions[prev];
      announce(
        `Row ${prev + 1}: ${sub.examTitle}, Score ${sub.score}/${sub.maxScore}, Accuracy ${Math.round(sub.percentage)} percent.`,
        'polite',
        true
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const sub = filteredSubmissions[focusedRowIndex];
      if (sub) {
        handleSpeakResult(sub);
      }
    }
  };

  // Welcome announcement on mount
  useEffect(() => {
    if (currentStudent) {
      announce(
        `Welcome to your Performance and Analytics Dashboard, ${currentStudent.name}. Total ${stats.totalTests} tests recorded. Use Tab or Arrow keys to navigate, or press B to return to tests.`,
        'polite',
        false
      );
    }
  }, [currentStudent?.id]);

  if (!currentStudent) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <p className="text-lg font-bold">Please log in to view your performance analytics.</p>
        <button
          type="button"
          onClick={onReturnToCatalog}
          className="mt-4 px-4 py-2 rounded-xl bg-theme-primary text-white font-bold"
        >
          Return to Portal
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-2 border-theme-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReturnToCatalog}
              title="Return to Test Catalog (Shortcut: B or Esc)"
              aria-label="Return to Test Catalog (Shortcut: B or Esc)"
              className="px-3 py-1.5 rounded-xl border-2 border-theme-border bg-theme-bg hover:border-theme-primary text-theme-text text-xs font-bold flex items-center gap-1.5 transition focus:outline-none focus:ring-4 focus:ring-yellow-400"
            >
              <ArrowLeft className="w-4 h-4 text-theme-primary" aria-hidden="true" />
              <span>Back to Tests</span>
              <kbd className="hidden sm:inline-block text-[10px] font-sans font-bold px-1.5 py-0.2 rounded border border-theme-border bg-theme-surface">
                B
              </kbd>
            </button>
            <span className="text-theme-text/40">/</span>
            <span className="text-xs uppercase font-bold tracking-wider text-theme-text/60">
              Student Dashboard
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-theme-text tracking-tight mt-2 flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-theme-primary" aria-hidden="true" />
            <span>My Performance & Score Analytics</span>
          </h2>
          <p className="text-xs sm:text-sm text-theme-text/70 mt-1">
            Track your exam progression, best scores, accuracy breakdown, and practice history.
          </p>
        </div>

        {/* Candidate Profile Card & Audio Overview Button */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleAnnounceSummary}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border-2 border-theme-border bg-theme-primary text-theme-primary-text font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition hover:bg-theme-primary-hover shadow-sm focus:outline-none focus:ring-4 focus:ring-yellow-400"
            title="Listen to full performance summary aloud via speech synthesis"
          >
            <Volume2 className="w-4 h-4 text-yellow-300" aria-hidden="true" />
            <span>Listen to Summary</span>
          </button>
        </div>
      </div>

      {/* Candidate Profile Strip */}
      <div className="p-4 sm:p-5 rounded-2xl border-2 border-theme-border bg-theme-surface flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full border-2 border-theme-primary bg-theme-primary/10 text-theme-primary flex items-center justify-center font-black text-lg">
            {currentStudent.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-theme-text">{currentStudent.name}</h3>
              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-theme-primary/10 text-theme-primary border border-theme-primary/30">
                {currentStudent.rollNumber}
              </span>
            </div>
            <span className="text-xs text-theme-text/70 block mt-0.5">
              Email: <span className="font-mono">{currentStudent.email}</span> • Mode:{' '}
              <span className="font-bold text-theme-text">{currentStudent.accessibilityPreference}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-theme-text/70 bg-theme-bg px-3 py-1.5 rounded-xl border border-theme-border">
          <Calendar className="w-4 h-4 text-theme-primary" aria-hidden="true" />
          <span>Registered: {new Date(currentStudent.registeredAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* 4 Interactive KPI Cards */}
      <section aria-labelledby="kpi-heading" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <h3 id="kpi-heading" className="sr-only">Key Performance Metrics</h3>

        {/* Card 1: Total Tests Taken */}
        <div className="p-5 rounded-2xl bg-theme-surface border-2 border-theme-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold text-theme-text/60">Tests Completed</span>
            <Target className="w-5 h-5 text-indigo-500" aria-hidden="true" />
          </div>
          <div className="mt-2">
            <span className="text-3xl sm:text-4xl font-black text-theme-text">{stats.totalTests}</span>
            <span className="text-xs text-theme-text/60 block mt-1">
              {stats.examCount} Timed Exams • {stats.practiceCount} Drills
            </span>
          </div>
        </div>

        {/* Card 2: Best Score Achieved */}
        <div className="p-5 rounded-2xl bg-theme-surface border-2 border-theme-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold text-theme-text/60">Best Score</span>
            <Award className="w-5 h-5 text-amber-500" aria-hidden="true" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-black text-emerald-500">
                {stats.bestScorePercent}%
              </span>
              <span className="text-xs font-bold text-theme-text/60">({stats.bestScoreMarks})</span>
            </div>
            <span className="text-xs text-theme-text/60 block mt-1 truncate" title={stats.bestScoreTitle}>
              {stats.bestScoreTitle}
            </span>
          </div>
        </div>

        {/* Card 3: Average Accuracy */}
        <div className="p-5 rounded-2xl bg-theme-surface border-2 border-theme-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold text-theme-text/60">Average Accuracy</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" aria-hidden="true" />
          </div>
          <div className="mt-2">
            <span className="text-3xl sm:text-4xl font-black text-theme-text">{stats.avgAccuracy}%</span>
            <div className="w-full bg-theme-border h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.avgAccuracy}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Questions Solved */}
        <div className="p-5 rounded-2xl bg-theme-surface border-2 border-theme-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold text-theme-text/60">Questions Solved</span>
            <Sparkles className="w-5 h-5 text-yellow-500" aria-hidden="true" />
          </div>
          <div className="mt-2">
            <span className="text-3xl sm:text-4xl font-black text-theme-text">
              {stats.totalAttempted}
            </span>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="text-emerald-500 font-bold flex items-center gap-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                {stats.totalCorrect} Correct
              </span>
              <span className="text-red-500 font-bold flex items-center gap-0.5">
                <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                {stats.totalIncorrect} Wrong
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Examination History Log & Table */}
      <section aria-labelledby="history-heading" className="p-4 sm:p-6 rounded-2xl border-2 border-theme-border bg-theme-surface shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <h3 id="history-heading" className="text-xl font-bold text-theme-text flex items-center gap-2">
              <Clock className="w-5 h-5 text-theme-primary" aria-hidden="true" />
              <span>Examination & Practice Drill History</span>
            </h3>
            <p className="text-xs text-theme-text/70 mt-0.5">
              Use <strong>Arrow Down (↓)</strong> and <strong>Arrow Up (↑)</strong> to navigate rows. Press <strong>Enter</strong> to hear result.
            </p>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center border-2 border-theme-border rounded-xl p-0.5 bg-theme-bg">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  typeFilter === 'all'
                    ? 'bg-theme-primary text-white shadow-xs'
                    : 'text-theme-text hover:bg-theme-surface'
                }`}
              >
                All ({studentSubmissions.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('exam')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  typeFilter === 'exam'
                    ? 'bg-theme-primary text-white shadow-xs'
                    : 'text-theme-text hover:bg-theme-surface'
                }`}
              >
                Exams ({stats.examCount})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('practice')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  typeFilter === 'practice'
                    ? 'bg-theme-primary text-white shadow-xs'
                    : 'text-theme-text hover:bg-theme-surface'
                }`}
              >
                Drills ({stats.practiceCount})
              </button>
            </div>

            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 text-theme-text/50 absolute left-3 top-2.5" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by test name or code..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border-2 border-theme-border bg-theme-bg text-theme-text text-xs focus:outline-none focus:ring-4 focus:ring-yellow-400"
              />
            </div>
          </div>
        </div>

        {/* Submissions Table with Keyboard Arrow Navigation */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-theme-border text-xs uppercase font-bold text-theme-text/70">
                <th scope="col" className="p-3">Test Title & Code</th>
                <th scope="col" className="p-3">Type</th>
                <th scope="col" className="p-3">Date Completed</th>
                <th scope="col" className="p-3">Score Achieved</th>
                <th scope="col" className="p-3">Accuracy</th>
                <th scope="col" className="p-3">Answers Breakdown</th>
                <th scope="col" className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody
              tabIndex={0}
              onKeyDown={handleTableKeyDown}
              className="divide-y divide-theme-border focus:outline-none"
            >
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-theme-text/60">
                    <HelpCircle className="w-8 h-8 text-theme-text/40 mx-auto mb-2" aria-hidden="true" />
                    <p className="font-bold">No test submissions found matching your filter.</p>
                    <p className="text-xs mt-1">Start a mock exam or practice drill to see your performance here.</p>
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub, idx) => {
                  const isFocused = focusedRowIndex === idx;
                  const isTopScore = sub.percentage === stats.bestScorePercent;

                  return (
                    <tr
                      key={sub.id}
                      ref={(el) => {
                        rowRefs.current[idx] = el;
                      }}
                      tabIndex={0}
                      onFocus={() => setFocusedRowIndex(idx)}
                      className={`transition-colors focus:outline-none ${
                        isFocused
                          ? 'bg-yellow-400/10 ring-2 ring-yellow-400 font-semibold'
                          : 'hover:bg-theme-bg/60'
                      }`}
                    >
                      {/* Test Title & Code */}
                      <td className="p-3">
                        <div className="font-bold text-theme-text flex items-center gap-1.5">
                          {isTopScore && <span title="Personal Best Score">🏆</span>}
                          <span>{sub.examTitle}</span>
                        </div>
                        <span className="text-xs font-mono text-theme-primary mt-0.5 block">
                          {sub.examCode}
                        </span>
                      </td>

                      {/* Type Badge */}
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            sub.examType === 'practice'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                              : 'bg-blue-500/10 text-blue-500 border border-blue-500/30'
                          }`}
                        >
                          {sub.examType === 'practice' ? 'Practice Drill' : 'Timed Exam'}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="p-3 text-xs text-theme-text/80 whitespace-nowrap">
                        {new Date(sub.submittedAt).toLocaleDateString()}{' '}
                        <span className="text-theme-text/50">
                          {new Date(sub.submittedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      {/* Score Achieved */}
                      <td className="p-3 font-bold text-theme-text whitespace-nowrap">
                        <span className="text-base">{sub.score}</span>
                        <span className="text-xs text-theme-text/60"> / {sub.maxScore} pts</span>
                      </td>

                      {/* Accuracy */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-black text-sm ${
                              sub.percentage >= 80
                                ? 'text-emerald-500'
                                : sub.percentage >= 60
                                ? 'text-amber-500'
                                : 'text-red-500'
                            }`}
                          >
                            {Math.round(sub.percentage)}%
                          </span>
                        </div>
                      </td>

                      {/* Breakdown */}
                      <td className="p-3 text-xs whitespace-nowrap">
                        <span className="text-emerald-500 font-bold">{sub.correctCount} Correct</span>
                        <span className="text-theme-text/40 mx-1">•</span>
                        <span className="text-red-500 font-bold">{sub.incorrectCount} Incorrect</span>
                        <span className="text-theme-text/40 mx-1">•</span>
                        <span className="text-theme-text/60">{sub.unattemptedCount} Skipped</span>
                      </td>

                      {/* Action Buttons */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSpeakResult(sub)}
                            className="p-1.5 rounded-lg border border-theme-border bg-theme-bg hover:border-yellow-400 text-theme-text text-xs font-semibold flex items-center gap-1 focus:outline-none focus:ring-4 focus:ring-yellow-400"
                            title="Speak result aloud"
                            aria-label={`Read result for ${sub.examTitle} aloud`}
                          >
                            <Volume2 className="w-3.5 h-3.5 text-yellow-400" aria-hidden="true" />
                            <span className="hidden xl:inline">Speak</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRetakeTest(sub)}
                            className="p-1.5 rounded-lg border border-theme-border bg-theme-primary text-theme-primary-text text-xs font-semibold flex items-center gap-1 hover:bg-theme-primary-hover focus:outline-none focus:ring-4 focus:ring-yellow-400"
                            title="Retake this test"
                            aria-label={`Retake test ${sub.examTitle}`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                            <span className="hidden xl:inline">Retake</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
