import React, { useEffect } from 'react';
import { useExamStore } from '../../store/useExamStore';
import { useAnnouncerStore } from '../../store/useAnnouncerStore';
import { Clock, CheckCircle, Bookmark, Eye, TrendingUp } from 'lucide-react';

/**
 * ExamSidebar — Always-visible right panel during an active exam.
 *
 * Contains:
 *  • Countdown timer (keyboard shortcut T → speaks time)
 *  • Mini question palette grid (click to jump; Q opens full palette)
 *  • Question status breakdown counts
 *  • Section progress bar
 *
 * All keyboard shortcuts are handled globally in the parent keyboard handler.
 * This component only renders the visual panel; it does NOT intercept keys.
 */
export const ExamSidebar: React.FC = () => {
  const {
    questions,
    currentIndex,
    selectedOptions,
    markedForReview,
    visitedQuestions,
    timeRemaining,
    formattedTime,
    jumpToQuestion,
    setPaletteOpen,
    currentExam,
  } = useExamStore();

  const isTimeCritical = timeRemaining < 300; // under 5 min

  // Computed counts
  const answeredCount  = Object.keys(selectedOptions).length;
  const markedCount    = Object.values(markedForReview).filter(Boolean).length;
  const visitedCount   = Object.keys(visitedQuestions).length;
  const notAnswered    = questions.length - answeredCount;
  const notVisited     = questions.length - visitedCount;
  const progressPct    = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  // Speak time when T is pressed — handled by global keyboard handler in App, but
  // we expose a helper via a custom event so the global handler can call it.
  useEffect(() => {
    const handleAnnounceTime = () => {
      const minutes = Math.floor(timeRemaining / 60);
      const secs    = timeRemaining % 60;
      useAnnouncerStore.getState().announce(
        `Time remaining: ${minutes} minutes and ${secs} seconds. Display: ${formattedTime}.`,
        'assertive',
        true
      );
    };

    const handleAnnouncePalette = () => {
      useAnnouncerStore.getState().announce(
        `Question palette: ${questions.length} total. ${answeredCount} answered. ${markedCount} marked for review. ${notAnswered} not answered. ${notVisited} not yet visited. Currently on question ${currentIndex + 1}.`,
        'assertive',
        true,
        true
      );
    };

    window.addEventListener('dristix-announce-time', handleAnnounceTime);
    window.addEventListener('dristix-announce-palette', handleAnnouncePalette);
    return () => {
      window.removeEventListener('dristix-announce-time', handleAnnounceTime);
      window.removeEventListener('dristix-announce-palette', handleAnnouncePalette);
    };
  }, [timeRemaining, formattedTime, questions.length, answeredCount, markedCount, notAnswered, notVisited, currentIndex]);

  return (
    <aside
      aria-label="Exam sidebar: Timer, Question Palette, and Progress"
      className="sticky top-20 flex flex-col gap-2.5 w-64 xl:w-72 flex-shrink-0 select-none"
    >
      {/* ── 1. Timer Card (Compact) ── */}
      <div
        role="region"
        aria-label={`Time Remaining: ${formattedTime}. Press T to hear time.`}
        className={`rounded-xl border-2 px-3.5 py-2 transition-all ${
          isTimeCritical
            ? 'border-red-500 bg-red-950/20 shadow-red-500/20 shadow-lg'
            : 'border-theme-border bg-theme-surface shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Clock
              className={`w-3.5 h-3.5 flex-shrink-0 ${isTimeCritical ? 'text-red-500 animate-pulse' : 'text-theme-focus-ring'}`}
              aria-hidden="true"
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-theme-text-secondary">
              Time Remaining
            </span>
          </div>
          <kbd className="text-[10px] px-1.5 py-0.2 rounded border border-theme-border bg-theme-bg font-mono font-bold text-theme-text-secondary">
            T
          </kbd>
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('dristix-announce-time'))}
          title="Click or press T to hear time remaining"
          aria-label={`Time remaining: ${formattedTime}. Click to hear.`}
          className={`w-full text-center font-mono font-black text-2xl xl:text-3xl tracking-widest leading-none py-1 rounded-lg transition hover:opacity-80 focus:outline-none focus-visible:ring-4 focus-visible:ring-theme-focus-ring ${
            isTimeCritical ? 'text-red-500' : 'text-theme-focus-ring'
          }`}
        >
          {formattedTime}
        </button>
        <p className="text-center text-[9px] text-theme-text-secondary mt-0.5 tracking-widest font-semibold select-none">
          HH &nbsp;:&nbsp; MM &nbsp;:&nbsp; SS
        </p>
      </div>

      {/* ── 2. Mini Question Palette (Compact) ── */}
      <div
        role="region"
        aria-label="Question Palette. Press Q to open full palette."
        className="rounded-xl border-2 border-theme-border bg-theme-surface shadow-xs px-3.5 py-2.5"
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-xs font-bold text-theme-text flex items-center gap-1.5">
            <span>Question Palette</span>
            <span className="text-[10px] text-theme-text-secondary font-mono">({currentIndex + 1}/{questions.length})</span>
          </h2>
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('dristix-announce-palette'));
              setPaletteOpen(true);
            }}
            aria-label="Open full question palette (Shortcut: Q)"
            title="Open full question palette (Q)"
            className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-theme-border bg-theme-bg hover:bg-theme-surface text-theme-text-secondary flex items-center gap-1 transition"
          >
            <span>Full</span>
            <kbd className="font-mono text-[9px] border border-theme-border rounded px-1 bg-theme-surface text-theme-text">Q</kbd>
          </button>
        </div>

        {/* Compact Legend */}
        <div className="flex items-center justify-between text-[10px] font-semibold text-theme-text-secondary mb-2 px-0.5">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full border-2 border-theme-focus-ring inline-block" aria-hidden="true" />
            Active
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" aria-hidden="true" />
            Done
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" aria-hidden="true" />
            Marked
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-theme-border inline-block" aria-hidden="true" />
            Left
          </span>
        </div>

        {/* Grid */}
        <div
          role="grid"
          aria-label="Question grid. Click any number to jump."
          className="grid grid-cols-5 gap-1 max-h-36 overflow-y-auto pr-0.5"
          style={{ scrollbarWidth: 'none' }}
        >
          {questions.map((q, idx) => {
            const isCurrent  = idx === currentIndex;
            const isAnswered = selectedOptions[q.id] !== undefined;
            const isMarked   = !!markedForReview[q.id];
            const isVisited  = !!visitedQuestions[q.id];

            let bgClass = 'bg-theme-bg border-theme-border text-theme-text-secondary';
            if (isCurrent)  bgClass = 'bg-theme-primary text-theme-primary-text border-theme-primary';
            else if (isMarked)   bgClass = 'bg-amber-500/25 border-amber-500/60 text-theme-text';
            else if (isAnswered) bgClass = 'bg-emerald-600/25 border-emerald-600/60 text-theme-text';
            else if (isVisited)  bgClass = 'bg-theme-surface border-theme-border text-theme-text';

            const statusLabel = isCurrent ? 'current' : isMarked ? 'marked' : isAnswered ? 'answered' : isVisited ? 'visited' : 'not visited';

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => jumpToQuestion(idx)}
                aria-label={`Question ${q.questionNumber}, ${statusLabel}. Click to go.`}
                title={`Q${q.questionNumber} — ${statusLabel}`}
                className={`relative h-7 rounded-lg border text-xs font-black flex items-center justify-center transition-all hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-focus-ring ${bgClass} ${
                  isCurrent ? 'ring-2 ring-theme-focus-ring ring-offset-1 ring-offset-theme-surface' : ''
                }`}
              >
                {q.questionNumber}
                {isMarked && !isCurrent && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 border border-theme-surface" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. Question Status (Compact 2x2 Grid) ── */}
      <div
        role="region"
        aria-label="Question status summary"
        className="rounded-xl border-2 border-theme-border bg-theme-surface shadow-xs px-3.5 py-2.5"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-theme-text">Question Status</h2>
          <span className="text-[10px] text-theme-text-secondary font-mono">{questions.length} total</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-xs" aria-label="Status counts">
          {/* Answered */}
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="flex items-center gap-1.5 text-theme-text text-[11px] font-semibold">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" aria-hidden="true" />
              Answered
            </span>
            <span className="font-black text-theme-text tabular-nums">{answeredCount}</span>
          </div>

          {/* Marked */}
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span className="flex items-center gap-1.5 text-theme-text text-[11px] font-semibold">
              <Bookmark className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" aria-hidden="true" />
              Marked
            </span>
            <span className="font-black text-theme-text tabular-nums">{markedCount}</span>
          </div>

          {/* Not Answered */}
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-theme-bg border border-theme-border">
            <span className="flex items-center gap-1.5 text-theme-text-secondary text-[11px] font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-theme-unattempted/60 flex-shrink-0" aria-hidden="true" />
              Unanswered
            </span>
            <span className="font-black text-theme-text tabular-nums">{notAnswered}</span>
          </div>

          {/* Not Visited */}
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-theme-bg border border-theme-border">
            <span className="flex items-center gap-1.5 text-theme-text-secondary text-[11px] font-medium">
              <Eye className="w-3.5 h-3.5 text-theme-text-secondary/60 flex-shrink-0" aria-hidden="true" />
              Not Visited
            </span>
            <span className="font-black text-theme-text tabular-nums">{notVisited}</span>
          </div>
        </div>
      </div>

      {/* ── 4. Section Progress (Compact) ── */}
      <div
        role="region"
        aria-label={`Section progress: ${progressPct}% complete`}
        className="rounded-xl border-2 border-theme-border bg-theme-surface shadow-xs px-3.5 py-2"
      >
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-xs font-bold text-theme-text flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-theme-primary" aria-hidden="true" />
            <span>Progress</span>
          </h2>
          <span
            className="text-xs font-black tabular-nums"
            style={{ color: progressPct > 0 ? 'var(--primary)' : 'var(--text-secondary)' }}
          >
            {progressPct}% ({answeredCount}/{currentExam.questions.length})
          </span>
        </div>

        <div className="h-2 w-full rounded-full bg-theme-border overflow-hidden" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="h-full rounded-full bg-theme-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </aside>
  );
};
