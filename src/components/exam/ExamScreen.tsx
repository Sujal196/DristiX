import React, { useEffect, useRef, useState } from 'react';
import { useExamStore } from '../../store/useExamStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import { MathEquation } from '../common/MathEquation';
import {
  Bookmark,
  CheckCircle,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  BookOpen,
} from 'lucide-react';
import { useAnnouncerStore } from '../../store/useAnnouncerStore';

export const ExamScreen: React.FC = () => {
  const {
    questions,
    currentIndex,
    selectedOptions,
    markedForReview,
    examMode,
    nextQuestion,
    previousQuestion,
    selectOption,
    clearOption,
    toggleMarkForReview,
    setSubmitModalOpen,
    announceCurrentQuestion,
  } = useExamStore();

  const currentQ = questions[currentIndex];
  const qHeadingRef = useRef<HTMLHeadingElement>(null);
  const selectedOptNum = selectedOptions[currentQ.id];
  const isMarked = !!markedForReview[currentQ.id];

  // Practice mode states
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  // Reset hint/solution when question changes
  useEffect(() => {
    setShowHint(false);
    setShowSolution(false);
  }, [currentIndex]);

  // PROGRAMMATIC FOCUS SHIFT: Focus shifts to question heading immediately on navigation & reads aloud
  useEffect(() => {
    if (qHeadingRef.current) {
      qHeadingRef.current.focus({ preventScroll: false });
    }
    // Auto-read question and options upon navigating if enabled
    const autoRead = usePreferencesStore.getState().autoReadOnNavigate;
    if (autoRead) {
      announceCurrentQuestion(true);
    }
  }, [currentIndex]);

  const handleOptionChange = (optionNumber: number) => {
    selectOption(optionNumber);
  };

  const handleToggleHint = () => {
    const next = !showHint;
    setShowHint(next);
    useAnnouncerStore.getState().announce(
      next ? `Hint opened: ${currentQ.hint}` : 'Hint closed.',
      'polite',
      true
    );
  };

  const handleToggleSolution = () => {
    const next = !showSolution;
    setShowSolution(next);
    useAnnouncerStore.getState().announce(
      next ? `Solution opened: ${currentQ.explanation}` : 'Solution closed.',
      'polite',
      true
    );
  };

  const isLastQuestion = currentIndex === questions.length - 1;

  return (
    <main
      id="main-question-content"
      role="main"
      tabIndex={-1}
      className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 outline-none"
    >
      <section aria-labelledby="q-heading" className="bg-theme-surface border-2 border-theme-border rounded-xl p-5 sm:p-8 shadow-sm">
        {/* Section Header & Status Badges */}
        <div className="flex flex-wrap justify-between items-center gap-2 border-b-2 border-theme-border pb-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-theme-bg border border-theme-border text-theme-text">
              Section: {currentQ.section}
            </span>
            {isMarked && (
              <span
                role="status"
                className="text-xs sm:text-sm font-bold px-2.5 py-1 rounded border-2 border-theme-marked bg-amber-500/20 text-theme-text flex items-center gap-1"
              >
                <Bookmark className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                <span>Marked for Review</span>
              </span>
            )}
            {selectedOptNum && (
              <span
                role="status"
                className="text-xs sm:text-sm font-bold px-2.5 py-1 rounded border-2 border-emerald-600 bg-emerald-500/20 text-theme-text flex items-center gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Answered (Option {selectedOptNum})</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Direct Speak Question Button */}
            <button
              type="button"
              onClick={() => announceCurrentQuestion(true)}
              title="Click or press 'R' to read this question and all options aloud"
              aria-label={`Read Question ${currentQ.questionNumber} and all options aloud (Shortcut: R)`}
              className="px-3 py-1.5 rounded-lg border-2 border-theme-border bg-theme-primary text-theme-primary-text hover:bg-theme-primary-hover font-bold text-xs sm:text-sm flex items-center gap-1.5 transition shadow-sm"
            >
              <Volume2 className="w-4 h-4" aria-hidden="true" />
              <span>Speak (R)</span>
            </button>

            {/* Direct Stop Voice Button */}
            <button
              type="button"
              onClick={() => useAnnouncerStore.getState().stopSpeech()}
              title="Stop voice immediately (Shortcut: S or Esc)"
              aria-label="Stop voice reading immediately (Shortcut: S or Esc)"
              className="px-2.5 py-1.5 rounded-lg border-2 border-theme-border bg-theme-bg hover:bg-theme-surface text-theme-text font-bold text-xs sm:text-sm flex items-center gap-1 transition"
            >
              <VolumeX className="w-4 h-4 text-red-500" aria-hidden="true" />
              <span>Stop (S)</span>
            </button>

            <div className="text-xs sm:text-sm font-semibold text-theme-text-secondary ml-1">
              Question {currentQ.questionNumber} of {questions.length}
            </div>
          </div>
        </div>

        {/* Question Heading with Programmatic Focus and Click-to-read */}
        <div className="relative">
          <h2
            id="q-heading"
            ref={qHeadingRef}
            tabIndex={-1}
            onClick={() => announceCurrentQuestion(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                announceCurrentQuestion(true);
              }
            }}
            title="Click or press Space/Enter to read aloud"
            className="text-xl sm:text-2xl font-bold text-theme-text leading-relaxed outline-none focus:ring-0 focus-visible:ring-4 focus-visible:ring-theme-focus-ring rounded-lg p-1 cursor-pointer hover:opacity-90 transition"
          >
            <span className="text-theme-primary font-black mr-2">
              Q{currentQ.questionNumber}.
            </span>
            {currentQ.questionText}
          </h2>

          {/* Equation if present */}
          {currentQ.mathLatex && (
            <div className="my-4 p-4 rounded-lg bg-theme-bg border-2 border-theme-border inline-block">
              <MathEquation
                latex={currentQ.mathLatex}
                displayMode={true}
                className="text-lg sm:text-xl font-semibold"
              />
            </div>
          )}
        </div>

        {/* Semantic Option Group */}
        <fieldset id="answer-options-group" className="space-y-3.5 my-6">
          <legend className="sr-only">
            Answer Options for Question {currentQ.questionNumber}. Use keyboard keys 1, 2, 3, 4 to select options directly.
          </legend>

          {currentQ.options.map((option) => {
            const isSelected = selectedOptNum === option.number;
            const inputId = `option_${currentQ.id}_${option.number}`;

            return (
              <label
                key={option.id}
                htmlFor={inputId}
                className={`flex items-start sm:items-center p-3.5 sm:p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  isSelected
                    ? 'border-theme-focus-ring bg-theme-bg shadow-sm font-semibold'
                    : 'border-theme-border bg-theme-surface hover:bg-theme-bg'
                }`}
              >
                {/* Standard semantic radio button */}
                <input
                  type="radio"
                  id={inputId}
                  name={`question_${currentQ.id}`}
                  value={option.id}
                  checked={isSelected}
                  onChange={() => handleOptionChange(option.number)}
                  className="w-5 h-5 sm:w-6 sm:h-6 mt-0.5 sm:mt-0 mr-3.5 accent-blue-600 focus:ring-4 focus:ring-theme-focus-ring cursor-pointer flex-shrink-0"
                  aria-label={`Option ${option.number}: ${option.text}`}
                />

                {/* Option badge and textual content */}
                <div className="flex-1 flex flex-wrap items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs font-bold ${
                      isSelected
                        ? 'border-theme-focus-ring bg-theme-primary text-theme-primary-text'
                        : 'border-theme-border bg-theme-bg text-theme-text'
                    }`}
                  >
                    {option.number}
                  </span>

                  <span className="text-base sm:text-lg text-theme-text">
                    {option.text}
                  </span>

                  {option.mathLatex && (
                    <MathEquation latex={option.mathLatex} className="ml-2 font-mono" />
                  )}
                </div>

                {/* Keyboard shortcut hint */}
                <span
                  aria-hidden="true"
                  className="hidden sm:inline-block text-xs px-2 py-0.5 rounded border border-theme-border text-theme-text-secondary bg-theme-bg"
                >
                  Key: {option.number}
                </span>
              </label>
            );
          })}
        </fieldset>

        {/* Practice Mode Interactive Extras */}
        {examMode === 'practice' && (
          <div className="my-6 pt-4 border-t-2 border-theme-border flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleToggleHint}
                aria-expanded={showHint}
                className="px-4 py-2 rounded-lg border-2 border-theme-border bg-theme-bg text-theme-text font-bold text-sm flex items-center gap-2 hover:bg-theme-surface transition"
              >
                <Lightbulb className="w-4 h-4 text-amber-500" aria-hidden="true" />
                <span>{showHint ? 'Hide Hint' : 'Show Hint'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleSolution}
                aria-expanded={showSolution}
                className="px-4 py-2 rounded-lg border-2 border-theme-border bg-theme-bg text-theme-text font-bold text-sm flex items-center gap-2 hover:bg-theme-surface transition"
              >
                <BookOpen className="w-4 h-4 text-theme-focus-ring" aria-hidden="true" />
                <span>{showSolution ? 'Hide Solution' : 'View Step-by-Step Solution'}</span>
              </button>
            </div>

            {showHint && (
              <div
                role="region"
                aria-label="Question Hint"
                className="p-4 rounded-lg border-2 border-amber-500 bg-amber-500/10 text-theme-text text-sm sm:text-base"
              >
                <strong className="block text-amber-600 font-bold mb-1">
                  Helpful Hint:
                </strong>
                {currentQ.hint}
              </div>
            )}

            {showSolution && (
              <div
                role="region"
                aria-label="Detailed Solution Explanation"
                className="p-4 rounded-lg border-2 border-emerald-600 bg-emerald-500/10 text-theme-text text-sm sm:text-base space-y-2"
              >
                <strong className="block text-emerald-600 font-bold">
                  Correct Answer: Option {currentQ.correctOption} ({currentQ.options.find(o => o.number === currentQ.correctOption)?.text})
                </strong>
                <p>{currentQ.explanation}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Accessible Question Navigation Controls */}
      <nav
        id="question-navigation-controls"
        aria-label="Question Navigation Controls"
        className="mt-6 flex flex-wrap justify-between items-center gap-3"
      >
        {/* Left: Previous */}
        <button
          id="btn-prev"
          type="button"
          onClick={previousQuestion}
          disabled={currentIndex === 0}
          className="px-4 sm:px-6 py-3 font-bold rounded-lg border-2 border-theme-border bg-theme-surface text-theme-text hover:bg-theme-bg disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition text-sm sm:text-base"
        >
          <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          <span>Previous (P)</span>
        </button>

        {/* Center: Mark for Review & Clear */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-mark"
            type="button"
            onClick={toggleMarkForReview}
            aria-pressed={isMarked}
            className={`px-4 sm:px-5 py-3 font-bold rounded-lg border-2 transition text-sm sm:text-base flex items-center gap-1.5 ${
              isMarked
                ? 'border-amber-500 bg-amber-500 text-black'
                : 'border-theme-border bg-theme-surface text-theme-text hover:bg-theme-bg'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isMarked ? 'fill-current' : ''}`} aria-hidden="true" />
            <span>{isMarked ? 'Marked (M)' : 'Mark for Review (M)'}</span>
          </button>

          {selectedOptNum && (
            <button
              id="btn-clear"
              type="button"
              onClick={clearOption}
              className="px-3.5 py-3 font-bold rounded-lg border-2 border-theme-border bg-theme-surface text-theme-text hover:bg-theme-bg transition text-sm sm:text-base flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4 text-theme-text-secondary" aria-hidden="true" />
              <span>Clear (C)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => announceCurrentQuestion(true)}
            title="Read Question & Options Aloud (R)"
            aria-label="Read Question & Options Aloud (Shortcut: R)"
            className="p-3 rounded-lg border-2 border-theme-border bg-theme-surface text-theme-text hover:bg-theme-bg transition"
          >
            <Volume2 className="w-5 h-5 text-theme-focus-ring" aria-hidden="true" />
          </button>
        </div>

        {/* Right: Next or Submit */}
        {isLastQuestion ? (
          <button
            id="btn-submit"
            type="button"
            onClick={() => setSubmitModalOpen(true)}
            className="px-6 py-3 font-bold rounded-lg border-2 border-emerald-600 bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5 transition shadow-sm text-sm sm:text-base"
          >
            <span>Finish & Submit Exam (Alt+S)</span>
            <CheckCircle className="w-5 h-5" aria-hidden="true" />
          </button>
        ) : (
          <button
            id="btn-next"
            type="button"
            onClick={nextQuestion}
            className="px-5 sm:px-6 py-3 font-bold rounded-lg border-2 border-theme-border bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-text flex items-center gap-1.5 transition shadow-sm text-sm sm:text-base"
          >
            <span>Next Question (N)</span>
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </nav>
    </main>
  );
};
