import { getAssistantContext } from './assistantContext';
import { useExamStore } from '../store/useExamStore';
import { useAnnouncerStore } from '../store/useAnnouncerStore';
import { soundEffects } from './soundEffects';
import { verbalizeMath } from './mathVerbalizer';

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
  text = text.replace(/(ऑप्शन|विकल्प|ऑपशन|ऑप्सन|option)\s*(1|एक|पहला|पहिला|फर्स्ट|ए\b|a\b|one|pehla|first)/gi, 'option 1');
  text = text.replace(/(1|पहला|pehla|first)\s*(नंबर|नम्बर|number|chun|select|lagao)/gi, 'option 1');

  // Option 2
  text = text.replace(/(ऑप्शन|विकल्प|ऑपशन|ऑप्सन|option)\s*(2|दो|दूसरा|दुसरा|सेकंड|बी\b|b\b|two|doosra|dusra|second|\bdo\b)/gi, 'option 2');
  text = text.replace(/(2|दो|दूसरा|doosra|dusra)\s*(नंबर|नम्बर|number|chun|select|lagao)/gi, 'option 2');

  // Option 3
  text = text.replace(/(ऑप्शन|विकल्प|ऑपशन|ऑप्सन|option)\s*(3|तीन|तीसरा|थर्ड|सी\b|c\b|three|teesra|teen|third)/gi, 'option 3');
  text = text.replace(/(3|तीन|तीसरा|teesra|teen)\s*(नंबर|नम्बर|number|chun|select|lagao)/gi, 'option 3');

  // Option 4
  text = text.replace(/(ऑप्शन|विकल्प|ऑपशन|ऑप्सन|option)\s*(4|चार|चौथा|फोर्थ|डी\b|d\b|four|chautha|char|fourth)/gi, 'option 4');
  text = text.replace(/(4|चार|चौथा|chautha|char)\s*(नंबर|नम्बर|number|chun|select|lagao)/gi, 'option 4');

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
  text = text.replace(/(एसएससी|सीजीएल|ssc|cgl)/gi, 'ssc cgl');
  text = text.replace(/(आरआरबी|एनटीपीसी|rrb|ntpc)/gi, 'rrb ntpc');
  text = text.replace(/(आईबीपीएस|पीओ|ibps|po|bank|बैंकिंग)/gi, 'ibps po');
  text = text.replace(/(यूपीएससी|सीसैट|upsc|csat|सिविल)/gi, 'upsc csat');
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
  text = text.replace(/(कितने|कितना|कौन कौन से|kaun kaun|kitne|list|available)/gi, 'list');
  text = text.replace(/(एग्जाम|परीक्षा|टेस्ट|exam|test)/gi, 'exam');

  return text;
}

/**
 * Detect if input is primarily in English
 */
const isEnglishQuery = (raw: string): boolean => {
  return (
    /^[a-zA-Z0-9\s.,?!'\-—/()]+$/.test(raw) &&
    !/(karo|karna|karein|batao|bataiye|kya|hai|hain|kaun|konsa|kon|kis|sawal|uttar|samjhao|shuru|agla|pichla|dusra|teesra|choutha|pahla|chuno|lagao|kholo|chalao|kitna|kitne|samay|padho|bolo|sunao|chahiye|hal|mujhe|mera|meri|mere|main|mai|hoon|hu|ho|par|pe|kahan|yahan|wahan|pariksha|khatam|nahi|raha|rahi|rahe|liye|wapas|kaise|sakte|sakta|sakti|ek|do|teen|char|paanch|aap|tum|hum)/i.test(
      raw
    )
  );
};

/**
 * Execute command against a single normalized transcript
 */
function executeCommand(rawTranscript: string, shouldAnnounce = true): CommandProcessResult {
  const normalized = normalizePhonetics(rawTranscript);
  const rawLower = rawTranscript.toLowerCase().trim();
  const context = getAssistantContext();
  const examStore = useExamStore.getState();
  const isEnglish = isEnglishQuery(rawTranscript);

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
      const reply = isEnglish
        ? 'Exam integrity mode is active. I cannot solve questions or provide answers during the live test. You can ask me to read the question, navigate, select an option, or check the time.'
        : 'Pariksha niyam ke anusaar, live mock test ke dauran main sawal ka solution ya answer nahi bata sakta. Aap option chunne, agla sawal lagane ya bacha hua samay poochne ke liye bol sakte hain.';
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
      .map((e, idx) => `${idx + 1}. ${e.title} (${e.durationMinutes} minute, ${e.questionCount} sawal)`)
      .join('; ');
    const namesEn = exams
      .map((e, idx) => `${idx + 1}. ${e.title} (${e.durationMinutes} mins, ${e.questionCount} questions)`)
      .join('; ');
    const reply = isEnglish
      ? `There are ${exams.length} Mock Examinations available: ${namesEn}. You can say "Start SSC CGL" or "Start Exam 1" to begin.`
      : `Aapke paas kul ${exams.length} Mock Examinations available hain: ${names}. Kisi bhi exam ko shuru karne ke liye boliye, jaise "SSC CGL exam start karo".`;
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
    const reply = isEnglish
      ? `The Practice Arena contains ${drills.length} topic-wise drills with helpful hints and step-by-step solutions: ${names}. You can say "Start Practice Drill" to begin.`
      : `Practice Arena me kul ${drills.length} topic-wise drills hain jisme hints aur solutions enabled hain: ${names}. Shuru karne ke liye bol sakte hain "Practice test start karo".`;
    return makeReply('LIST_PRACTICE_DRILLS', reply, 'Switched to Practice Drills');
  }

  // ==========================================
  // 3. START AN EXAM OR PRACTICE TEST
  // ==========================================
  if (
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
  ) {
    // STRICT INTEGRITY: If candidate is taking a test, prevent switching exams before submitting
    if (context.activeView === 'exam' && !examStore.isSubmitted) {
      examStore.setSubmitModalOpen(true);
      soundEffects.playTimerAlert();
      const reply = isEnglish
        ? 'An exam is currently in progress. You cannot leave or start another test before submitting this one. Please confirm submission.'
        : 'Aapki pariksha abhi chal rahi hai. Dusra test shuru karne se pehle kripya is exam ko submit karein.';
      return makeReply('CONFIRM_SUBMIT', reply, 'Opened Submit Modal (Exam Switch Prevented)');
    }

    const all = [...examStore.availableExams, ...examStore.availablePracticeDrills];
    let matchedExam = all[0];

    if (normalized.includes('ssc cgl') || normalized.includes('ssc') || normalized.includes('cgl')) {
      matchedExam = all.find((e) => e.code.toLowerCase().includes('ssc')) || matchedExam;
    } else if (normalized.includes('rrb ntpc') || normalized.includes('rrb') || normalized.includes('ntpc')) {
      matchedExam = all.find((e) => e.code.toLowerCase().includes('rrb')) || matchedExam;
    } else if (normalized.includes('ibps po') || normalized.includes('ibps') || normalized.includes('bank')) {
      matchedExam = all.find((e) => e.code.toLowerCase().includes('ibps')) || matchedExam;
    } else if (normalized.includes('upsc csat') || normalized.includes('upsc') || normalized.includes('csat')) {
      matchedExam = all.find((e) => e.code.toLowerCase().includes('csat')) || matchedExam;
    } else if (normalized.includes('practice') || normalized.includes('arithmetic')) {
      matchedExam = all.find((e) => e.id.toLowerCase().includes('practice')) || matchedExam;
    } else if (normalized.includes('dusra') || normalized.includes('second') || normalized.includes('2')) {
      matchedExam = all[1] || matchedExam;
    } else if (normalized.includes('teesra') || normalized.includes('third') || normalized.includes('3')) {
      matchedExam = all[2] || matchedExam;
    }

    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }

    examStore.selectExam(matchedExam.id, matchedExam.id.includes('practice') ? 'practice' : 'exam');
    const reply = isEnglish
      ? `Started "${matchedExam.title}". Question 1 is loaded on your screen. You can say "Read question" to hear the problem.`
      : `${matchedExam.title} start kar diya gaya hai. Question 1 aapki screen par aa gaya hai. Sawal sunne ke liye bol sakte hain "Question padho".`;
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
      const reply = `Aap abhi exam page par nahi hain. Exam start karne ke liye boliye "Exam start karo".`;
      return makeReply('NOT_IN_EXAM', reply);
    }

    const q = context.currentQuestion;
    const formulaText = q.equationLatex ? ` Isme mathematical formula hai: ${verbalizeMath(q.equationLatex)}.` : '';
    const optionsText = q.options.map((o) => `Option ${o.number}: ${verbalizeMath(o.text)}`).join('. ');
    const statusText = q.selectedOption ? `Aapne option ${q.selectedOption} chuna hua hai.` : 'Abhi koi option chuna nahi gaya hai.';

    const reply = `Sawal number ${q.number}: ${q.text}.${formulaText} Options hain: ${optionsText}. ${statusText}`;
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
      const reply = isEnglish
        ? 'Please start an exam first before selecting an option. You can say "Start exam".'
        : `Option select karne ke liye pehle koi exam start kijiye. Boliye "Exam start karo".`;
      return makeReply('NOT_IN_EXAM', reply);
    }

    let optNum = 1;
    if (normalized.includes('option 2')) optNum = 2;
    else if (normalized.includes('option 3')) optNum = 3;
    else if (normalized.includes('option 4')) optNum = 4;

    examStore.selectOption(optNum);
    const reply = isEnglish
      ? `Option ${optNum} selected. You can say "Next question" to continue.`
      : `Option ${optNum} select kar liya gaya hai. Agle sawal par jaane ke liye bol sakte hain "Next question".`;
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
      const reply = isEnglish
        ? 'Selected option cleared.'
        : `Chuna hua option clear kar diya gaya hai.`;
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
        ? (isEnglish
            ? `Moving to next question, Question number ${q.number}: ${q.text}.`
            : `Agla sawal number ${q.number}: ${q.text}. Options sunne ke liye boliye "Question padho".`)
        : (isEnglish ? 'You are on the last question.' : `Aap aakhri sawal par hain.`);
      return makeReply('NEXT_QUESTION', reply, 'Navigated to Next Question');
    }
  }

  if (normalized.includes('previous')) {
    if (context.activeView === 'exam') {
      examStore.previousQuestion();
      const prevCtx = getAssistantContext();
      const q = prevCtx.currentQuestion;
      const reply = q
        ? (isEnglish
            ? `Moved to previous question, Question number ${q.number}: ${q.text}.`
            : `Peechla sawal number ${q.number}: ${q.text}.`)
        : (isEnglish ? 'You are on the first question.' : `Aap pehle sawal par hain.`);
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
        ? (isEnglish
            ? `Question number ${examStore.currentIndex + 1} marked for review.`
            : `Question number ${examStore.currentIndex + 1} ko review ke liye mark kar diya gaya hai.`)
        : (isEnglish
            ? `Question number ${examStore.currentIndex + 1} unmarked from review.`
            : `Question number ${examStore.currentIndex + 1} ko unmark kar diya gaya hai.`);
      return makeReply('MARK_REVIEW', reply, 'Toggled Mark for Review');
    }
  }

  // ==========================================
  // 9. CHECK TIME REMAINING
  // ==========================================
  if (normalized.includes('time') || rawLower.includes('samay') || rawLower.includes('waqt')) {
    if (context.activeView === 'exam' && context.currentExam) {
      const { remainingMinutes, remainingSeconds, timeRemainingFormatted } = context.currentExam;
      const reply = isEnglish
        ? `${remainingMinutes} minutes and ${remainingSeconds} seconds remaining in your test. Timer is ${timeRemainingFormatted}.`
        : `Aapke exam me ${remainingMinutes} minute aur ${remainingSeconds} second bache hain. Display timer hai: ${timeRemainingFormatted}.`;
      return makeReply('CHECK_TIME', reply, 'Announced Remaining Time');
    } else {
      const reply = isEnglish
        ? 'You are not in an active exam. Start a test to see the timer.'
        : `Aap abhi kisi active exam me nahi hain. Timer dekhne ke liye koi test shuru karein.`;
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
      const reply = isEnglish
        ? 'Exam integrity mode is active. Solving questions and revealing answers or hints is disabled during the live test.'
        : 'Pariksha niyam ke anusaar, live mock test ke dauran kisi sawal ka solution, answer ya hint batana allowed nahi hai.';
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
    const reply = `Aapki performance report: Total ${context.totalSubmissions} tests complete kiye hain. Aapka best score ${context.bestScorePercentage}% raha hai test ${context.bestScoreTitle} me, aur overall average accuracy ${context.averageAccuracy}% hai.`;
    return makeReply('VIEW_ANALYTICS', reply, 'Opened Student Analytics');
  }

  // ==========================================
  // 12. BACK / RETURN NAVIGATION & CHOOSE ANOTHER EXAM
  // ==========================================
  if (
    normalized.includes('back') ||
    normalized.includes('return') ||
    rawLower.includes('home') ||
    rawLower.includes('catalog') ||
    rawLower.includes('wapas') ||
    rawLower.includes('exit') ||
    rawLower.includes('close exam') ||
    rawLower.includes('close test') ||
    rawLower.includes('mock test page') ||
    rawLower.includes('मॉक टेस्ट पेज') ||
    rawLower.includes('mock test par') ||
    rawLower.includes('मॉक टेस्ट पर') ||
    rawLower.includes('go on mock') ||
    rawLower.includes('go to mock') ||
    rawLower.includes('गो ऑन') ||
    rawLower.includes('गो टू') ||
    rawLower.includes('choose another') ||
    rawLower.includes('dusra exam') ||
    rawLower.includes('dusra test') ||
    rawLower.includes('test page par jao') ||
    rawLower.includes('pehle page') ||
    rawLower.includes('main page')
  ) {
    // STRICT INTEGRITY: Cannot leave active unsubmitted exam
    if (context.activeView === 'exam' && !examStore.isSubmitted) {
      examStore.setSubmitModalOpen(true);
      soundEffects.playTimerAlert();
      const reply = isEnglish
        ? 'You cannot go back before submitting the exam. Submit confirmation window is now open. Please submit your test first.'
        : 'Pariksha submit kiye bina aap wapas nahi ja sakte. Exam submit confirmation window open kar di gayi hai. Pehle test submit karein.';
      return makeReply('CONFIRM_SUBMIT', reply, 'Opened Submit Modal (Exit Prevented)');
    }

    examStore.returnToCatalog();
    const reply = isEnglish
      ? 'Returned to Examination Catalog. You can choose another mock test or practice drill to begin.'
      : 'Mock Examination Catalog page par wapas aa gaye hain. Yahan se aap koi bhi doosra test ya practice drill chun sakte hain.';
    return makeReply('NAVIGATE_BACK', reply, 'Returned to Catalog');
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
      const summaryText = rep?.verbalSummary?.join(' ') || `Aapka score ${rep?.totalScore || 0}/${rep?.maxScore || 20} raha.`;
      const reply = isEnglish
        ? `Diagnostic Summary for ${rep?.examTitle || 'Exam'}: ${summaryText}`
        : `${rep?.examTitle || 'Exam'} ki Diagnostic Summary: ${summaryText}`;
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
      const reply = isEnglish
        ? 'Resetting examination. Question 1 has been reloaded.'
        : 'Pariksha dobara shuru kar di gayi hai. Question 1 aapki screen par aa gaya hai.';
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
    const reply = isEnglish
      ? 'Opened Accessibility Preferences. You can adjust theme contrast, font scaling, and voice speed here.'
      : 'Accessibility Preferences open kar diya gaya hai. Yahan se aap high-contrast theme, font scaling, aur speech speed change kar sakte hain.';
    return makeReply('OPEN_SETTINGS', reply, 'Opened Settings Modal');
  }

  if (rawLower.includes('help') || rawLower.includes('shortcut') || rawLower.includes('guide')) {
    examStore.setShortcutsOpen(true);
    const reply = isEnglish
      ? 'Opened Keyboard Navigation Shortcuts Guide. Use N for Next Question, 1-4 for Options, and T for Remaining Time.'
      : 'Keyboard Navigation Shortcuts Guide open kar diya hai. Naya question N se, options 1 se 4 se, aur time T se sun sakte hain.';
    return makeReply('OPEN_SHORTCUTS', reply, 'Opened Shortcuts Modal');
  }

  // ==========================================
  // 15. SUBMIT EXAM
  // ==========================================
  if (normalized.includes('submit') || rawLower.includes('jama')) {
    if (context.activeView === 'exam' && !examStore.isSubmitted) {
      examStore.setSubmitModalOpen(true);
      const reply = isEnglish
        ? 'Exam submission confirmation window is now open. Confirm to submit or press Escape to return to the test.'
        : 'Exam submission confirmation window open kar di gayi hai. Jama karne ke liye confirm karein ya Escape dabayein.';
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
      const reply = isEnglish
        ? `You have completed and submitted the "${examTitle}". You are currently on the Diagnostic Report & Performance Analysis screen. Your score is ${score} out of ${maxScore} (${pct}%). You can say "Read summary", "Retake test", or "Go to mock test page".`
        : `Aapne "${examTitle}" pariksha safaltapoorvak submit kar di hai. Is samay aap apne Diagnostic Report aur Result page par hain. Aapka score ${score}/${maxScore} (${pct}%) raha. Aap "Summary padho", "Dobara test do", ya "Mock test page par jao" bol sakte hain.`;
      return makeReply('EXPLAIN_PAGE', reply, 'Explained Diagnostic Report');
    } else if (context.activeView === 'catalog') {
      const isPractice = context.portalTab === 'practice';
      const reply = isEnglish
        ? isPractice
          ? `You are currently on the DristiX Practice Arena & Skill Drills dashboard. There are ${context.availableDrills.length} practice drills available with hints and solutions.`
          : `You are currently on the DristiX Examination & Mock Test Series catalog dashboard. There are ${context.availableExams.length} Full-Length Mock Examinations available to attempt. You can say "Start SSC CGL" or "Start Exam 1" to begin.`
        : isPractice
          ? `Aap abhi DristiX ke Practice Arena page par hain. Yahan kul ${context.availableDrills.length} practice drills uplabdh hain jisme hints aur step-by-step solutions enabled hain.`
          : `Aap abhi DristiX ke "Examination & Mock Test Series" catalog page par hain. Yahan kul ${context.availableExams.length} full-length mock exams uplabdh hain, jaise SSC CGL aur IBPS PO. Kisi bhi test ko shuru karne ke liye "SSC CGL start karo" ya "Exam shuru karo" bolein.`;
      return makeReply('EXPLAIN_PAGE', reply, 'Explained Catalog Page');
    } else if (context.activeView === 'exam') {
      const q = context.currentQuestion;
      const isPractice = context.currentExam?.isPractice;
      const examTitle = context.currentExam?.title || 'Mock Examination';
      const reply = isEnglish
        ? `You are currently taking the "${examTitle}" ${isPractice ? 'Practice Drill' : 'Live Mock Examination'}, on Question ${q?.number || 1} of ${context.currentExam?.totalQuestions || 10}. Remaining time is ${context.currentExam?.timeRemainingFormatted}.`
        : `Aap abhi "${examTitle}" ke Live ${isPractice ? 'Practice Drill' : 'Mock Examination'} page par hain, aur Sawal ${q?.number || 1} par hain. Bacha hua samay ${context.currentExam?.timeRemainingFormatted} hai. Aap sawal sunne ke liye "Question padho" bol sakte hain.`;
      return makeReply('EXPLAIN_PAGE', reply, 'Explained Exam Page');
    } else if (context.activeView === 'analytics') {
      const reply = isEnglish
        ? `You are currently on the Student Performance Analytics & Diagnostic Report dashboard.`
        : `Aap abhi apne Student Performance Analytics aur Score Report page par hain. Yahan aapke tests aur marks dikh rahe hain.`;
      return makeReply('EXPLAIN_PAGE', reply, 'Explained Analytics Page');
    }
  }

  // ==========================================
  // 16. GENERAL CONVERSATION & GREETING
  // ==========================================
  if (
    rawLower.includes('namaste') ||
    rawLower.includes('नमस्ते') ||
    rawLower.includes('hello') ||
    rawLower.includes('hi')
  ) {
    const reply = isEnglish
      ? `Hello ${context.studentName}! I am the DristiX Conversational AI Voice Assistant. I can list available exams, start tests, read questions, and select options on your command. How can I help you?`
      : `Namaste ${context.studentName}! Main DristiX Conversational AI Assistant hoon. Main aapke bolne par exams list kar sakta hoon, tests start kar sakta hoon, question padh sakta hoon, aur option select kar sakta hoon. Boliye, main aapki kya madad karoon?`;
    return makeReply('GREETING', reply);
  }

  if (
    rawLower.includes('aap kaun ho') ||
    rawLower.includes('tum kaun ho') ||
    rawLower.includes('आप कौन हो') ||
    rawLower.includes('who are you')
  ) {
    const reply = isEnglish
      ? 'I am the DristiX Accessible AI Assistant, built specifically for visually impaired and competitive exam candidates to conduct tests and assist hands-free with voice commands.'
      : `Main DristiX Accessible AI Assistant hoon. Visually impaired aur sabhi candidates ke liye banaya gaya voice-first partner jo live test conduct karta hai aur aapke bolne par saare actions perform karta hai.`;
    return makeReply('IDENTITY', reply);
  }

  // Context-grounded fallback
  const isPracticeTab = context.portalTab === 'practice';
  const pageDescriptionHindi =
    context.activeView === 'catalog'
      ? isPracticeTab
        ? 'Practice Arena Drills'
        : 'Mock Examination & Test Series Catalog'
      : context.activeView === 'report'
      ? `"${context.diagnosticReport?.examTitle || 'Exam'}" ka Diagnostic Report aur Result`
      : context.activeView === 'exam'
      ? `"${context.currentExam?.title || 'Exam'}" ke Sawal ${context.currentQuestion?.number || 1}`
      : 'Analytics Dashboard';

  const pageDescriptionEnglish =
    context.activeView === 'catalog'
      ? isPracticeTab
        ? 'Practice Arena Catalog'
        : 'Mock Examinations Catalog'
      : context.activeView === 'report'
      ? `Diagnostic Report & Result screen for "${context.diagnosticReport?.examTitle || 'Exam'}"`
      : context.activeView === 'exam'
      ? `Question ${context.currentQuestion?.number || 1} of "${context.currentExam?.title || 'Exam'}"`
      : 'Analytics Dashboard';

  const fallbackReply = isEnglish
    ? `I heard: "${rawTranscript}". You are currently on the ${pageDescriptionEnglish}. ${
        context.activeView === 'report'
          ? 'You can say "Read summary", "Retake test", or "Go to mock test page".'
          : context.activeView === 'catalog'
          ? 'You can say "List available exams" or "Start SSC CGL".'
          : context.activeView === 'exam'
          ? 'You can say "Read question", "Select option 1", or "Check time".'
          : 'You can say "Return to catalog".'
      }`
    : `Maine suna: "${rawTranscript}". Is samay aap ${pageDescriptionHindi} page par hain. ${
        context.activeView === 'report'
          ? 'Aap bol sakte hain "Summary padho", "Dobara test do", ya "Mock test page par jao".'
          : context.activeView === 'catalog'
          ? 'Aap bol sakte hain "Kitne exam available hain?", "Test shuru karo", ya "SSC CGL start karo".'
          : context.activeView === 'exam'
          ? 'Aap bol sakte hain "Question padho", "Option 2 select karo", ya "Kitna time bacha hai".'
          : 'Aap bol sakte hain "Exam catalog par jao".'
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
