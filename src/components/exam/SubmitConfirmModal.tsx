import React, { useEffect, useRef } from 'react';
import { useExamStore } from '../../store/useExamStore';
import { useAnnouncerStore } from '../../store/useAnnouncerStore';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

export const SubmitConfirmModal: React.FC = () => {
  const {
    isSubmitModalOpen,
    setSubmitModalOpen,
    submitExam,
    questions,
    selectedOptions,
    markedForReview,
    formattedTime,
  } = useExamStore();

  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  const total = questions.length;
  const attempted = Object.keys(selectedOptions).length;
  const unattempted = total - attempted;
  const marked = Object.values(markedForReview).filter(Boolean).length;

  useEffect(() => {
    if (isSubmitModalOpen) {
      setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);
      useAnnouncerStore
        .getState()
        .announce(
          `Confirm exam submission. You have answered ${attempted} of ${total} questions. ${unattempted} questions unattempted. ${marked} marked for review. Press Enter to submit, or Escape to cancel.`,
          'assertive',
          true,
          true
        );
    }
  }, [isSubmitModalOpen, attempted, total, unattempted, marked]);

  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setSubmitModalOpen(false);
      return;
    }

    if (e.key === 'Tab') {
      const container = modalContainerRef.current;
      if (!container) return;

      const focusable = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  };

  if (!isSubmitModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-dialog-title"
      aria-describedby="submit-dialog-desc"
      onKeyDown={handleModalKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
    >
      <div
        ref={modalContainerRef}
        className="w-full max-w-lg bg-theme-surface border-2 border-theme-border rounded-xl shadow-2xl overflow-hidden text-theme-text"
      >
        <div className="p-4 sm:p-5 border-b-2 border-theme-border flex justify-between items-center bg-theme-bg">
          <div className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            <h2 id="submit-dialog-title" className="text-xl font-bold text-theme-text">
              Confirm Exam Submission
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setSubmitModalOpen(false)}
            aria-label="Cancel submission and close modal"
            className="p-2 rounded-lg border-2 border-theme-border hover:bg-theme-surface transition"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <p id="submit-dialog-desc" className="text-sm sm:text-base text-theme-text leading-relaxed">
            Are you sure you want to finish and submit your exam session? Once submitted, your answers cannot be altered.
          </p>

          {/* Accessible summary list */}
          <div className="p-4 rounded-lg border-2 border-theme-border bg-theme-bg space-y-2 text-sm sm:text-base">
            <div className="flex justify-between">
              <span className="text-theme-text-secondary">Total Questions:</span>
              <span className="font-bold">{total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-theme-text-secondary">Answered Questions:</span>
              <span className="font-bold text-emerald-500">{attempted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-theme-text-secondary">Unattempted Questions:</span>
              <span className="font-bold text-red-500">{unattempted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-theme-text-secondary">Marked for Review:</span>
              <span className="font-bold text-amber-500">{marked}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-theme-border">
              <span className="text-theme-text-secondary">Time Remaining:</span>
              <span className="font-mono font-bold">{formattedTime}</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t-2 border-theme-border bg-theme-bg flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => setSubmitModalOpen(false)}
            className="px-5 py-2.5 font-bold rounded-lg border-2 border-theme-border bg-theme-surface hover:bg-theme-bg text-theme-text transition text-sm sm:text-base"
          >
            Cancel & Return to Exam
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={submitExam}
            className="px-6 py-2.5 font-bold rounded-lg border-2 border-emerald-600 bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5 transition text-sm sm:text-base shadow-sm"
          >
            <CheckCircle className="w-5 h-5" aria-hidden="true" />
            <span>Yes, Final Submit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
