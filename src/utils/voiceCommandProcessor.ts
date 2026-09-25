import { getAssistantContext } from './assistantContext';
import { useExamStore } from '../store/useExamStore';
import { useAnnouncerStore } from '../store/useAnnouncerStore';
import { soundEffects } from './soundEffects';
import { verbalizeMath } from './mathVerbalizer';
import { matchExamFromQuery } from './examMatcher';

export interface CommandProcessResult {
  success: boolean;
  intent: string;
  userQuery: string;
  assistantReply: string;
  actionExecuted?: string;
}

/**
 * High-Precision Multi-lingual Normalizer (Devanagari, Hindi, Hinglish & English)
 */
function normalizePhonetics(raw: string): string {
  let text = raw.toLowerCase().trim();

  // 1. Devanagari numerals to ASCII digits
  text = text
    .replace(/०/g, '0')
    .replace(/१/g, '1')
    .replace(/२/g, '2')
    .replace(/३/g, '3')
    .replace(/४/g, '4')
    .replace(/५/g, '5')
    .replace(/६/g, '6')
    .replace(/७/g, '7')
    .replace(/८/g, '8')
    .replace(/९/g, '9');

  // 2. Options and numbers (Devanagari + Hinglish + English)
  // Option 1
  text = text.replace(/(ऑप्शन|विकल्प|ऑपशन|ऑप्सन|option)\s*(नंबर|नम्बर|number)?\s*(1|एक|पहला|पहिला|फर्स्ट|ए\b|a\b|one|pehla|first)/gi, 'option 1');
  text = text.replace(/(1|पहला|pehla|first)\s*(नंबर|नम्बर|number|chun|select|lagao)/gi, 'option 1');
  text = text.replace(/(select|chuno|choose|answer|uttar|उत्तर|tick)\s*(1|one|ek|pehla|\ba\b)/gi, 'option 1');

  // Option 2
  text = text.replace(/(ऑप्शन|विकल्प|ऑपशन|ऑप्सन|option)\s*(नंबर|नम्बर|number)?\s*(2|दो|दूसरा|दुसरा|सेकंड|बी\b|b\b|two|doosra|dusra|second|\bdo\b)/gi, 'option 2');
  text = text.replace(/(2|दो|दूसरा|doosra|dusra)\s*(नंबर|नम्बर|number|chun|select|lagao)/gi, 'option 2');
  text = text.replace(/(select|chuno|choose|answer|uttar|उत्तर|tick)\s*(2|two|do|dusra|doosra|\bb\b)/gi, 'option 2');

  // Option 3
  text = text.replace(/(ऑप्शन|विकल्प|ऑपशन|ऑप्सन|option)\s*(नंबर|नम्बर|number)?\s*(3|तीन|तीसरा|थर्ड|सी\b|c\b|three|teesra|teen|third)/gi, 'option 3');
  text = text.replace(/(3|तीन|तीसरा|teesra|teen)\s*(नंबर|नम्बर|number|chun|select|lagao)/gi, 'option 3');
  text = text.replace(/(select|chuno|choose|answer|uttar|उत्तर|tick)\s*(3|three|teen|teesra|\bc\b)/gi, 'option 3');

  // Option 4
  text = text.replace(/(ऑप्शन|विकल्प|ऑपशन|ऑप्सन|option)\s*(नंबर|नम्बर|number)?\s*(4|चार|चौथा|फोर्थ|डी\b|d\b|four|chautha|char|fourth)/gi, 'option 4');
  text = text.replace(/(4|चार|चौथा|chautha|char)\s*(नंबर|नम्बर|number|chun|select|lagao)/gi, 'option 4');
  text = text.replace(/(select|chuno|choose|answer|uttar|उत्तर|tick)\s*(4|four|char|chautha|\bd\b)/gi, 'option 4');

  // 3. Question & Reading
  text = text.replace(/(क्वेश्चन|क्वेशन|थेकेशन|क्वेशचन|कुएस्शन|कोशचन|कवैश्चन|सवाल|प्रश्न|सवाली|question|sawal|sawaal|prashna)/gi, 'question');
  text = text.replace(/(पढ़ो|पढ़कर सुनाओ|सुनाओ|बोलो|रीड|बताओ|read|bolo|sunao|sunaao|padho)/gi, 'read');

  // 4. Navigation
  text = text.replace(/(अगला|अगले|आगे|नेक्स्ट|next|agla|aage)/gi, 'next');
  text = text.replace(/(पिछला|पिछले|पीछे|प्रीवियस|previous|prev|pichla|peechla|peeche)/gi, 'previous');

  // 5. Actions
  text = text.replace(/(चुनो|लगाओ|सेलेक्ट|टिक|क्लिक|select|choose|tick|chuno|lagao)/gi, 'select');
  text = text.replace(/(हटाओ|हटा दो|मिटाओ|क्लियर|अनचेक|clear|deselect|hatao|mitao)/gi, 'clear');
  text = text.replace(/(मार्क|रिव्यू|mark|review)/gi, 'mark');

  // 6. Time / Timer
  text = text.replace(/(टाइम|समय|वक्त|घड़ी|time|samay|waqt)/gi, 'time');

  // 7. Exam operations & Specific Exam Names
  text = text.replace(/(एसएससी|सीजीएल|staff\s*selection|ssc|cgl)/gi, 'ssc cgl');
  text = text.replace(/(आरआरबी|एनटीपीसी|रेलवे|rrb|ntpc|railways?)/gi, 'rrb ntpc');
  text = text.replace(/(आईबीपीएस|पीओ|ibps|po|bank|banking|बैंकिंग|बैंक)/gi, 'ibps po');
  text = text.replace(/(यूपीएससी|सीसैट|सिविल\s*सेवा|सिविल|सिविल्स|upsc|u\.p\.s\.c|u\s*p\s*s\s*c|up\s*sc|civil\s*services?|civil|csat|ias|ips|paper\s*2|paper\s*ii)/gi, 'upsc csat');
  text = text.replace(/(प्रैक्टिस|अभ्यास|drill|practice)/gi, 'practice');
  text = text.replace(/(शुरू|चालू|स्टार्ट|खोलो|start|open|shuru|chalao|kholo)/gi, 'start');
  text = text.replace(/(सबमिट|जमा|खत्म|submit|finish|khatam|jama)/gi, 'submit');
  text = text.replace(/(वापस|बैक|होम|back|return|home|wapas)/gi, 'back');

  // 8. Analytics & Scores
  text = text.replace(/(एनालिटिक्स|स्कोर|रिजल्ट|परफॉर्मेंस|रिपोर्ट|analytics|score|result|performance|report)/gi, 'analytics');

  // 9. Hints & Solutions
  text = text.replace(/(हिंट|मदद|सहायता|hint|help)/gi, 'hint');
  text = text.replace(/(सॉल्यूशन|हल|एक्सप्लेनेशन|समझाइए|समझाओ|solution|explanation|explain)/gi, 'solution');

  // 10. Exam lists / inquiries
  text = text.replace(/(मॉक\s*टेस्ट|मॉकटेस्ट|mock\s*test|mocktest)/gi, 'mocktest');
  text = text.replace(/(कितने|कितना|कौन कौन से|kaun kaun|kitne|list|available)/gi, 'list');
  text = text.replace(/(एग्जाम|परीक्षा|टेस्ट|exam|test)/gi, 'exam');

  return text;
}

/**
 * Execute command against a single normalized transcript
 */
function executeCommand(rawTranscript: string, shouldAnnounce = true): CommandProcessResult {
  const normalized = normalizePhonetics(rawTranscript);
  const rawLower = rawTranscript.toLowerCase().trim();
  const context = getAssistantContext();
  const examStore = useExamStore.getState();

  const makeReply = (
    intent: string,
    reply: string,
    actionExecuted?: string,
    success = true
  ): CommandProcessResult => {
    soundEffects.playSelect();
    if (shouldAnnounce) {
      useAnnouncerStore.getState().announce(reply, 'assertive', true);
    }
    return {
      success,
      intent,
      userQuery: rawTranscript,
      assistantReply: reply,
      actionExecuted,
    };
  };

  // ==========================================
  // EXAM INTEGRITY GUARD:
  // Strictly prevent solving questions or revealing answers during live exam
  // ==========================================
  if (context.activeView === 'exam') {
    const isSolveOrAnswerRequest =
      normalized.includes('solve') ||
      normalized.includes('solution') ||
      normalized.includes('answer batao') ||
      normalized.includes('sahi option') ||
      normalized.includes('sahi answer') ||
      normalized.includes('correct answer') ||
      normalized.includes('what is the answer') ||
      normalized.includes('explain question') ||
      normalized.includes('explain this') ||
      normalized.includes('sawal samjhao') ||
      normalized.includes('answer kya hai');

    if (isSolveOrAnswerRequest) {
      soundEffects.playTimerAlert();
      const reply = 'Exam integrity mode is active. I cannot solve questions or provide answers during the live test. You can ask me to read the question, navigate, select an option, or check the time.';
      useAnnouncerStore.getState().announce(reply, 'assertive', true);
      return {
        success: true,
        intent: 'EXAM_INTEGRITY_REFUSAL',
        userQuery: rawTranscript,
        assistantReply: reply,
        actionExecuted: 'Exam Integrity Protected (Answer Withheld)',
      };
    }
  }

  // ==========================================
  // 1. QUERY AVAILABLE EXAMS & TESTS
  // ==========================================
  if (
    normalized.includes('list exam') ||
    (normalized.includes('exam') && normalized.includes('list')) ||
    (normalized.includes('kitne') && normalized.includes('exam')) ||
    normalized.includes('available exam') ||
    rawLower.includes('exams ke naam') ||
    rawLower.includes('kaun kaun se')
  ) {
    const exams = context.availableExams;
    const names = exams
      .map((e, idx) => `${idx + 1}. ${e.title} (${e.durationMinutes} mins, ${e.questionCount} questions)`)
      .join('; ');
    const reply = `There are ${exams.length} Mock Examinations available: ${names}. Say "Start SSC CGL" or "Start Exam 1" to begin.`;
    return makeReply('LIST_EXAMS', reply, 'List Available Exams');
  }

  // ==========================================
  // 2. QUERY PRACTICE DRILLS
  // ==========================================
  if (
    normalized.includes('practice') &&
    (normalized.includes('list') || normalized.includes('drill') || normalized.includes('arena') || normalized.includes('kitne'))
  ) {
    if (context.portalTab !== 'practice') {
      examStore.setPortalTab('practice');
    }
    const drills = context.availableDrills;
    const names = drills.map((d, idx) => `${idx + 1}. ${d.title}`).join('; ');
    const reply = `The Practice Arena contains ${drills.length} topic-wise drills with helpful hints and step-by-step solutions: ${names}. Say "Start Practice Drill" to begin.`;
    return makeReply('LIST_PRACTICE_DRILLS', reply, 'Switched to Practice Drills');
  }

  // ==========================================
  // RETURN TO CATALOG / MOCK TEST PAGE / CHOOSE ANOTHER EXAM
  // Evaluated BEFORE Start Exam so "open mock test page" or "go on mocktest page" returns to catalog!
  // BUT if a specific exam like UPSC or Railway was requested, matchedExamFromQuery will be set!
  // ==========================================
  const allExams = [...examStore.availableExams, ...examStore.availablePracticeDrills];
  const matchedExamFromQuery = matchExamFromQuery(rawTranscript, null, allExams);

  const isCatalogNavigation =
    !matchedExamFromQuery &&
    (
      normalized.includes('back') ||
      normalized.includes('return') ||
      rawLower.includes('mock test page') ||
      rawLower.includes('mocktest page') ||
      rawLower.includes('mock test') ||
      rawLower.includes('mocktest') ||
      rawLower.includes('go on mock') ||
      rawLower.includes('go to mock') ||
      rawLower.includes('take me to mock') ||
      rawLower.includes('back to mock') ||
      rawLower.includes('open mock test page') ||
      rawLower.includes('open mocktest page') ||
      rawLower.includes('मॉक टेस्ट पेज') ||
      rawLower.includes('मॉकटेस्ट पेज') ||
      rawLower.includes('मॉक टेस्ट') ||
      rawLower.includes('मॉकटेस्ट') ||
      rawLower.includes('गो ऑन') ||
      rawLower.includes('गो टू') ||
      rawLower.includes('choose another') ||
      rawLower.includes('another exam') ||
      rawLower.includes('another test') ||
      rawLower.includes('dusra exam') ||
      rawLower.includes('dusra test') ||
      rawLower.includes('test page') ||
      rawLower.includes('tests page') ||
      rawLower.includes('exam page') ||
      rawLower.includes('exams page') ||
      rawLower.includes('catalog page') ||
      rawLower.includes('catalog') ||
      rawLower.includes('all exams') ||
      rawLower.includes('all tests') ||
      rawLower.includes('sare test') ||
      rawLower.includes('sare exam') ||
      rawLower.includes('sare mock') ||
      rawLower.includes('show mock tests') ||
      rawLower.includes('list mock tests') ||
      rawLower.includes('test series') ||
      rawLower.includes('home page') ||
      rawLower.includes('pehle page') ||
      rawLower.includes('main page') ||
      rawLower.includes('home') ||
      rawLower.includes('wapas') ||
      rawLower.includes('exit') ||
      rawLower.includes('close exam') ||
      rawLower.includes('close test') ||
      (context.activeView === 'report' && (
        rawLower.includes('test') ||
        rawLower.includes('exam') ||
        rawLower.includes('tests') ||
        rawLower.includes('exams') ||
        rawLower.includes('catalog') ||
        rawLower.includes('back') ||
        rawLower.includes('home') ||
        rawLower.includes('wapas')
      ))
    );

  if (isCatalogNavigation) {
    // STRICT INTEGRITY: Cannot leave active unsubmitted exam
    if (context.activeView === 'exam' && !examStore.isSubmitted) {
      examStore.setSubmitModalOpen(true);
      soundEffects.playTimerAlert();
      const reply = 'You cannot leave the exam before submitting it. The submit confirmation window is now open. Please submit your test first.';
      return makeReply('CONFIRM_SUBMIT', reply, 'Opened Submit Modal (Exit Prevented)');
    }

    examStore.returnToCatalog();
    examStore.setPortalTab('exams');
    const reply = 'Returned to the Examination Catalog. All available mock tests are displayed on your screen. Say "Start SSC CGL" or "Start Exam 1" to begin.';
    return makeReply('RETURN_CATALOG', reply, 'Returned to Mock Tests Catalog');
  }

  // ==========================================
  // 3. START AN EXAM OR PRACTICE TEST
  // ==========================================
  if (
    !isCatalogNavigation &&
    (
      !!matchedExamFromQuery ||
      (
        !rawLower.includes('page') &&
        !rawLower.includes('catalog') &&
        (
          normalized.includes('start') ||
          normalized.includes('shuru') ||
          normalized.includes('open') ||
          normalized.includes('kholo') ||
          rawLower.includes('open') ||
          rawLower.includes('khol') ||
          rawLower.includes('chalao') ||
          rawLower.includes('exam do') ||
          rawLower.includes('test lagao') ||
          rawLower.includes('ak exam') ||
          rawLower.includes('ek exam') ||
          (rawLower.includes('exam') && (rawLower.includes('karo') || rawLower.includes('do') || rawLower.includes('dikhao')))
        )
      )
    )
  ) {
    // STRICT INTEGRITY: If candidate is taking a test, prevent switching exams before submitting
    if (context.activeView === 'exam' && !examStore.isSubmitted) {
      examStore.setSubmitModalOpen(true);
      soundEffects.playTimerAlert();
      const reply = 'An exam is currently in progress. You cannot leave or start another test before submitting this one. Please confirm submission.';
      return makeReply('CONFIRM_SUBMIT', reply, 'Opened Submit Modal (Exam Switch Prevented)');
    }

    const matchedExam = matchedExamFromQuery || allExams[0];

    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }

    examStore.selectExam(matchedExam.id, matchedExam.id.includes('practice') ? 'practice' : 'exam');
    const reply = `"${matchedExam.title}" has been opened successfully! Question 1 is now loaded on your screen. Say "Read question" to hear the full question and all options.`;
    return makeReply('START_EXAM', reply, `Started Exam: ${matchedExam.title}`);
  }

  // ==========================================
  // 4. READ CURRENT QUESTION & FORMULAS (In Exam)
  // ==========================================
  if (
    normalized.includes('read') ||
    (normalized.includes('question') && (normalized.includes('padho') || normalized.includes('bolo') || normalized.includes('sunao') || normalized.includes('read'))) ||
    normalized.includes('formula') ||
    rawLower.includes('sawal padho') ||
    rawLower.includes('question repeat') ||
    rawLower.includes('dobara bolo')
  ) {
    if (context.activeView !== 'exam' || !context.currentQuestion) {
      const reply = 'You are not currently in an exam. Say "Start exam" to begin a test.';
      return makeReply('NOT_IN_EXAM', reply);
    }

    const q = context.currentQuestion;
    const formulaText = q.equationLatex ? ` This question contains a mathematical formula: ${verbalizeMath(q.equationLatex)}.` : '';
    const optionsText = q.options.map((o) => `Option ${o.number}: ${verbalizeMath(o.text)}`).join('. ');
    const statusText = q.selectedOption ? `You have currently selected Option ${q.selectedOption}.` : 'No option has been selected yet.';

    const reply = `Question ${q.number}: ${q.text}.${formulaText} The options are: ${optionsText}. ${statusText}`;
    return makeReply('READ_QUESTION', reply, 'Read Question and Options');
  }

  // ==========================================
  // 5. SELECT OPTION (1, 2, 3, 4 / A, B, C, D)
  // ==========================================
  if (
    normalized.includes('option 1') ||
    normalized.includes('option 2') ||
    normalized.includes('option 3') ||
    normalized.includes('option 4')
  ) {
    if (context.activeView !== 'exam') {
      const reply = 'Please start an exam first before selecting an option. Say "Start exam" to begin.';
      return makeReply('NOT_IN_EXAM', reply);
    }

    let optNum = 1;
    if (normalized.includes('option 2')) optNum = 2;
    else if (normalized.includes('option 3')) optNum = 3;
    else if (normalized.includes('option 4')) optNum = 4;

    examStore.selectOption(optNum);
    const reply = `Option ${optNum} selected successfully. Say "Next question" to continue or "Read question" to review.`;
    return makeReply('SELECT_OPTION', reply, `Selected Option ${optNum}`);
  }

  // ==========================================
  // 6. CLEAR OPTION
  // ==========================================
  if (
    normalized.includes('clear') ||
    rawLower.includes('hatao') ||
    rawLower.includes('deselect')
  ) {
    if (context.activeView === 'exam') {
      examStore.clearOption();
      const reply = 'Your selected option has been cleared. You can now choose a different option.';
      return makeReply('CLEAR_OPTION', reply, 'Cleared selected option');
    }
  }

  // ==========================================
  // 7. NEXT QUESTION & PREVIOUS QUESTION
  // ==========================================
  if (normalized.includes('next')) {
    if (context.activeView === 'exam') {
      examStore.nextQuestion();
      const nextCtx = getAssistantContext();
      const q = nextCtx.currentQuestion;
      const reply = q
        ? `Moving to Question ${q.number}: ${q.text}. Say "Read question" to hear all options.`
        : 'You are already on the last question. Say "Submit exam" when you are ready to finish.';
      return makeReply('NEXT_QUESTION', reply, 'Navigated to Next Question');
    }
  }

  if (normalized.includes('previous')) {
    if (context.activeView === 'exam') {
      examStore.previousQuestion();
      const prevCtx = getAssistantContext();
      const q = prevCtx.currentQuestion;
      const reply = q
        ? `Moved back to Question ${q.number}: ${q.text}. Say "Read question" to hear all options.`
        : 'You are already on the first question.';
      return makeReply('PREVIOUS_QUESTION', reply, 'Navigated to Previous Question');
    }
  }

  // ==========================================
  // 8. MARK FOR REVIEW
  // ==========================================
  if (normalized.includes('mark') || normalized.includes('review')) {
    if (context.activeView === 'exam') {
      examStore.toggleMarkForReview();
      const isMarked = examStore.markedForReview[examStore.questions[examStore.currentIndex].id];
      const reply = isMarked
        ? `Question ${examStore.currentIndex + 1} has been marked for review.`
        : `Question ${examStore.currentIndex + 1} has been unmarked from review.`;
      return makeReply('MARK_REVIEW', reply, 'Toggled Mark for Review');
    }
  }

  // ==========================================
  // 9. CHECK TIME REMAINING
  // ==========================================
  if (normalized.includes('time') || rawLower.includes('samay') || rawLower.includes('waqt')) {
    if (context.activeView === 'exam' && context.currentExam) {
      const { remainingMinutes, remainingSeconds, timeRemainingFormatted } = context.currentExam;
      const reply = `You have ${remainingMinutes} minutes and ${remainingSeconds} seconds remaining. Timer shows: ${timeRemainingFormatted}.`;
      return makeReply('CHECK_TIME', reply, 'Announced Remaining Time');
    } else {
      const reply = 'You are not currently in an active exam. Start a test to see the timer.';
      return makeReply('CHECK_TIME', reply);
    }
  }

  // ==========================================
  // 10. HINTS & SOLUTIONS (Strict Exam Integrity)
  // ==========================================
  if (
    normalized.includes('hint') ||
    normalized.includes('solution') ||
    rawLower.includes('hal') ||
    rawLower.includes('madad') ||
    rawLower.includes('kaise solve')
  ) {
    if (context.activeView === 'exam') {
      soundEffects.playTimerAlert();
      const reply = 'Exam integrity mode is active. Solving questions and revealing answers or hints is not allowed during the live test.';
      return makeReply('EXAM_INTEGRITY_REFUSAL', reply, 'Exam Integrity Protected');
    }
  }

  // ==========================================
  // 11. STUDENT PERFORMANCE & ANALYTICS
  // ==========================================
  if (
    normalized.includes('analytics') ||
    normalized.includes('score') ||
    rawLower.includes('meri report') ||
    rawLower.includes('result') ||
    rawLower.includes('parinaam')
  ) {
    if (context.activeView !== 'analytics') {
      examStore.openAnalytics();
    }
    const reply = `Your Performance Report: You have completed ${context.totalSubmissions} tests. Your best score is ${context.bestScorePercentage}% in "${context.bestScoreTitle}", and your overall average accuracy is ${context.averageAccuracy}%.`;
    return makeReply('VIEW_ANALYTICS', reply, 'Opened Student Analytics');
  }



  // ==========================================
  // 13. REPORT SCREEN SPECIFIC ACTIONS (Summary, Retake)
  // ==========================================
  if (context.activeView === 'report') {
    if (
      rawLower.includes('summary') ||
      rawLower.includes('समरी') ||
      rawLower.includes('score') ||
      rawLower.includes('स्कोर') ||
      rawLower.includes('result') ||
      rawLower.includes('रिजल्ट')
    ) {
      const rep = context.diagnosticReport;
      const summaryText = rep?.verbalSummary?.join(' ') || `Your score was ${rep?.totalScore || 0} out of ${rep?.maxScore || 20}.`;
      const reply = `Diagnostic Summary for "${rep?.examTitle || 'Exam'}": ${summaryText}`;
      return makeReply('READ_REPORT_SUMMARY', reply, 'Read Diagnostic Summary');
    }

    if (
      rawLower.includes('retake') ||
      rawLower.includes('रीटेक') ||
      rawLower.includes('dobara') ||
      rawLower.includes('fir se') ||
      rawLower.includes('again')
    ) {
      examStore.resetExam();
      const reply = 'Exam has been reset. Question 1 is now loaded. Say "Read question" to begin.';
      return makeReply('RETAKE_EXAM', reply, 'Retook Exam');
    }
  }

  // ==========================================
  // 14. ACCESSIBILITY SETTINGS & SHORTCUTS
  // ==========================================
  if (
    rawLower.includes('setting') ||
    rawLower.includes('theme') ||
    rawLower.includes('contrast') ||
    rawLower.includes('font size')
  ) {
    examStore.setSettingsOpen(true);
    const reply = 'Accessibility Preferences opened. You can adjust theme contrast, font scaling, and voice speed here.';
    return makeReply('OPEN_SETTINGS', reply, 'Opened Settings Modal');
  }

  if (rawLower.includes('help') || rawLower.includes('shortcut') || rawLower.includes('guide')) {
    examStore.setShortcutsOpen(true);
    const reply = 'Keyboard Navigation Shortcuts Guide opened. Press N for Next Question, 1 to 4 for Options, T for remaining Time, and V to toggle the Voice Assistant.';
    return makeReply('OPEN_SHORTCUTS', reply, 'Opened Shortcuts Modal');
  }

  // ==========================================
  // 15. SUBMIT EXAM
  // ==========================================
  if (normalized.includes('submit') || rawLower.includes('jama')) {
    if (context.activeView === 'exam' && !examStore.isSubmitted) {
      examStore.setSubmitModalOpen(true);
      const reply = 'Exam submission confirmation window is now open. Confirm to submit your exam, or press Escape to return to the test.';
      return makeReply('CONFIRM_SUBMIT', reply, 'Opened Submit Modal');
    }
  }

  // ==========================================
  // 16. EXPLAIN CURRENT PAGE (Grounded)
  // ==========================================
  if (
    rawLower.includes('kis page') ||
    rawLower.includes('किस पेज') ||
    rawLower.includes('which page') ||
    rawLower.includes('where am i') ||
    rawLower.includes('kahan hoon') ||
    rawLower.includes('kahan par hoon') ||
    rawLower.includes('kaun sa page') ||
    rawLower.includes('kaunse page') ||
    rawLower.includes('konsa page') ||
    rawLower.includes('current page') ||
    rawLower.includes('ye kaunsa page hai') ||
    rawLower.includes('is page par kya hai') ||
    rawLower.includes('yahan kya kar sakte hain') ||
    rawLower.includes('kya chal raha hai') ||
    rawLower.includes('explain page')
  ) {
    if (context.activeView === 'report') {
      const rep = context.diagnosticReport;
      const examTitle = rep?.examTitle || context.currentExam?.title || 'Mock Examination';
      const score = rep?.totalScore ?? 0;
      const maxScore = rep?.maxScore ?? 20;
      const pct = rep?.scorePercentage ?? 0;
      const reply = `You have completed and submitted "${examTitle}". You are currently on the Diagnostic Report & Performance Analysis screen. Your score is ${score} out of ${maxScore} (${pct}%). Say "Read summary", "Retake test", or "Go to mock test page".`;
      return makeReply('EXPLAIN_PAGE', reply, 'Explained Diagnostic Report');
    } else if (context.activeView === 'catalog') {
      const isPractice = context.portalTab === 'practice';
      const reply = isPractice
        ? `You are currently on the DristiX Practice Arena & Skill Drills dashboard. There are ${context.availableDrills.length} practice drills available with hints and solutions.`
        : `You are currently on the DristiX Examination & Mock Test Series catalog. There are ${context.availableExams.length} full-length mock exams available. Say "Start SSC CGL" or "Start Exam 1" to begin.`;
      return makeReply('EXPLAIN_PAGE', reply, 'Explained Catalog Page');
    } else if (context.activeView === 'exam') {
      const q = context.currentQuestion;
      const isPractice = context.currentExam?.isPractice;
      const examTitle = context.currentExam?.title || 'Mock Examination';
      const reply = `You are currently taking "${examTitle}" ${isPractice ? 'Practice Drill' : 'Live Mock Examination'}, on Question ${q?.number || 1} of ${context.currentExam?.totalQuestions || 10}. Remaining time: ${context.currentExam?.timeRemainingFormatted}. Say "Read question" to hear the question and options.`;
      return makeReply('EXPLAIN_PAGE', reply, 'Explained Exam Page');
    } else if (context.activeView === 'analytics') {
      const reply = 'You are currently on the Student Performance Analytics & Diagnostic Report dashboard.';
      return makeReply('EXPLAIN_PAGE', reply, 'Explained Analytics Page');
    }
  }

  // ==========================================
  // 17. GENERAL CONVERSATION & GREETING
  // ==========================================
  if (
    rawLower.includes('namaste') ||
    rawLower.includes('नमस्ते') ||
    rawLower.includes('hello') ||
    rawLower.includes('hi')
  ) {
    const reply = `Hello ${context.studentName}! I am the DristiX Conversational AI Voice Assistant. I can list available exams, start tests, read questions, and select options on your command. How can I help you?`;
    return makeReply('GREETING', reply);
  }

  if (
    rawLower.includes('aap kaun ho') ||
    rawLower.includes('tum kaun ho') ||
    rawLower.includes('आप कौन हो') ||
    rawLower.includes('who are you')
  ) {
    const reply = 'I am the DristiX Accessible AI Assistant, built specifically for visually impaired and competitive exam candidates to conduct tests and assist hands-free with voice commands.';
    return makeReply('IDENTITY', reply);
  }

  // Context-grounded fallback
  const pageDescription =
    context.activeView === 'catalog'
      ? context.portalTab === 'practice'
        ? 'Practice Arena Catalog'
        : 'Mock Examinations Catalog'
      : context.activeView === 'report'
      ? `Diagnostic Report & Result screen for "${context.diagnosticReport?.examTitle || 'Exam'}"`
      : context.activeView === 'exam'
      ? `Question ${context.currentQuestion?.number || 1} of "${context.currentExam?.title || 'Exam'}"`
      : 'Analytics Dashboard';

  const fallbackReply = `I heard: "${rawTranscript}". You are currently on the ${pageDescription}. ${
    context.activeView === 'report'
      ? 'You can say "Read summary", "Retake test", or "Go to mock test page".'
      : context.activeView === 'catalog'
      ? 'You can say "List available exams" or "Start SSC CGL".'
      : context.activeView === 'exam'
      ? 'You can say "Read question", "Select option 1", "Next question", or "Check time".'
      : 'You can say "Return to catalog".'
  }`;
  return makeReply('FALLBACK', fallbackReply, undefined, false);
}

/**
 * High-accuracy multi-candidate processor
 */
export function processVoiceCommand(
  rawTranscriptOrAlternatives: string | string[]
): CommandProcessResult {
  const candidates: string[] = Array.isArray(rawTranscriptOrAlternatives)
    ? rawTranscriptOrAlternatives
    : [rawTranscriptOrAlternatives];

  let bestResult: CommandProcessResult | null = null;

  // Search through all alternatives from SpeechRecognition engine without interim announcements
  for (const transcript of candidates) {
    if (!transcript.trim()) continue;
    const res = executeCommand(transcript, false);
    if (res.intent !== 'FALLBACK') {
      bestResult = res;
      break; // Immediate high-confidence match!
    }
    if (!bestResult) {
      bestResult = res;
    }
  }

  const finalResult = bestResult || executeCommand(candidates[0] || '', false);

  // Announce EXACTLY ONCE for the final winning result
  useAnnouncerStore.getState().announce(finalResult.assistantReply, 'assertive', true);
  return finalResult;
}
