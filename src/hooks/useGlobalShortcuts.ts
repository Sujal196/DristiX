import { useEffect } from 'react';
import { useExamStore } from '../store/useExamStore';
import { usePreferencesStore } from '../store/usePreferencesStore';
import type { TextScale } from '../store/usePreferencesStore';
import { useAnnouncerStore } from '../store/useAnnouncerStore';
import { soundEffects } from '../utils/soundEffects';

/**
 * Checks if the currently active focused element is a text-entry field
 * where single-letter navigation shortcuts should be suppressed so user can type.
 * Radio buttons (exam options), checkboxes, and buttons MUST NOT suppress shortcuts!
 */
function isUserTyping(el: Element | null): boolean {
  if (!el) return false;
  const tagName = el.tagName.toUpperCase();
  if (tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable) return true;
  if (tagName === 'INPUT') {
    const inputType = ((el as HTMLInputElement).type || 'text').toLowerCase();
    const textTypes = ['text', 'search', 'password', 'email', 'tel', 'url', 'number'];
    return textTypes.includes(inputType);
  }
  return false;
}

export function useGlobalShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const store = useExamStore.getState();

      // Handle Escape to stop speech and close any open dialogs (available everywhere)
      if (e.key === 'Escape') {
        useAnnouncerStore.getState().stopSpeech();
        let handledModal = false;
        if (store.isPaletteOpen) { store.setPaletteOpen(false); handledModal = true; }
        if (store.isSettingsOpen) { store.setSettingsOpen(false); handledModal = true; }
        if (store.isShortcutsOpen) { store.setShortcutsOpen(false); handledModal = true; }
        if (store.isSubmitModalOpen) { store.setSubmitModalOpen(false); handledModal = true; }
        if (handledModal) return;
        if (store.activeView === 'analytics' || store.isSubmitted) { store.returnToCatalog(); return; }
        return;
      }

      // If full modal dialogs (Settings or Shortcuts Help) are open, let them handle keys internally
      if (store.isSettingsOpen || store.isShortcutsOpen) {
        return;
      }

      // If Submit Confirmation Modal is open during active exam, let it handle Enter/Tab/Escape
      if (store.activeView === 'exam' && store.isSubmitModalOpen) {
        return;
      }

      // If Question Palette is open during an exam, pressing 'q' or 'Q' closes it
      if (store.activeView === 'exam' && store.isPaletteOpen) {
        if (e.key.toLowerCase() === 'q') {
          e.preventDefault();
          store.setPaletteOpen(false);
          return;
        }
        // Palette is open: do not execute question-answering shortcuts
        return;
      }

      // If user is actively typing in a text field, let native typing happen
      if (isUserTyping(activeEl)) return;

      // Global Text & UI Scaling shortcuts (+, =, -, _, Add, Subtract)
      // Visually impaired users can quickly zoom in/out anywhere in the application
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '+' || e.key === '=' || e.key === 'Add') {
          e.preventDefault();
          const fontSizes: TextScale[] = [100, 125, 150, 175, 200];
          const currentFont = usePreferencesStore.getState().fontSize;
          const currentIndex = fontSizes.indexOf(currentFont);
          if (currentIndex < fontSizes.length - 1) {
            const nextFont = fontSizes[currentIndex + 1];
            usePreferencesStore.getState().setFontSize(nextFont);
            soundEffects.playSelect();
            useAnnouncerStore
              .getState()
              .announce(`Text scale adjusted to ${nextFont} percent.`, 'assertive', true);
          } else {
            useAnnouncerStore
              .getState()
              .announce('Maximum magnification limit of 200 percent reached.', 'polite', true);
          }
          return;
        }

        if (e.key === '-' || e.key === '_' || e.key === 'Subtract') {
          e.preventDefault();
          const fontSizes: TextScale[] = [100, 125, 150, 175, 200];
          const currentFont = usePreferencesStore.getState().fontSize;
          const currentIndex = fontSizes.indexOf(currentFont);
          if (currentIndex > 0) {
            const nextFont = fontSizes[currentIndex - 1];
            usePreferencesStore.getState().setFontSize(nextFont);
            soundEffects.playSelect();
            useAnnouncerStore
              .getState()
              .announce(`Text scale adjusted to ${nextFont} percent.`, 'assertive', true);
          } else {
            useAnnouncerStore
              .getState()
              .announce('Minimum magnification limit of 100 percent reached.', 'polite', true);
          }
          return;
        }
      }

      // Toggle Student Performance & Analytics Dashboard 'd' or 'D'
      if (e.key.toLowerCase() === 'd' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (store.activeView === 'analytics') {
          store.returnToCatalog();
        } else if (store.activeView === 'catalog') {
          store.openAnalytics();
        }
        return;
      }

      // Back to Catalog 'b' or 'B' (when in Analytics view OR when viewing Diagnostic Report)
      if (
        e.key.toLowerCase() === 'b' &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        (store.activeView === 'analytics' || store.isSubmitted)
      ) {
        e.preventDefault();
        store.returnToCatalog();
        return;
      }

      // On Diagnostic Report screen: 'r' to retake, 's' to read summary
      if (store.isSubmitted) {
        if (e.key.toLowerCase() === 'r' && !e.altKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          store.resetExam();
          return;
        }
        if (e.key.toLowerCase() === 's' && !e.altKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          const report = store.getDiagnosticReport();
          const fullSummary = report.verbalSummary.join(' ');
          useAnnouncerStore
            .getState()
            .announce(`Performance Diagnostic Summary for ${report.examTitle}: ${fullSummary}`, 'assertive', true);
          return;
        }
      }

      // Toggle AI Conversational Voice Assistant 'v' or 'V' (available everywhere outside text inputs)
      if (e.key.toLowerCase() === 'v' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('dristix-toggle-voice'));
        return;
      }

      // Handle Stop speech 's' (available everywhere outside text inputs when not answering exam)
      if (
        e.key.toLowerCase() === 's' &&
        !e.altKey &&
        !e.ctrlKey &&
        store.activeView !== 'exam' &&
        !store.isSubmitted
      ) {
        e.preventDefault();
        useAnnouncerStore.getState().stopSpeech();
        return;
      }

      // Accessibility Settings 'a' or 'A' or 'Alt+A' (available everywhere outside text inputs)
      if (
        (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey) ||
        (e.altKey && (e.key === 'a' || e.key === 'A'))
      ) {
        e.preventDefault();
        store.setSettingsOpen(true);
        return;
      }

      // Help reference '?' or 'h' or 'F1' (available everywhere outside text inputs)
      if (e.key === '?' || e.key.toLowerCase() === 'h' || e.key === 'F1') {
        e.preventDefault();
        store.setShortcutsOpen(true);
        return;
      }

      // Alt + S -> Submit Exam Session (only when in active unsubmitted exam)
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (store.activeView === 'exam' && !store.isSubmitted) {
          store.setSubmitModalOpen(true);
        }
        return;
      }

      // All remaining exam shortcuts only apply when in active exam view and not submitted
      if (store.activeView !== 'exam' || store.isSubmitted) return;

      switch (e.key.toLowerCase()) {
        case 's':
          // Stop voice reading during exam
          e.preventDefault();
          useAnnouncerStore.getState().stopSpeech();
          break;

        case 'n':
          e.preventDefault();
          store.nextQuestion();
          break;

        case 'p':
          e.preventDefault();
          store.previousQuestion();
          break;

        case 'm':
          e.preventDefault();
          store.toggleMarkForReview();
          break;

        case '1':
          e.preventDefault();
          store.selectOption(1);
          break;

        case '2':
          e.preventDefault();
          store.selectOption(2);
          break;

        case '3':
          e.preventDefault();
          store.selectOption(3);
          break;

        case '4':
          e.preventDefault();
          store.selectOption(4);
          break;

        case 'c':
          e.preventDefault();
          store.clearOption();
          break;

        case 't': {
          e.preventDefault();
          const minutes = Math.floor(store.timeRemaining / 60);
          const seconds = store.timeRemaining % 60;
          const timeMsg = `Time remaining: ${minutes} minutes and ${seconds} seconds. Timer display: ${store.formattedTime}.`;
          useAnnouncerStore.getState().announce(timeMsg, 'assertive', true);
          break;
        }

        case 'r':
          e.preventDefault();
          store.announceCurrentQuestion(true);
          break;

        case 'q':
          e.preventDefault();
          store.setPaletteOpen(!store.isPaletteOpen);
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
