import React, { useEffect, useRef } from 'react';
import { useExamStore } from '../../store/useExamStore';
import { useAnnouncerStore } from '../../store/useAnnouncerStore';
import { soundEffects } from '../../utils/soundEffects';
import { X, Keyboard } from 'lucide-react';

export const ShortcutsHelpModal: React.FC = () => {
  const { isShortcutsOpen, setShortcutsOpen } = useExamStore();
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isShortcutsOpen) {
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);

      useAnnouncerStore
        .getState()
        .announce(
          'Keyboard Navigation Shortcuts Guide opened. Press A for Accessibility Preferences, H for Help, N for next question, P for previous, 1 to 4 to select options, and Escape to close.',
          'assertive',
          true,
          true
        );
    }
  }, [isShortcutsOpen]);

  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShortcutsOpen(false);
      soundEffects.playSelect();
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

  if (!isShortcutsOpen) return null;

  const shortcuts = [
    { key: 'A', desc: 'Open Accessibility Preferences (Themes, Font Scale, Speech)' },
    { key: 'H or ? or F1', desc: 'Open this Keyboard Shortcuts Guide' },
    { key: 'V', desc: 'Toggle AI Conversational Voice Assistant (Hindi / English microphone)' },
    { key: 'D', desc: 'Open My Performance & Score Analytics Dashboard' },
    { key: 'B', desc: 'Back to Test Catalog from Analytics or Exam' },
    { key: 'N', desc: 'Navigate to Next Question' },
    { key: 'P', desc: 'Navigate to Previous Question' },
    { key: '1, 2, 3, 4', desc: 'Select corresponding answer option directly' },
    { key: 'M', desc: 'Mark or Unmark question for review' },
    { key: 'C', desc: 'Clear currently selected option for this question' },
    { key: 'T', desc: 'Vocalize / Announce remaining exam time via screen reader' },
    { key: 'R', desc: 'Read question, equation, and options aloud via TTS' },
    { key: 'S', desc: 'Stop / Silence ongoing voice reading immediately' },
    { key: 'Q', desc: 'Toggle Question Palette / Navigation Drawer' },
    { key: 'Alt + S', desc: 'Submit Examination Session' },
    { key: 'Escape', desc: 'Close any open dialog or stop voice reading' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onKeyDown={handleModalKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
    >
      <div
        ref={modalContainerRef}
        className="w-full max-w-xl max-h-[90vh] bg-theme-surface border-2 border-theme-border rounded-2xl shadow-2xl flex flex-col overflow-hidden text-theme-text"
      >
        <div className="p-4 sm:p-5 border-b-2 border-theme-border flex justify-between items-center bg-theme-bg">
          <div className="flex items-center gap-2">
            <Keyboard className="w-6 h-6 text-yellow-400" aria-hidden="true" />
            <h2 id="shortcuts-title" className="text-xl font-bold tracking-tight">
              Keyboard Navigation Shortcuts
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => {
              setShortcutsOpen(false);
              soundEffects.playSelect();
            }}
            aria-label="Close keyboard shortcuts dialog (Esc)"
            className="p-2 rounded-xl border-2 border-theme-border hover:bg-theme-surface transition focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <p className="text-sm text-theme-text/80 mb-4">
            DristiX offers 100% keyboard operational independence. All shortcuts are active globally and automatically disabled while typing in text fields.
          </p>

          <table className="w-full text-left border-collapse text-sm sm:text-base">
            <caption className="sr-only">Available keyboard shortcuts and their actions</caption>
            <thead>
              <tr className="border-b-2 border-theme-border text-theme-text">
                <th scope="col" className="p-2.5 font-bold">Key Shortcut</th>
                <th scope="col" className="p-2.5 font-bold">Function / Operation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border/60">
              {shortcuts.map((sc) => (
                <tr key={sc.key} className="hover:bg-theme-bg/60">
                  <td className="p-2.5 font-mono font-bold whitespace-nowrap">
                    <kbd className="px-2.5 py-1 rounded-lg border-2 border-theme-border bg-theme-bg text-theme-text shadow-xs">
                      {sc.key}
                    </kbd>
                  </td>
                  <td className="p-2.5 text-theme-text">{sc.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t-2 border-theme-border bg-theme-bg flex justify-end">
          <button
            type="button"
            onClick={() => {
              setShortcutsOpen(false);
              soundEffects.playSelect();
            }}
            className="px-6 py-2.5 font-bold rounded-xl border-2 border-theme-border bg-theme-surface hover:bg-theme-bg text-theme-text focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:border-yellow-400"
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
