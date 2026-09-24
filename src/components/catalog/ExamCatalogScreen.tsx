import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useExamStore } from '../../store/useExamStore';
import { useAnnouncerStore } from '../../store/useAnnouncerStore';
import { soundEffects } from '../../utils/soundEffects';
import { EXAM_CATEGORIES } from '../../data/exams';
import type { Exam, ExamCategory } from '../../data/exams';

export const ExamCatalogScreen: React.FC = () => {
  const {
    portalTab,
    setPortalTab,
    availableExams,
    availablePracticeDrills,
    selectExam,
  } = useExamStore();
  const { announce, stopSpeech } = useAnnouncerStore();

  const [selectedCategory, setSelectedCategory] = useState<ExamCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);

  // Current active list based on selected portal tab
  const activeExamsList = portalTab === 'exams' ? availableExams : availablePracticeDrills;

  // Filter exams based on category and search query
  const filteredExams = useMemo(() => {
    return activeExamsList.filter((exam) => {
      const matchesCategory =
        selectedCategory === 'All' || exam.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === '' ||
        exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exam.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exam.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exam.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeExamsList, selectedCategory, searchQuery]);

  // Reset focus when tab or filter changes
  useEffect(() => {
    setFocusedIndex(0);
  }, [portalTab, selectedCategory]);

  // Keep focused index within bounds
  useEffect(() => {
    if (focusedIndex >= filteredExams.length && filteredExams.length > 0) {
      setFocusedIndex(0);
    }
  }, [filteredExams.length, focusedIndex]);

  const handleCategoryChange = (cat: ExamCategory) => {
    setSelectedCategory(cat);
    soundEffects.playSelect();
    const count =
      cat === 'All'
        ? activeExamsList.length
        : activeExamsList.filter((e) => e.category === cat).length;
    announce(
      `Filter category changed to ${cat}. Showing ${count} ${
        portalTab === 'practice' ? 'practice drill' : 'examination'
      }${count === 1 ? '' : 's'}.`,
      'polite',
      true
    );
  };

  const handleCycleCategory = () => {
    const currentIdx = EXAM_CATEGORIES.indexOf(selectedCategory);
    const nextIdx = (currentIdx + 1) % EXAM_CATEGORIES.length;
    handleCategoryChange(EXAM_CATEGORIES[nextIdx]);
  };

  const handleTogglePortalTab = () => {
    const nextTab = portalTab === 'exams' ? 'practice' : 'exams';
    setPortalTab(nextTab);
  };

  const handleListenOverview = (exam: Exam) => {
    soundEffects.playSelect();
    const isPractice = portalTab === 'practice';
    const overview = `${isPractice ? 'Practice Drill' : 'Examination'}: ${exam.title}, Code ${exam.code}. Category: ${exam.category}. Difficulty: ${exam.difficulty}. Total questions: ${exam.questions.length}. Duration: ${exam.durationMinutes} minutes. ${
      isPractice
        ? 'Hints and step-by-step solutions are enabled.'
        : `Maximum marks: ${exam.totalMarks}. Negative marking: ${exam.negativeMarking}.`
    } Sections included: ${exam.sections.join(', ')}. Description: ${exam.description}. Press Enter to start.`;
    announce(overview, 'assertive', true);
  };

  const handleStartExam = (exam: Exam) => {
    stopSpeech();
    selectExam(exam.id, portalTab === 'practice' ? 'practice' : 'exam');
  };

  // Announce focused exam details
  const announceExamCard = (index: number) => {
    const exam = filteredExams[index];
    if (!exam) return;
    const isPractice = portalTab === 'practice';
    const msg = `${isPractice ? 'Practice Drill' : 'Exam'} ${index + 1} of ${filteredExams.length}: ${exam.title}. Code ${exam.code}. Duration ${exam.durationMinutes} minutes. ${exam.questions.length} questions. Difficulty ${exam.difficulty}. ${
      isPractice ? 'Hints and Solutions available.' : ''
    } Press Enter to start, or O to hear overview.`;
    announce(msg, 'polite', true);
  };

  // Move focus to a specific card
  const focusCard = (index: number, speak = true) => {
    if (index >= 0 && index < filteredExams.length) {
      setFocusedIndex(index);
      cardRefs.current[index]?.focus();
      soundEffects.playNavigate();
      if (speak) {
        announceExamCard(index);
      }
    }
  };

  // Keyboard navigation listener for the Catalog Screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const store = useExamStore.getState();
      // If full modal dialogs are open, or not in catalog view, DO NOT intercept keys
      if (store.isSettingsOpen || store.isShortcutsOpen || store.activeView !== 'catalog') {
        return;
      }

      const activeEl = document.activeElement;
      const isTyping =
        activeEl &&
        ((activeEl.tagName === 'INPUT' &&
          ['text', 'search', 'password', 'email', 'tel', 'url', 'number'].includes(
            ((activeEl as HTMLInputElement).type || 'text').toLowerCase()
          )) ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);

      // Slash '/' focuses the search box (when not already typing)
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
        announce(
          `Search box focused. Type to filter ${portalTab === 'practice' ? 'practice drills' : 'examinations'}, or press Escape to return.`,
          'polite',
          true
        );
        return;
      }

      // Escape from search box returns focus to the active exam card
      if (e.key === 'Escape' && isTyping) {
        e.preventDefault();
        searchInputRef.current?.blur();
        focusCard(focusedIndex, false);
        return;
      }

      // If user is actively typing in the search box, let native typing happen
      if (isTyping) return;

      // 't' or 'T' toggles portal mode (Mock Exams ⇄ Practice Arena)
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        handleTogglePortalTab();
        return;
      }

      // 'c' or 'C' cycles through categories
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleCycleCategory();
        return;
      }

      // 'o' or 'O' reads overview of currently focused exam
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        if (filteredExams[focusedIndex]) {
          handleListenOverview(filteredExams[focusedIndex]);
        }
        return;
      }

      // Arrow Down or Arrow Right: Next exam card
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = (focusedIndex + 1) % filteredExams.length;
        focusCard(next, true);
        return;
      }

      // Arrow Up or Arrow Left: Previous exam card
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = (focusedIndex - 1 + filteredExams.length) % filteredExams.length;
        focusCard(prev, true);
        return;
      }

      // Enter: Start the focused examination / drill
      if (e.key === 'Enter') {
        if (filteredExams[focusedIndex]) {
          e.preventDefault();
          handleStartExam(filteredExams[focusedIndex]);
        }
        return;
      }

      // Number keys '1' to '9': Quick jump to exam
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= filteredExams.length) {
        e.preventDefault();
        focusCard(num - 1, true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, filteredExams, selectedCategory, portalTab]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 focus:outline-none"
      aria-label={
        portalTab === 'practice'
          ? 'Practice Arena and Topic Drills Portal'
          : 'Examination Catalog and Test Series Selection'
      }
    >
      {/* Top Mode Segmented Switcher (Mock Exams vs Practice Arena) */}
      <div
        role="tablist"
        aria-label="Portal Section Selector. Press T to switch between Mock Exams and Practice Arena."
        className="mb-6 p-1.5 rounded-2xl bg-theme-surface border-2 border-theme-border flex flex-col sm:flex-row gap-2 shadow-sm"
      >
        <button
          type="button"
          role="tab"
          id="tab-mock-exams"
          aria-selected={portalTab === 'exams'}
          aria-controls="panel-exam-catalog"
          onClick={() => setPortalTab('exams')}
          className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all focus:outline-none focus:ring-4 focus:ring-theme-focus ${
            portalTab === 'exams'
              ? 'bg-theme-primary text-white shadow-md'
              : 'text-theme-text hover:bg-theme-border/30'
          }`}
        >
          <span className="text-xl" aria-hidden="true">🏆</span>
          <span>Mock Examinations (Timed Tests)</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-black/20 dark:bg-white/20 font-mono">
            {availableExams.length} Tests
          </span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-practice-arena"
          aria-selected={portalTab === 'practice'}
          aria-controls="panel-exam-catalog"
          onClick={() => setPortalTab('practice')}
          className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all focus:outline-none focus:ring-4 focus:ring-theme-focus ${
            portalTab === 'practice'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-theme-text hover:bg-theme-border/30'
          }`}
        >
          <span className="text-xl" aria-hidden="true">💡</span>
          <span>Practice Arena (Hints & Solutions)</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-black/20 dark:bg-white/20 font-mono">
            {availablePracticeDrills.length} Drills
          </span>
        </button>
      </div>

      {/* Hero Welcome Banner */}
      <section
        className={`mb-6 p-6 md:p-8 rounded-2xl bg-theme-surface border-2 shadow-sm text-center md:text-left flex flex-col md:flex-row md:items-center md:justify-between gap-6 transition-colors ${
          portalTab === 'practice'
            ? 'border-emerald-600/50 bg-emerald-500/5'
            : 'border-theme-border'
        }`}
        aria-labelledby="catalog-heading"
      >
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-theme-primary/10 text-theme-primary border border-theme-primary/30 mb-3">
            <span>♿ 100% WCAG 2.1 AA Compliant</span>
            <span>•</span>
            <span>
              {portalTab === 'practice'
                ? 'Interactive Practice Drills'
                : 'Full-Length Simulation Tests'}
            </span>
          </div>
          <h1
            id="catalog-heading"
            className="text-3xl md:text-4xl font-extrabold tracking-tight text-theme-text mb-3"
          >
            {portalTab === 'practice'
              ? 'Interactive Practice Arena'
              : 'Examination & Mock Test Series'}
          </h1>
          <p className="text-base md:text-lg text-theme-text/80 leading-relaxed">
            {portalTab === 'practice' ? (
              <>
                Sharpen your concepts topic-by-topic. Includes instant <strong className="text-amber-500">Helpful Hints</strong> and <strong className="text-emerald-500">Step-by-Step Solutions</strong> with no timer pressure.
              </>
            ) : (
              <>
                Simulate real exam conditions with strict timers and negative marking. Designed for screen readers, keyboard-only operators, and low-vision candidates.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              announce(
                portalTab === 'practice'
                  ? `Welcome to Practice Arena. There are ${availablePracticeDrills.length} practice drills available across Quantitative, Reasoning, Verbal, and General Awareness. Hints and step-by-step solutions are available on every question. Press Arrow keys to cycle, Enter to start, or T to switch back to Mock Exams.`
                  : `Welcome to Examination Portal. There are ${availableExams.length} timed simulation tests. Press Arrow keys to cycle, Enter to start, or T to switch to Practice Arena.`,
                'assertive',
                true
              );
            }}
            className="px-4 py-2.5 rounded-lg border-2 border-theme-primary bg-theme-surface hover:bg-theme-primary/10 text-theme-primary font-bold text-sm flex items-center justify-center gap-2 transition-colors focus:ring-4 focus:ring-theme-focus"
            aria-label="Listen portal navigation instructions"
          >
            <span>🔊</span>
            <span>Section Audio Guide</span>
          </button>
        </div>
      </section>

      {/* Accessible Keyboard Shortcut Reference Bar */}
      <nav
        aria-label="Catalog Quick Keyboard Shortcuts"
        className="mb-6 p-3.5 rounded-xl bg-theme-surface border-2 border-theme-border flex flex-wrap items-center justify-between gap-3 text-xs"
      >
        <div className="flex items-center gap-2 font-bold text-theme-text">
          <span className="text-base" aria-hidden="true">⌨️</span>
          <span>Keyboard Shortcuts:</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-theme-text/80">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-theme-border bg-theme-bg font-mono font-bold text-theme-text">T</kbd>
            <span className="font-semibold text-theme-primary">Toggle Exams / Practice</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-theme-border bg-theme-bg font-mono font-bold text-theme-text">↑ / ↓</kbd>
            <span>Navigate Cards</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-theme-border bg-theme-bg font-mono font-bold text-theme-text">Enter</kbd>
            <span>Start</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-theme-border bg-theme-bg font-mono font-bold text-theme-text">O</kbd>
            <span>Overview</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-theme-border bg-theme-bg font-mono font-bold text-theme-text">1-4</kbd>
            <span>Jump to Card</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-theme-border bg-theme-bg font-mono font-bold text-theme-text">/</kbd>
            <span>Search</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-theme-border bg-theme-bg font-mono font-bold text-theme-text">C</kbd>
            <span>Category</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border border-theme-border bg-theme-bg font-mono font-bold text-theme-text">S / Esc</kbd>
            <span>Stop Audio</span>
          </span>
        </div>
      </nav>

      {/* Search and Category Filters */}
      <section
        id="panel-exam-catalog"
        role="region"
        aria-label={`Search and Filter ${portalTab === 'practice' ? 'Practice Drills' : 'Examinations'}`}
        className="mb-8 space-y-4"
      >
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <label htmlFor="exam-search-input" className="sr-only">
              Search {portalTab === 'practice' ? 'practice drills' : 'examinations'} by title, code, or keyword (Press slash to focus)
            </label>
            <input
              ref={searchInputRef}
              id="exam-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${portalTab === 'practice' ? 'practice topics' : 'mock tests'} (Press / to focus)...`}
              className="w-full px-4 py-3 pl-11 pr-20 rounded-xl bg-theme-surface border-2 border-theme-border text-theme-text placeholder-theme-text/50 focus:border-theme-primary focus:ring-4 focus:ring-theme-focus outline-none font-medium text-sm transition-all"
            />
            <span
              className="absolute left-3.5 top-3.5 text-theme-text/50 pointer-events-none text-base"
              aria-hidden="true"
            >
              🔍
            </span>
            <div className="absolute right-3 top-2.5 flex items-center gap-1.5">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="text-xs px-2 py-1 rounded bg-theme-border text-theme-text hover:bg-theme-primary hover:text-white"
                  aria-label="Clear search query"
                >
                  Clear
                </button>
              ) : (
                <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-theme-border bg-theme-bg text-theme-text/70 font-mono">
                  /
                </kbd>
              )}
            </div>
          </div>

          <div
            className="text-sm font-semibold text-theme-text/80 self-center"
            aria-live="polite"
          >
            Showing <span className="text-theme-primary font-bold">{filteredExams.length}</span> of{' '}
            {activeExamsList.length} {portalTab === 'practice' ? 'Practice Drills' : 'Examinations'}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div
          role="radiogroup"
          aria-label="Filter by subject category (Press C to cycle)"
          className="flex flex-wrap gap-2 pt-2"
        >
          {EXAM_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleCategoryChange(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all focus:outline-none focus:ring-4 focus:ring-theme-focus ${
                  isSelected
                    ? portalTab === 'practice'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-theme-primary text-white border-theme-primary shadow-sm'
                    : 'bg-theme-surface text-theme-text border-theme-border hover:border-theme-primary/60'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* Grid of Cards with Full Keyboard Navigation */}
      <section
        aria-label={`${
          portalTab === 'practice' ? 'Practice Drills' : 'Examinations'
        } List. Use Arrow Keys to navigate, Enter to start`}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {filteredExams.length === 0 ? (
          <div className="col-span-full p-12 text-center rounded-2xl bg-theme-surface border-2 border-dashed border-theme-border">
            <span className="text-4xl mb-3 block" aria-hidden="true">
              📑
            </span>
            <h2 className="text-xl font-bold text-theme-text mb-2">
              No Modules Match Your Criteria
            </h2>
            <p className="text-sm text-theme-text/70 mb-4">
              Try adjusting your search query or selecting "All" categories.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-lg bg-theme-primary text-white font-bold text-sm focus:ring-4 focus:ring-theme-focus"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredExams.map((exam, idx) => {
            const isFocused = focusedIndex === idx;
            const isPractice = portalTab === 'practice';
            const difficultyBadgeColor =
              exam.difficulty === 'Easy'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : exam.difficulty === 'Moderate'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';

            return (
              <article
                key={exam.id}
                ref={(el) => {
                  cardRefs.current[idx] = el;
                }}
                tabIndex={0}
                onFocus={() => {
                  setFocusedIndex(idx);
                }}
                aria-labelledby={`exam-title-${exam.id}`}
                aria-describedby={`exam-stats-${exam.id}`}
                className={`flex flex-col justify-between p-6 rounded-2xl bg-theme-surface border-2 transition-all shadow-sm outline-none focus:ring-4 focus:ring-theme-focus cursor-pointer ${
                  isFocused
                    ? isPractice
                      ? 'border-emerald-600 ring-2 ring-emerald-600/30 shadow-md'
                      : 'border-theme-primary ring-2 ring-theme-primary/30 shadow-md'
                    : 'border-theme-border hover:border-theme-primary/70'
                }`}
              >
                <div>
                  {/* Badges Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full text-white text-xs font-black flex items-center justify-center font-mono ${
                          isPractice ? 'bg-emerald-600' : 'bg-theme-primary'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="px-2.5 py-1 rounded-md text-xs font-extrabold bg-theme-border/60 text-theme-text tracking-wider uppercase">
                        {exam.code}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${difficultyBadgeColor}`}
                      >
                        {exam.difficulty}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-theme-border/40 text-theme-text border border-theme-border">
                        {exam.category}
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <h2
                    id={`exam-title-${exam.id}`}
                    className="text-xl font-bold text-theme-text mb-2.5 leading-snug"
                  >
                    {exam.title}
                  </h2>

                  {/* Description */}
                  <p className="text-sm text-theme-text/80 mb-5 line-clamp-3 leading-relaxed">
                    {exam.description}
                  </p>

                  {/* Practice Specific Feature Callout */}
                  {isPractice && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                        <span>💡</span>
                        <span>Helpful Hints</span>
                      </span>
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <span>🔍</span>
                        <span>Step-by-Step Solutions</span>
                      </span>
                      <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                        Self-Paced
                      </span>
                    </div>
                  )}

                  {/* Key Stats Bar */}
                  <div
                    id={`exam-stats-${exam.id}`}
                    className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-3 px-3.5 mb-6 rounded-xl bg-theme-bg border border-theme-border text-xs"
                  >
                    <div>
                      <span className="text-theme-text/60 block">Duration</span>
                      <span className="font-extrabold text-theme-text">
                        ⏱️ {exam.durationMinutes} min
                      </span>
                    </div>
                    <div>
                      <span className="text-theme-text/60 block">Questions</span>
                      <span className="font-extrabold text-theme-text">
                        ❓ {exam.questions.length} items
                      </span>
                    </div>
                    <div>
                      <span className="text-theme-text/60 block">Total Marks</span>
                      <span className="font-extrabold text-theme-text">
                        🏆 {exam.totalMarks} pts
                      </span>
                    </div>
                    <div>
                      <span className="text-theme-text/60 block">Mode</span>
                      <span className="font-extrabold text-theme-text truncate">
                        {isPractice ? '💡 Practice' : '⚠️ Timed'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-theme-border">
                  <button
                    type="button"
                    onClick={() => handleStartExam(exam)}
                    className={`w-full sm:flex-1 py-3 px-4 rounded-xl text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm hover:brightness-110 active:scale-[0.99] transition-all focus:outline-none focus:ring-4 focus:ring-theme-focus ${
                      isPractice ? 'bg-emerald-600' : 'bg-theme-primary'
                    }`}
                    aria-label={`Start ${isPractice ? 'Practice Drill' : 'Examination'}: ${exam.title} (Or press Enter)`}
                  >
                    <span>{isPractice ? '💡' : '🚀'}</span>
                    <span>{isPractice ? 'Start Practice Drill' : 'Start Examination'}</span>
                    <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 border border-white/40 rounded bg-white/10 uppercase">
                      Enter
                    </kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleListenOverview(exam)}
                    className="w-full sm:w-auto py-3 px-4 rounded-xl bg-theme-surface border-2 border-theme-border hover:border-theme-primary text-theme-text font-bold text-sm flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-4 focus:ring-theme-focus"
                    aria-label={`Listen overview for ${exam.title} (Or press O)`}
                  >
                    <span>🔊</span>
                    <span>Overview</span>
                    <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 border border-theme-border rounded bg-theme-bg font-mono">
                      O
                    </kbd>
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
};
