import { getAssistantContext } from './assistantContext';
import { useExamStore } from '../store/useExamStore';
import { useAnnouncerStore } from '../store/useAnnouncerStore';
import { usePreferencesStore } from '../store/usePreferencesStore';
import type { ThemeMode, TextScale } from '../store/usePreferencesStore';
import { soundEffects } from './soundEffects';
import { verbalizeMath, verbalizeForSpeech } from './mathVerbalizer';
import { describeOptionSelection, describeClearSelection } from './optionSpeech';
import { matchExamFromQuery } from './examMatcher';
import { isPracticeTabNavigation } from './practiceTabNavigation';
import { SonificationEngine } from '../accessibility/sonification/SonificationEngine';
import { speechEngine } from './speechEngine';
import { isHindiPreferred, voiceRecognition } from './voiceRecognition';

export interface CommandProcessResult {
  success: boolean;
  intent: string;
  userQuery: string;
  assistantReply: string;
  actionExecuted?: string;
}

/**
 * Common phantom speech recognition hallucination tokens (e.g., produced by Whisper / Web Speech API on near-silent background audio)
 */
export const PHANTOM_NOISE_TOKENS = new Set([
  'so',
  'sau',
  'sou',
  'sow',
  'su',
  'सौ',
  'सो',
  'you',
  'thank you',
  'thanks',
  'um',
  'uh',
  'ah',
  'hmm',
  'oh',
  'haan',
  'हूँ',
  'हाँ',
  'हूं',
  'the',
  'a',
  'पूल',
  'पुल',
  'pool',
  'चीज',
  'चीजे',
  'चीजें',
  'मास्टर',
  'चलाते',
  'yes',
  'no',
  'hlo',
  'hello',
  'shh',
  'bye',
  'ok',
  'okay',
  'tu',
  'tum',
  'main',
  'mai',
]);

/**
 * Checks whether an incoming transcript is a phantom noise hallucination, acoustic artifact, or meaningless ambient sound.
 */
export function isPhantomNoise(text: string): boolean {
  if (!text) return true;
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/^[.,?!:;\s]+|[.,?!:;\s]+$/g, '');
  if (!cleaned) return true;
  if (cleaned.length <= 1) return true;
  if (PHANTOM_NOISE_TOKENS.has(cleaned)) return true;

  // Filter foreign script hallucinations (Korean, Chinese, Japanese, Cyrillic, Thai, etc.)
  // Produced by Whisper model when capturing low-level ambient room noise or mic hiss.
  if (/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff\u0e00-\u0e7f]/.test(cleaned)) {
    return true;
  }

  // Repetitive hallucination loop detection (e.g. "सारी सारी", "पूल पूल पूल", "sau sau")
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const unique = new Set(words);
    if (unique.size === 1) return true;
    if (words.length >= 4 && unique.size <= 2) return true;
  }

  return false;
}

/**
 * Generates the complete spoken text for a question, including its mathematical formulas,
 * all answer options verbalized naturally, and current selection status.
 */
export function buildFullQuestionSpeech(
  q: NonNullable<ReturnType<typeof getAssistantContext>['currentQuestion']>,
  prefix = ''
): string {
  const isHindi = isHindiPreferred();
  const formulaText = q.equationLatex
    ? (isHindi ? ` समीकरण: ${verbalizeMath(q.equationLatex)}।` : ` Equation: ${verbalizeMath(q.equationLatex)}.`)
    : '';
  const graphText =
    q.graph && q.graph.enabled
      ? ` Graph details: ${SonificationEngine.generateSummary(q.graph)}.`
      : '';
  const optionsText =
    q.options && q.options.length > 0
      ? (isHindi
          ? ` विकल्प हैं: ${q.options
              .map((o) => {
                const mathVerbal = o.mathLatex ? verbalizeMath(o.mathLatex).trim() : '';
                const rawText = o.text ? o.text.trim() : '';
                let optCombined = rawText;
                if (mathVerbal) {
                  const normRaw = rawText.toLowerCase().replace(/\s+/g, ' ');
                  const normMath = mathVerbal.toLowerCase().replace(/\s+/g, ' ');
                  if (normRaw && (normRaw.includes(normMath) || normMath.includes(normRaw))) {
                    optCombined = rawText || mathVerbal;
                  } else if (rawText) {
                    optCombined = `${rawText}, ${mathVerbal}`;
                  } else {
                    optCombined = mathVerbal;
                  }
                }
                return `विकल्प ${o.number}: ${verbalizeForSpeech(optCombined)}`;
              })
              .join('। ')}।`
          : ` The options are: ${q.options
              .map((o) => {
                const mathVerbal = o.mathLatex ? verbalizeMath(o.mathLatex).trim() : '';
                const rawText = o.text ? o.text.trim() : '';
                let optCombined = rawText;
                if (mathVerbal) {
                  const normRaw = rawText.toLowerCase().replace(/\s+/g, ' ');
                  const normMath = mathVerbal.toLowerCase().replace(/\s+/g, ' ');
                  if (normRaw && (normRaw.includes(normMath) || normMath.includes(normRaw))) {
                    optCombined = rawText || mathVerbal;
                  } else if (rawText) {
                    optCombined = `${rawText}, ${mathVerbal}`;
                  } else {
                    optCombined = mathVerbal;
                  }
                }
                return `Option ${o.number}: ${verbalizeForSpeech(optCombined)}`;
              })
              .join('. ')}.`)
      : '';
  const statusText = q.selectedOption
    ? (isHindi ? ` वर्तमान में चुना गया: विकल्प ${q.selectedOption}।` : ` Currently selected: Option ${q.selectedOption}.`)
    : (isHindi ? ' अभी तक कोई विकल्प नहीं चुना गया है।' : ' No option has been selected yet.');

  const leading = prefix ? `${prefix} ` : '';
  const qLabel = isHindi ? 'प्रश्न' : 'Question';
  return `${leading}${qLabel} ${q.number}: ${verbalizeForSpeech(q.text)}.${formulaText}${graphText}${optionsText}${statusText}`;
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

  // 2. Options and numbers (Devanagari + Hinglish + English + Phonetic STT Mishearings)
  // Catch Whisper STT hearing "option" as "ocean", "action", "auction", "often", "open", "caption", "choice", "opt"
  text = text.replace(
    /(?:ऑप्शन|विकल्प|ऑपशन|ऑप्सन|option|ocean|action|auction|often|open|caption|opt|choice|choice\s*number)\s*(?:नंबर|नम्बर|number)?\s*(1|एक|पहला|पहिला|फर्स्ट|ए\b|a\b|one|won|pehla|first)/gi,
    'option 1'
  );
  text = text.replace(/(?:first|pehla|ek|1st|1)\s*(?:option|choice|wala|number|chun|select|lagao|tick)/gi, 'option 1');
  text = text.replace(/(?:select|chuno|choose|answer|uttar|उत्तर|tick|lagao)\s*(?:option)?\s*(1|one|won|ek|pehla|\ba\b|first)/gi, 'option 1');
  text = text.replace(/\b(?:option\s*a|a\s*option|choice\s*a)\b/gi, 'option 1');

  // Option 2 (including "tu", "too", "doosra", "b", "choice b")
  text = text.replace(
    /(?:ऑप्शन|विकल्प|ऑपशन|ऑप्सन|option|ocean|action|auction|often|open|caption|opt|choice|choice\s*number)\s*(?:नंबर|नम्बर|number)?\s*(2|दो|दूसरा|दुसरा|सेकंड|बी\b|b\b|two|tu|too|doosra|dusra|second|\bdo\b)/gi,
    'option 2'
  );
  text = text.replace(/(?:second|dusra|doosra|do|2nd|2)\s*(?:option|choice|wala|number|chun|select|lagao|tick)/gi, 'option 2');
  text = text.replace(/(?:select|chuno|choose|answer|uttar|उत्तर|tick|lagao)\s*(?:option)?\s*(2|two|tu|too|do|dusra|doosra|\bb\b|second)/gi, 'option 2');
  text = text.replace(/\b(?:option\s*b|b\s*option|choice\s*b)\b/gi, 'option 2');

  // Option 3 (including "tree", "teesra", "c", "choice c")
  text = text.replace(
    /(?:ऑप्शन|विकल्प|ऑपशन|ऑप्सन|option|ocean|action|auction|often|open|caption|opt|choice|choice\s*number)\s*(?:नंबर|नम्बर|number)?\s*(3|तीन|तीसरा|थर्ड|सी\b|c\b|three|tree|teesra|teen|third)/gi,
    'option 3'
  );
  text = text.replace(/(?:third|teesra|teen|3rd|3)\s*(?:option|choice|wala|number|chun|select|lagao|tick)/gi, 'option 3');
  text = text.replace(/(?:select|chuno|choose|answer|uttar|उत्तर|tick|lagao)\s*(?:option)?\s*(3|three|tree|teen|teesra|\bc\b|third)/gi, 'option 3');
  text = text.replace(/\b(?:option\s*c|c\s*option|choice\s*c)\b/gi, 'option 3');

  // Option 4 (including "for", "chautha", "d", "choice d")
  text = text.replace(
    /(?:ऑप्शन|विकल्प|ऑपशन|ऑप्सन|option|ocean|action|auction|often|open|caption|opt|choice|choice\s*number)\s*(?:नंबर|नम्बर|number)?\s*(4|चार|चौथा|फोर्थ|डी\b|d\b|four|for|chautha|char|fourth)/gi,
    'option 4'
  );
  text = text.replace(/(?:fourth|chautha|char|4th|4)\s*(?:option|choice|wala|number|chun|select|lagao|tick)/gi, 'option 4');
  text = text.replace(/(?:select|chuno|choose|answer|uttar|उत्तर|tick|lagao)\s*(?:option)?\s*(4|four|for|char|chautha|\bd\b|fourth)/gi, 'option 4');
  text = text.replace(/\b(?:option\s*d|d\s*option|choice\s*d)\b/gi, 'option 4');

  // 3. Question & Reading (including common phonetic mishearings)
  text = text.replace(
    /(?:क्वेश्चन|क्वेशन|थेकेशन|क्वेशचन|कुएस्शन|कोशचन|कवैश्चन|सवाल|प्रश्न|सवाली|question|sawal|sawaal|prashna|pestan|pestin|pression)/gi,
    'question'
  );
  text = text.replace(
    /(?:पढ़ो|पढ़कर\s*सुनाओ|सुनाओ|बोलो|रीड|बताओ|दिखाओ|दिखाइए|शो|read|bolo|sunao|sunaao|padho|show|repeat|phir\s*se|fir\s*se)/gi,
    'read'
  );

  // 4. Navigation (handling "net", "neck", "nest" for next)
  text = text.replace(/(?:अगला|अगले|आगे|नेक्स्ट|next|agla|aage|net|neck|nest|forward|ahead)/gi, 'next');
  text = text.replace(/(?:पिछला|पिछले|पीछे|प्रीवियस|previous|prev|pichla|peechla|peeche|back\s*question)/gi, 'previous');

  // 5. Actions (Clear / Reset / Mark / Review)
  text = text.replace(/(?:चुनो|लगाओ|सेलेक्ट|टिक|क्लिक|select|choose|tick|chuno|lagao)/gi, 'select');
  text = text.replace(/(?:हटाओ|हटा\s*दो|हटाना|मिटाओ|क्लियर|अनचेक|clear|deselect|unselect|hatao|mitao|reset)/gi, 'clear');
  text = text.replace(/(?:मार्क|रिव्यू|रिवियु|mark|review|doubt|flag|star)/gi, 'mark');

  // 5b. Question Palette & Exam Progress
  text = text.replace(/(?:पैलेट|पैलट|पेलट|पैलिट|palette|palet|pallet|pelet)/gi, 'palette');
  text = text.replace(/(?:स्थिति|स्टेटस|हालत|प्रोग्रेस|status|progress)/gi, 'status');

  // 6. Time / Timer
  text = text.replace(/(?:टाइम|समय|वक्त|घड़ी|time|samay|waqt|timer|clock)/gi, 'time');

  // 7. Exam operations & Specific Exam Names
  text = text.replace(/(एसएससी|सीजीएल|staff\s*selection|ssc|cgl)/gi, 'ssc cgl');
  text = text.replace(/(आरआरबी|एनटीपीसी|रेलवे|rrb|ntpc|railways?)/gi, 'rrb ntpc');
  text = text.replace(/(आईबीपीएस|पीओ|ibps|po|bank|banking|बैंकिंग|बैंक)/gi, 'ibps po');
  text = text.replace(/(यूपीएससी|सीसैट|सिविल\s*सेवा|सिविल|सिविल्स|upsc|u\.p\.s\.c|u\s*p\s*s\s*c|up\s*sc|civil\s*services?|civil|csat|ias|ips|paper\s*2|paper\s*ii)/gi, 'upsc csat');
  text = text.replace(/(प्रैक्टिस|अभ्यास|drill|practice)/gi, 'practice');
  text = text.replace(/(शुरू|चालू|स्टार्ट|खोलो|start|open|shuru|chalao|kholo)/gi, 'start');
  text = text.replace(/(सबमिट|जमा|खत्म|submit|finish|khatam|jama)/gi, 'submit');
  text = text.replace(/(वापस|बैक|होम|back|return|home|wapas)/gi, 'back');

  // 8. Analytics & Scores (Devanagari, phonetic Hindi spellings, Hinglish & English)
  text = text.replace(
    /(एनालिटिक्स|एनलेटेक्स|एनलिटिक्स|अनैलिटिक्स|एनेलिटिक्स|एनालेटिक्स|परफॉर्मेंस|रिपोर्ट्स?|स्कोर|रिजल्ट|परिणाम|analytics|score|result|performance|reports?)/gi,
    'analytics'
  );

  // 8b. Explain Current Page / Location (Grounded Navigation Inquiries)
  text = text.replace(
    /(यह कौन सा पेज है|ये कौन सा पेज है|कौन सा पेज है|कौनसा पेज है|किस पेज पर हैं?|किस पेज पर|कहाँ हूँ|कहाँ पर हूँ|यह क्या है|ये क्या है|स्क्रीन समझाओ|पेज समझाओ|screen batao|page batao|explain page|which page|where am i|what page|kaun sa page|konsa page|kis page)/gi,
    'explain_page'
  );

  // 9. Hints & Solutions
  text = text.replace(/(हिंट|मदद|सहायता|hint|help)/gi, 'hint');
  text = text.replace(/(सॉल्यूशन|हल|एक्सप्लेनेशन|समझाइए|समझाओ|solution|explanation|explain)/gi, 'solution');

  // 10. Exam lists / inquiries
  text = text.replace(/(मॉक\s*टेस्ट्स?|मॉकटेस्ट|mock\s*tests?|mocktest|moak\s*tests?|moaktest|moak|moke)/gi, 'mocktest');
  text = text.replace(
    /(कितने|कितना|कौन कौन से|कौन-कौन से|कौन-कौन|कौन से|क्या क्या|क्या-क्या|उपलब्ध|kaun kaun se|kon kon se|kaun kaun|kon kon|koun koun|kaun se|kon se|koun se|kya kya|kitne|kitna|list|lists|available|avalable|uplabdh|show\s*all)/gi,
    'list'
  );
  text = text.replace(/(एग्जाम्स?|परीक्षाएं|परीक्षा|टेस्ट्स?|examinations?|examination|exams?|tests?|pariksha)/gi, 'exam');

  return text;
}

/**
 * Execute command against a single normalized transcript
 */
function executeCommand(rawTranscript: string, shouldAnnounce = true): CommandProcessResult {
  if (isPhantomNoise(rawTranscript)) {
    return {
      success: false,
      intent: 'UNRECOGNIZED',
      userQuery: rawTranscript,
      assistantReply: '',
      actionExecuted: undefined,
    };
  }

  const normalized = normalizePhonetics(rawTranscript);
  const rawLower = rawTranscript.toLowerCase().trim();
  const context = getAssistantContext();
  const examStore = useExamStore.getState();

  const isHindi =
    context.voiceLanguageMode === 'hi-IN' ||
    context.isHindiMode ||
    voiceRecognition.isHindiMode() ||
    /[\u0900-\u097F]/.test(rawTranscript) ||
    (context.voiceLanguageMode !== 'en-US' && isHindiPreferred(rawTranscript));

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
      const reply = isHindi
        ? 'परीक्षा के दौरान उत्तर बताना या सवाल हल करना वर्जित है। आप मुझसे प्रश्न पढ़ने, विकल्प चुनने, अगला सवाल देखने या शेष समय पूछने के लिए कह सकते हैं।'
        : 'Exam integrity mode is active. I cannot solve questions or provide answers during the live test. You can ask me to read the question, navigate, select an option, or check the time.';
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
  // SUBMIT CONFIRMATION MODAL INTERCEPTOR
  // Active when "Confirm Exam Submission" dialog is displayed on screen
  // ==========================================
  if (context.activeView === 'exam' && examStore.isSubmitModalOpen) {
    const isCancelSubmit =
      normalized.includes('cancel') ||
      normalized.includes('back') ||
      rawLower.includes('cancel') ||
      rawLower.includes('return') ||
      rawLower.includes('ruko') ||
      rawLower.includes('wapas') ||
      rawLower.includes('no') ||
      rawLower.includes('nahi') ||
      rawLower.includes('mat karo') ||
      rawLower.includes('close') ||
      rawLower.includes('band') ||
      rawLower.includes('don\'t submit') ||
      rawLower.includes('dont submit');

    const isConfirmSubmit =
      normalized.includes('submit') ||
      rawLower.includes('yes') ||
      rawLower.includes('final submit') ||
      rawLower.includes('yes submit') ||
      rawLower.includes('haan submit') ||
      rawLower.includes('haan') ||
      rawLower.includes('confirm') ||
      rawLower.includes('khatam') ||
      rawLower.includes('jama') ||
      rawLower.includes('finish') ||
      rawLower.includes('submit exam') ||
      rawLower.includes('submit kar do') ||
      rawLower.includes('submit kar dijiye');

    const isReadSubmitSummary =
      normalized.includes('read') ||
      normalized.includes('status') ||
      rawLower.includes('summary') ||
      rawLower.includes('kitne') ||
      rawLower.includes('batao') ||
      rawLower.includes('details');

    if (isCancelSubmit) {
      examStore.setSubmitModalOpen(false);
      const reply = isHindi
        ? `सबमिशन रद्द कर दिया गया। प्रश्न ${examStore.currentIndex + 1} पर वापस आ गए हैं। अब आप परीक्षा जारी रख सकते हैं।`
        : `Submission cancelled. Returning to Question ${examStore.currentIndex + 1}. You can now continue your test.`;
      return makeReply('CANCEL_SUBMIT', reply, 'Cancelled Exam Submission (Returned to Exam)');
    }

    if (isConfirmSubmit) {
      examStore.submitExam();
      const reply = isHindi
        ? 'परीक्षा सफलतापूर्वक सबमिट हो गई है! आपका प्रदर्शन रिपोर्ट लोड हो रहा है।'
        : 'Final submission confirmed! Your exam session has been submitted. Loading your performance Diagnostic Report.';
      return makeReply('FINAL_SUBMIT', reply, 'Final Submitted Exam Session');
    }

    if (isReadSubmitSummary) {
      const total = examStore.questions.length;
      const attempted = Object.keys(examStore.selectedOptions).length;
      const unattempted = total - attempted;
      const marked = Object.values(examStore.markedForReview).filter(Boolean).length;
      const reply = isHindi
        ? `सबमिशन सारांश: आपने कुल ${total} में से ${attempted} प्रश्नों के उत्तर दिए हैं। ${unattempted} प्रश्न अनुत्तरित हैं और ${marked} समीक्षा के लिए चिह्नित हैं। शेष समय ${examStore.formattedTime} है। परीक्षा समाप्त करने के लिए "हाँ, सबमिट करो" बोलें, या वापस जाने के लिए "कैंसल" बोलें।`
        : `Submission Summary: You have answered ${attempted} of ${total} questions. ${unattempted} questions unattempted, and ${marked} marked for review. Time remaining is ${examStore.formattedTime}. Say "Yes, final submit" to finish, or "Cancel" to return to the test.`;
      return makeReply('READ_SUBMIT_SUMMARY', reply, 'Read Submission Confirmation Details');
    }

    // Default guidance while submit modal is actively presented
    const reply = isHindi
      ? 'आप अभी "परीक्षा सबमिट पुष्टि" विंडो पर हैं। परीक्षा समाप्त करने के लिए "हाँ, सबमिट करो" बोलें, या वापस जाने के लिए "कैंसल" बोलें।'
      : 'You are currently on the "Confirm Exam Submission" dialog. Say "Yes, final submit" to finish your test, or "Cancel" to return to the exam.';
    return makeReply('SUBMIT_MODAL_GUIDANCE', reply);
  }

  // ==========================================
  // 1. GO TO THE PRACTICE TAB (navigation only — must run BEFORE Start Exam)
  // ==========================================
  if (isPracticeTabNavigation(rawTranscript)) {
    // STRICT INTEGRITY: Cannot leave active unsubmitted exam
    if (context.activeView === 'exam' && !examStore.isSubmitted) {
      examStore.setSubmitModalOpen(true);
      soundEffects.playTimerAlert();
      const reply = isHindi
        ? 'परीक्षा सबमिट किए बिना आप बाहर नहीं जा सकते। सबमिट पुष्टि विंडो खुल गई है। कृपया पहले अपनी परीक्षा सबमिट करें।'
        : 'You cannot leave the exam before submitting it. The submit confirmation window is now open. Please submit your test first.';
      return makeReply('CONFIRM_SUBMIT', reply, 'Opened Submit Modal (Exit Prevented)');
    }

    examStore.returnToCatalog();
    examStore.setPortalTab('practice');

    const drills = context.availableDrills;
    const names = drills.map((d, idx) => `${idx + 1}. ${d.title}`).join('; ');
    const reply = drills.length
      ? (isHindi
          ? `प्रैक्टिस एरिना टैब पर आ गए हैं। आपकी स्क्रीन पर कुल ${drills.length} अभ्यास उपलब्ध हैं: ${names}। शुरू करने के लिए किसी भी अभ्यास का नाम बोलें।`
          : `Switched to the Practice Arena tab. ${drills.length} practice drills are now listed on your screen: ${names}. Say "Start" followed by a drill name to open one.`)
      : (isHindi
          ? 'प्रैक्टिस एरिना टैब पर आ गए हैं। अभी कोई अभ्यास उपलब्ध नहीं है।'
          : 'Switched to the Practice Arena tab. No practice drills are available right now. Say "Go to mock test page" to see the mock examinations.');
    return makeReply('PRACTICE_TAB', reply, 'Opened Practice Tab (No Drill Started)');
  }

  // ==========================================
  // 2. RETURN TO CATALOG / MOCK TEST PAGE / CHOOSE ANOTHER EXAM
  // Evaluated BEFORE exam listings & Start Exam so "back to mock examination page",
  // "open mock test page", or "back to tests" always navigates to catalog!
  // ==========================================
  const allExams = [...examStore.availableExams, ...examStore.availablePracticeDrills];
  const matchedExamFromQuery = matchExamFromQuery(rawTranscript, null, allExams);

  const isCatalogNavigation =
    !matchedExamFromQuery &&
    (
      normalized.includes('back') ||
      normalized.includes('return') ||
      rawLower.includes('back to') ||
      rawLower.includes('return to') ||
      rawLower.includes('go back') ||
      rawLower.includes('back to moak') ||
      rawLower.includes('moak examination') ||
      rawLower.includes('mock examination') ||
      rawLower.includes('examination page') ||
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
      rawLower.includes('exam tab') ||
      rawLower.includes('exams tab') ||
      rawLower.includes('mock tab') ||
      rawLower.includes('mocks tab') ||
      rawLower.includes('test tab') ||
      rawLower.includes('tests tab') ||
      rawLower.includes('all exams') ||
      rawLower.includes('all tests') ||
      rawLower.includes('sare test') ||
      rawLower.includes('sare exam') ||
      rawLower.includes('sare mock') ||
      rawLower.includes('test series') ||
      rawLower.includes('home page') ||
      rawLower.includes('pehle page') ||
      rawLower.includes('main page') ||
      rawLower.includes('home') ||
      rawLower.includes('wapas') ||
      rawLower.includes('exit') ||
      rawLower.includes('close exam') ||
      rawLower.includes('close test') ||
      ((context.activeView === 'report' || context.activeView === 'analytics') && (
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
      const reply = isHindi
        ? 'परीक्षा सबमिट किए बिना आप बाहर नहीं जा सकते। सबमिट पुष्टि विंडो खुल गई है। कृपया पहले अपनी परीक्षा सबमिट करें।'
        : 'You cannot leave the exam before submitting it. The submit confirmation window is now open. Please submit your test first.';
      return makeReply('CONFIRM_SUBMIT', reply, 'Opened Submit Modal (Exit Prevented)');
    }

    examStore.returnToCatalog();
    examStore.setPortalTab('exams');
    const reply = isHindi
      ? 'मॉक टेस्ट कैटलॉग पर वापस आ गए हैं। सभी उपलब्ध टेस्ट स्क्रीन पर प्रदर्शित हैं। शुरू करने के लिए किसी भी टेस्ट का नाम बोलें।'
      : 'Returned to the Examination Catalog. All available mock tests are displayed on your screen. Say "Start SSC CGL" or "Start Exam 1" to begin.';
    return makeReply('RETURN_CATALOG', reply, 'Returned to Mock Tests Catalog');
  }

  // ==========================================
  // 3. QUERY AVAILABLE EXAMS & TESTS
  // ==========================================
  const isExamListQuery =
    !isCatalogNavigation &&
    (
      normalized.includes('list exam') ||
      normalized.includes('exam list') ||
      (normalized.includes('exam') && normalized.includes('list')) ||
      (normalized.includes('kitne') && normalized.includes('exam')) ||
      normalized.includes('available exam') ||
      rawLower.includes('exams ke naam') ||
      rawLower.includes('test ke naam') ||
      rawLower.includes('tests ke naam') ||
      rawLower.includes('kaun kaun') ||
      rawLower.includes('kon kon') ||
      rawLower.includes('kon se') ||
      rawLower.includes('kaun se') ||
      rawLower.includes('konsa') ||
      rawLower.includes('kaun sa') ||
      rawLower.includes('kya kya') ||
      rawLower.includes('uplabdh') ||
      rawLower.includes('available') ||
      rawLower.includes('avalable') ||
      rawLower.includes('what exams') ||
      rawLower.includes('which exams') ||
      rawLower.includes('what tests') ||
      rawLower.includes('which tests') ||
      rawLower.includes('show mock tests') ||
      rawLower.includes('list mock tests') ||
      ((rawLower.includes('page') || rawLower.includes('yahan') || rawLower.includes('yaha')) &&
        (rawLower.includes('test') || rawLower.includes('exam') || rawLower.includes('mock')))
    );

  if (isExamListQuery) {
    // If user asks for exam listing while on analytics or report, navigate to catalog so they see it
    if (context.activeView !== 'catalog') {
      examStore.returnToCatalog();
      examStore.setPortalTab('exams');
    }

    if (context.portalTab === 'practice' && !rawLower.includes('mock')) {
      const drills = context.availableDrills;
      const names = drills.map((d, idx) => `${idx + 1}. ${d.title}`).join('; ');
      const reply = isHindi
        ? `इस प्रैक्टिस पेज पर कुल ${drills.length} अभ्यास उपलब्ध हैं: ${names}। शुरू करने के लिए अभ्यास का नाम बोलें।`
        : `On this practice page, there are ${drills.length} Practice Drills available: ${names}. Say "Start Practice Drill" to begin.`;
      return makeReply('LIST_PRACTICE_DRILLS', reply, 'List Available Practice Drills');
    }

    const exams = context.availableExams;
    const names = exams
      .map((e, idx) => `${idx + 1}. ${e.title} (${e.durationMinutes} ${isHindi ? 'मिनट' : 'mins'}, ${e.questionCount} ${isHindi ? 'प्रश्न' : 'questions'})`)
      .join('; ');
    const reply = isHindi
      ? `इस पेज पर कुल ${exams.length} मॉक टेस्ट उपलब्ध हैं: ${names}। शुरू करने के लिए टेस्ट का नाम बोलें।`
      : `On this page, there are ${exams.length} Mock Examinations available: ${names}. Say "Start SSC CGL" or "Start Exam 1" to begin.`;
    return makeReply('LIST_EXAMS', reply, 'List Available Exams');
  }

  // ==========================================
  // 4. QUERY PRACTICE DRILLS
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
    const reply = isHindi
      ? `प्रैक्टिस एरिना में उपयोगी संकेत और समाधान के साथ कुल ${drills.length} अभ्यास उपलब्ध हैं: ${names}। शुरू करने के लिए अभ्यास का नाम बोलें।`
      : `The Practice Arena contains ${drills.length} topic-wise drills with helpful hints and step-by-step solutions: ${names}. Say "Start Practice Drill" to begin.`;
    return makeReply('LIST_PRACTICE_DRILLS', reply, 'Switched to Practice Drills');
  }

  // ==========================================
  // 3. THEME LISTING & SELECTION (ACCESSIBILITY ENGINE)
  // ==========================================
  const isListThemes =
    (rawLower.includes('theme') || rawLower.includes('थीम')) &&
    (
      rawLower.includes('kaun') ||
      rawLower.includes('kon') ||
      rawLower.includes('kya') ||
      rawLower.includes('batao') ||
      rawLower.includes('naam') ||
      rawLower.includes('name') ||
      rawLower.includes('konsi') ||
      rawLower.includes('available') ||
      rawLower.includes('list') ||
      rawLower.includes('show') ||
      rawLower.includes('sare') ||
      rawLower.includes('saare') ||
      rawLower.includes('all') ||
      rawLower.includes('kitne') ||
      rawLower.includes('what') ||
      rawLower.includes('options')
    ) &&
    !rawLower.includes('high contrast') &&
    !rawLower.includes('liquid glass') &&
    !rawLower.includes('teal') &&
    !rawLower.includes('cream');

  if (isListThemes) {
    const reply = isHindi
      ? 'सिस्टम में कुल 4 एक्सेसिबिलिटी थीम उपलब्ध हैं: 1. हाई कंट्रास्ट थीम (गहरा काला और इलेक्ट्रिक यलो, 21:1 अधिकतम कंट्रास्ट), 2. डार्क थीम (चारकोल ब्लैक और एमराल्ड ग्रीन), 3. टील एंड क्रीम थीम (वॉर्म आइवरी और गहरा टील), और 4. लिक्विड ग्लास थीम (फ़्रॉस्टेड क्रिस्टल पर्पल)। किसी भी थीम को लगाने के लिए बोलें: "हाई कंट्रास्ट थीम लगाओ" या "डार्क थीम चुनो"।'
      : 'There are 4 accessibility themes available: 1. High Contrast theme (pure black and electric yellow, 21:1 maximum contrast), 2. Charcoal Dark theme (matte charcoal and emerald green), 3. Teal & Cream theme (warm ivory and deep teal), and 4. Liquid Glass theme (frosted light amethyst). Say "Select High Contrast theme" or "Select Dark theme" to apply any of them.';
    return makeReply('LIST_THEMES', reply, 'Listed Available Themes');
  }

  // 3b. High Contrast Theme Selection
  const isHighContrast =
    rawLower.includes('high contrast') ||
    rawLower.includes('हाई कंट्रास्ट') ||
    (rawLower.includes('contrast') && (
      rawLower.includes('high') ||
      rawLower.includes('select') ||
      rawLower.includes('apply') ||
      rawLower.includes('set') ||
      rawLower.includes('lagao') ||
      rawLower.includes('karo') ||
      rawLower.includes('chuno') ||
      rawLower.includes('theme') ||
      rawLower.includes('थीम')
    ));

  if (isHighContrast) {
    usePreferencesStore.getState().setTheme('high-contrast');
    soundEffects.playSelect();
    const reply = isHindi
      ? 'हाई कंट्रास्ट थीम लागू कर दी गई है। बैकग्राउंड गहरा काला और टेक्स्ट ब्राइट यलो हो गया है।'
      : 'High Contrast theme has been applied with pure black background and electric yellow text.';
    return makeReply('SELECT_THEME', reply, 'Applied High Contrast Theme');
  }

  // 3c. Dark Theme Selection
  const isDarkTheme =
    !isHighContrast &&
    (rawLower.includes('dark') || rawLower.includes('डार्क') || rawLower.includes('night mode') || rawLower.includes('नाइट मोड') || rawLower.includes('काला थीम')) &&
    (
      rawLower.includes('theme') ||
      rawLower.includes('थीम') ||
      rawLower.includes('mode') ||
      rawLower.includes('मोड') ||
      rawLower.includes('select') ||
      rawLower.includes('apply') ||
      rawLower.includes('set') ||
      rawLower.includes('lagao') ||
      rawLower.includes('karo') ||
      rawLower.includes('chuno')
    );

  if (isDarkTheme) {
    usePreferencesStore.getState().setTheme('dark');
    soundEffects.playSelect();
    const reply = isHindi
      ? 'डार्क थीम लागू कर दी गई है। चारकोल बैकग्राउंड और एमराल्ड ग्रीन एक्सेंट सेट हो गए हैं।'
      : 'Charcoal Dark theme has been applied with emerald green accents.';
    return makeReply('SELECT_THEME', reply, 'Applied Dark Theme');
  }

  // 3d. Teal & Cream Theme Selection
  const isTealCream =
    (rawLower.includes('teal') || rawLower.includes('cream') || rawLower.includes('ivory') || rawLower.includes('light') || rawLower.includes('लाइट') || rawLower.includes('क्रीम') || rawLower.includes('टील')) &&
    (
      rawLower.includes('theme') ||
      rawLower.includes('थीम') ||
      rawLower.includes('mode') ||
      rawLower.includes('मोड') ||
      rawLower.includes('select') ||
      rawLower.includes('apply') ||
      rawLower.includes('set') ||
      rawLower.includes('lagao') ||
      rawLower.includes('karo') ||
      rawLower.includes('chuno')
    );

  if (isTealCream) {
    usePreferencesStore.getState().setTheme('teal-cream');
    soundEffects.playSelect();
    const reply = isHindi
      ? 'टील एंड क्रीम थीम लागू कर दी गई है। वॉर्म आइवरी बैकग्राउंड और गहरा टील सेट हो गया है।'
      : 'Teal & Cream theme has been applied with warm ivory background and deep teal accents.';
    return makeReply('SELECT_THEME', reply, 'Applied Teal & Cream Theme');
  }

  // 3e. Liquid Glass Theme Selection
  const isLiquidGlass =
    (rawLower.includes('glass') || rawLower.includes('liquid') || rawLower.includes('purple') || rawLower.includes('frosted') || rawLower.includes('ग्लास') || rawLower.includes('लिक्विड')) &&
    (
      rawLower.includes('theme') ||
      rawLower.includes('थीम') ||
      rawLower.includes('mode') ||
      rawLower.includes('मोड') ||
      rawLower.includes('select') ||
      rawLower.includes('apply') ||
      rawLower.includes('set') ||
      rawLower.includes('lagao') ||
      rawLower.includes('karo') ||
      rawLower.includes('chuno')
    );

  if (isLiquidGlass) {
    usePreferencesStore.getState().setTheme('liquid-glass');
    soundEffects.playSelect();
    const reply = isHindi
      ? 'लिक्विड ग्लास थीम लागू कर दी गई है। फ्रॉस्टेड पर्पल क्रिस्टल सतह सेट हो गई है।'
      : 'Liquid Glass theme has been applied with frosted amethyst crystal surfaces.';
    return makeReply('SELECT_THEME', reply, 'Applied Liquid Glass Theme');
  }

  // 3f. Font Scaling Adjustment
  const isFontCommand =
    (rawLower.includes('font') || rawLower.includes('फ़ॉन्ट') || rawLower.includes('फॉन्ट') || rawLower.includes('text size') || rawLower.includes('font size')) &&
    (
      rawLower.includes('badhao') ||
      rawLower.includes('ghatao') ||
      rawLower.includes('kam') ||
      rawLower.includes('bada') ||
      rawLower.includes('chhota') ||
      rawLower.includes('increase') ||
      rawLower.includes('decrease') ||
      rawLower.includes('100') ||
      rawLower.includes('125') ||
      rawLower.includes('150') ||
      rawLower.includes('175') ||
      rawLower.includes('200') ||
      rawLower.includes('reset') ||
      rawLower.includes('normal')
    );

  if (isFontCommand) {
    const currentSize = usePreferencesStore.getState().fontSize;
    const scales: TextScale[] = [100, 125, 150, 175, 200];
    let targetSize = currentSize;

    if (rawLower.includes('200')) targetSize = 200;
    else if (rawLower.includes('175')) targetSize = 175;
    else if (rawLower.includes('150')) targetSize = 150;
    else if (rawLower.includes('125')) targetSize = 125;
    else if (rawLower.includes('100') || rawLower.includes('reset') || rawLower.includes('normal') || rawLower.includes('default')) targetSize = 100;
    else if (rawLower.includes('increase') || rawLower.includes('badhao') || rawLower.includes('bada') || rawLower.includes('large') || rawLower.includes('plus')) {
      const idx = scales.indexOf(currentSize);
      targetSize = idx < scales.length - 1 ? scales[idx + 1] : scales[scales.length - 1];
    } else if (rawLower.includes('decrease') || rawLower.includes('ghatao') || rawLower.includes('kam') || rawLower.includes('chhota') || rawLower.includes('small') || rawLower.includes('minus')) {
      const idx = scales.indexOf(currentSize);
      targetSize = idx > 0 ? scales[idx - 1] : scales[0];
    }

    usePreferencesStore.getState().setFontSize(targetSize);
    soundEffects.playSelect();
    const reply = isHindi
      ? `फ़ॉन्ट का आकार ${targetSize}% पर सेट कर दिया गया है।`
      : `Font scaling set to ${targetSize}%.`;
    return makeReply('SET_FONT_SIZE', reply, `Set Font Size to ${targetSize}%`);
  }

  // 3g. Accessibility Preferences & Settings Modal Open/Close
  const isSettingsOrA11yCommand =
    rawLower.includes('setting') ||
    rawLower.includes('सेटिंग') ||
    rawLower.includes('accessibility') ||
    rawLower.includes('एक्सेसिबिलिटी') ||
    rawLower.includes('preference') ||
    rawLower.includes('प्राथमिकता') ||
    rawLower.includes('theme') ||
    rawLower.includes('थीम') ||
    rawLower.includes('contrast') ||
    rawLower.includes('कंट्रास्ट');

  const isCloseCommand =
    rawLower.includes('close') ||
    rawLower.includes('band') ||
    rawLower.includes('hatao') ||
    rawLower.includes('exit') ||
    rawLower.includes('hide') ||
    rawLower.includes('रद्द') ||
    rawLower.includes('हटाओ') ||
    rawLower.includes('बंद');

  if (isSettingsOrA11yCommand) {
    if (isCloseCommand) {
      examStore.setSettingsOpen(false);
      soundEffects.playSelect();
      const reply = isHindi
        ? 'एक्सेसिबिलिटी सेटिंग्स बंद कर दी गई हैं।'
        : 'Accessibility Preferences modal closed.';
      return makeReply('CLOSE_SETTINGS', reply, 'Closed Settings Modal');
    }

    examStore.setSettingsOpen(true);
    soundEffects.playSelect();
    const reply = isHindi
      ? 'एक्सेसिबिलिटी प्राथमिकताएँ और सेटिंग्स खोल दी गई हैं। यहाँ आप थीम, कंट्रास्ट, फ़ॉन्ट का आकार और आवाज़ की गति बदल सकते हैं। बंद करने के लिए Escape दबाएँ या "सेटिंग्स बंद करो" बोलें।'
      : 'Accessibility Preferences opened. You can adjust theme contrast, font scaling, and voice settings here. Press Escape or say "Close settings" to return.';
    return makeReply('OPEN_SETTINGS', reply, 'Opened Accessibility Settings Modal');
  }

  // ==========================================
  // 4. KEYBOARD SHORTCUTS & HELP GUIDE
  // ==========================================
  const isShortcutsCommand =
    rawLower.includes('shortcut') ||
    rawLower.includes('शॉर्टकट') ||
    rawLower.includes('guide') ||
    rawLower.includes('गाइड') ||
    (rawLower.includes('help') && !rawLower.includes('solution') && !rawLower.includes('hint')) ||
    (rawLower.includes('मदद') && !rawLower.includes('हल'));

  if (isShortcutsCommand) {
    if (isCloseCommand) {
      examStore.setShortcutsOpen(false);
      soundEffects.playSelect();
      const reply = isHindi
        ? 'कीबोर्ड शॉर्टकट गाइड बंद कर दी गई है।'
        : 'Keyboard Shortcuts modal closed.';
      return makeReply('CLOSE_SHORTCUTS', reply, 'Closed Shortcuts Modal');
    }

    examStore.setShortcutsOpen(true);
    soundEffects.playSelect();
    const reply = isHindi
      ? 'कीबोर्ड शॉर्टकट गाइड खुल गई है। अगले प्रश्न के लिए N, पिछले के लिए P, विकल्पों के लिए 1 से 4, समय के लिए T, और सेटिंग्स के लिए A दबाएँ। बंद करने के लिए Escape दबाएँ।'
      : 'Keyboard Navigation Shortcuts Guide opened. Press N for Next Question, P for Previous, 1 to 4 for Options, T for Time, and A for Accessibility Preferences.';
    return makeReply('OPEN_SHORTCUTS', reply, 'Opened Shortcuts Modal');
  }

  // ==========================================
  // 5. START AN EXAM OR PRACTICE TEST
  // ==========================================
  if (
    !isCatalogNavigation &&
    !isSettingsOrA11yCommand &&
    !isShortcutsCommand &&
    !rawLower.includes('setting') &&
    !rawLower.includes('accessibility') &&
    !rawLower.includes('preference') &&
    !rawLower.includes('shortcut') &&
    (
      !!matchedExamFromQuery ||
      (
        !rawLower.includes('page') &&
        !rawLower.includes('catalog') &&
        (
          normalized.includes('start') ||
          normalized.includes('shuru') ||
          rawLower.includes('exam do') ||
          rawLower.includes('test lagao') ||
          rawLower.includes('ak exam') ||
          rawLower.includes('ek exam') ||
          (rawLower.includes('exam') && (rawLower.includes('karo') || rawLower.includes('do') || rawLower.includes('dikhao') || rawLower.includes('kholo') || rawLower.includes('open') || rawLower.includes('start'))) ||
          (rawLower.includes('test') && (rawLower.includes('karo') || rawLower.includes('do') || rawLower.includes('dikhao') || rawLower.includes('kholo') || rawLower.includes('open') || rawLower.includes('start'))) ||
          (rawLower.includes('drill') && (rawLower.includes('karo') || rawLower.includes('do') || rawLower.includes('dikhao') || rawLower.includes('kholo') || rawLower.includes('open') || rawLower.includes('start')))
        )
      )
    )
  ) {
    // STRICT INTEGRITY: If candidate is taking a test, prevent switching exams before submitting
    if (context.activeView === 'exam' && !examStore.isSubmitted) {
      examStore.setSubmitModalOpen(true);
      soundEffects.playTimerAlert();
      const reply = isHindi
        ? 'एक परीक्षा पहले से चल रही है। सबमिट किए बिना आप इसे छोड़ नहीं सकते या दूसरा टेस्ट शुरू नहीं कर सकते।'
        : 'An exam is currently in progress. You cannot leave or start another test before submitting this one. Please confirm submission.';
      return makeReply('CONFIRM_SUBMIT', reply, 'Opened Submit Modal (Exam Switch Prevented)');
    }

    const matchedExam = matchedExamFromQuery || allExams[0];

    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }

    // The confirmation reply below is spoken for this action, so the store's
    // own "Starting…" line is suppressed — otherwise it interrupts the reply.
    void examStore.selectExam(matchedExam.id, matchedExam.id.includes('practice') ? 'practice' : 'exam', {
      announce: false,
    });
    const reply = isHindi
      ? `"${matchedExam.title}" सफलतापूर्वक शुरू हो गया है! प्रश्न 1 आपकी स्क्रीन पर लोड हो चुका है। पूरा प्रश्न और विकल्प सुनने के लिए "प्रश्न पढ़ो" बोलें।`
      : `"${matchedExam.title}" has been opened successfully! Question 1 is now loaded on your screen. Say "Read question" to hear the full question and all options.`;
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
    rawLower.includes('dobara bolo') ||
    rawLower.includes('options padho') ||
    rawLower.includes('read option') ||
    rawLower.includes('option padho')
  ) {
    if (context.activeView !== 'exam' || !context.currentQuestion) {
      const reply = isHindi
        ? 'आप अभी किसी परीक्षा में नहीं हैं। टेस्ट शुरू करने के लिए "टेस्ट शुरू करो" बोलें।'
        : 'You are not currently in an exam. Say "Start exam" to begin a test.';
      return makeReply('NOT_IN_EXAM', reply);
    }

    const q = context.currentQuestion;
    const reply = buildFullQuestionSpeech(q);
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
      const reply = isHindi
        ? 'विकल्प चुनने से पहले कृपया कोई टेस्ट शुरू करें।'
        : 'Please start an exam first before selecting an option. Say "Start exam" to begin.';
      return makeReply('NOT_IN_EXAM', reply);
    }

    let optNum = 1;
    if (normalized.includes('option 2')) optNum = 2;
    else if (normalized.includes('option 3')) optNum = 3;
    else if (normalized.includes('option 4')) optNum = 4;

    examStore.selectOption(optNum, { announce: false });
    // One message, carrying the option's own words: "Option 3 selected
    // successfully" alone leaves a candidate working without sight unable to
    // tell which answer actually went on the record.
    const { questions, currentIndex } = useExamStore.getState();
    const selection = describeOptionSelection(questions[currentIndex], optNum);
    const reply = isHindi
      ? `${selection} आगे बढ़ने के लिए "अगला प्रश्न" बोलें, या फिर से सुनने के लिए "प्रश्न पढ़ो" कहें।`
      : `${selection} Say "Next question" to continue or "Read question" to review.`;
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
      const state = useExamStore.getState();
      const q = state.questions[state.currentIndex];
      const hadSelection = Boolean(q && state.selectedOptions[q.id]);
      examStore.clearOption({ announce: false });
      const reply = describeClearSelection(q, hadSelection);
      return makeReply(
        'CLEAR_OPTION',
        reply,
        hadSelection ? 'Cleared selected option' : 'Nothing selected to clear'
      );
    }
  }

  // ==========================================
  // 7. NEXT QUESTION & PREVIOUS QUESTION
  // ==========================================
  if (normalized.includes('next')) {
    if (context.activeView === 'exam') {
      examStore.nextQuestion({ announce: false });
      const nextCtx = getAssistantContext();
      const q = nextCtx.currentQuestion;
      if (!q) {
        const reply = isHindi
          ? 'आप पहले से ही अंतिम प्रश्न पर हैं। परीक्षा समाप्त करने के लिए "सबमिट एग्जाम" बोलें।'
          : 'You are already on the last question. Say "Submit exam" when you are ready to finish.';
        return makeReply('NEXT_QUESTION', reply, 'At Last Question');
      }
      const reply = buildFullQuestionSpeech(q);
      return makeReply('NEXT_QUESTION', reply, `Navigated to Question ${q.number}`);
    }
  }

  if (normalized.includes('previous')) {
    if (context.activeView === 'exam') {
      examStore.previousQuestion({ announce: false });
      const prevCtx = getAssistantContext();
      const q = prevCtx.currentQuestion;
      if (!q) {
        const reply = isHindi
          ? 'आप पहले से ही पहले प्रश्न पर हैं।'
          : 'You are already on the first question.';
        return makeReply('PREVIOUS_QUESTION', reply, 'At First Question');
      }
      const reply = buildFullQuestionSpeech(q);
      return makeReply('PREVIOUS_QUESTION', reply, `Navigated to Question ${q.number}`);
    }
  }

  // ==========================================
  // 7b. JUMP TO SPECIFIC QUESTION
  // ==========================================
  const jumpMatch =
    normalized.match(/(?:jump\s*to|go\s*to|open\s*question|question|sawal|prashna)\s*(?:number)?\s*(\d+)/i) ||
    normalized.match(/\b(\d+)(?:st|nd|rd|th)?\s*(?:question|sawal|prashna|par\s*jao|kholo)\b/i) ||
    rawTranscript.match(/(?:क्वेश्चन|सवाल|प्रश्न)\s*(?:नंबर)?\s*(\d+)/i) ||
    rawTranscript.match(/(\d+)\s*(?:नंबर)?\s*(?:क्वेश्चन|सवाल|प्रश्न|पर\s*जाओ|खोलो)/i);
  if (
    jumpMatch &&
    !normalized.includes('read') &&
    !normalized.includes('option') &&
    !normalized.includes('next') &&
    !normalized.includes('previous')
  ) {
    const targetNum = parseInt(jumpMatch[1], 10);
    if (context.activeView === 'exam' && targetNum >= 1 && targetNum <= examStore.questions.length) {
      examStore.jumpToQuestion(targetNum - 1, { announce: false });
      const jumpCtx = getAssistantContext();
      const q = jumpCtx.currentQuestion;
      if (q) {
        const reply = buildFullQuestionSpeech(q);
        return makeReply('JUMP_QUESTION', reply, `Jumped to Question ${q.number}`);
      }
    }
  }

  // ==========================================
  // 8. MARK FOR REVIEW
  // ==========================================
  if (normalized.includes('mark') || normalized.includes('review')) {
    if (context.activeView === 'exam') {
      examStore.toggleMarkForReview();
      const isMarked = examStore.markedForReview[examStore.questions[examStore.currentIndex].id];
      const reply = isHindi
        ? (isMarked
            ? `प्रश्न ${examStore.currentIndex + 1} समीक्षा के लिए चिह्नित कर दिया गया है।`
            : `प्रश्न ${examStore.currentIndex + 1} से समीक्षा का चिह्न हटा दिया गया है।`)
        : (isMarked
            ? `Question ${examStore.currentIndex + 1} has been marked for review.`
            : `Question ${examStore.currentIndex + 1} has been unmarked from review.`);
      return makeReply('MARK_REVIEW', reply, 'Toggled Mark for Review');
    }
  }

  // ==========================================
  // 9. CHECK TIME REMAINING
  // ==========================================
  if (normalized.includes('time') || rawLower.includes('samay') || rawLower.includes('waqt')) {
    if (context.activeView === 'exam' && context.currentExam) {
      const { remainingMinutes, remainingSeconds, timeRemainingFormatted } = context.currentExam;
      const reply = isHindi
        ? `आपके पास ${remainingMinutes} मिनट और ${remainingSeconds} सेकंड शेष हैं। टाइमर: ${timeRemainingFormatted}।`
        : `You have ${remainingMinutes} minutes and ${remainingSeconds} seconds remaining. Timer shows: ${timeRemainingFormatted}.`;
      return makeReply('CHECK_TIME', reply, 'Announced Remaining Time');
    } else {
      const reply = isHindi
        ? 'आप अभी किसी सक्रिय परीक्षा में नहीं हैं।'
        : 'You are not currently in an active exam. Start a test to see the timer.';
      return makeReply('CHECK_TIME', reply);
    }
  }

  // ==========================================
  // 9b. QUESTION PALETTE & EXAM PROGRESS STATUS
  // ==========================================
  const isClosePalette =
    examStore.isPaletteOpen &&
    (
      normalized.includes('close') ||
      rawLower.includes('band') ||
      rawLower.includes('close palette') ||
      rawLower.includes('palette band')
    );

  if (isClosePalette) {
    examStore.setPaletteOpen(false);
    const reply = isHindi
      ? `प्रश्न पैलेट बंद कर दिया गया। प्रश्न ${examStore.currentIndex + 1} पर वापस आ गए हैं।`
      : `Question Palette closed. Resuming on Question ${examStore.currentIndex + 1}.`;
    return makeReply('CLOSE_PALETTE', reply, 'Closed Question Palette');
  }

  const isPaletteQuery =
    normalized.includes('palette') ||
    normalized.includes('status') ||
    rawLower.includes('palette') ||
    rawLower.includes('pallet') ||
    rawLower.includes('palet') ||
    rawLower.includes('pelet') ||
    rawLower.includes('kitne bache') ||
    rawLower.includes('kitne baki') ||
    rawLower.includes('kitne sawal bache') ||
    rawLower.includes('kitne question bache') ||
    rawLower.includes('kitne sawal ho gaye') ||
    rawLower.includes('kitne question ho gaye') ||
    rawLower.includes('kitne attempt') ||
    rawLower.includes('kitne mark') ||
    rawLower.includes('kya status') ||
    rawLower.includes('status batao') ||
    rawLower.includes('progress batao') ||
    rawLower.includes('questions left') ||
    rawLower.includes('questions remaining') ||
    rawLower.includes('questions answered');

  if (isPaletteQuery) {
    if (context.activeView === 'exam' && examStore.questions.length > 0) {
      const { questions, selectedOptions, markedForReview, currentIndex } = examStore;
      const total = questions.length;
      const answeredCount = Object.keys(selectedOptions).length;
      const markedCount = Object.keys(markedForReview).filter((id) => markedForReview[id]).length;
      const leftCount = total - answeredCount;

      const shouldOpenModal =
        normalized.includes('open') ||
        normalized.includes('start') ||
        rawLower.includes('kholo') ||
        rawLower.includes('dikhao') ||
        rawLower.includes('show') ||
        rawLower.includes('full palette');

      if (shouldOpenModal && !examStore.isPaletteOpen) {
        examStore.setPaletteOpen(true);
      }

      const reply = isHindi
        ? `प्रश्न पैलेट सारांश: कुल ${total} प्रश्न हैं। ${answeredCount} के उत्तर दिए, ${markedCount} समीक्षा के लिए चिह्नित हैं, ${leftCount} शेष हैं। आप अभी प्रश्न ${currentIndex + 1} पर हैं।`
        : `Question Palette summary: Total ${total} questions. ${answeredCount} answered, ${markedCount} marked for review, ${leftCount} left. You are currently on Question ${currentIndex + 1}.`;
      return makeReply(
        'QUESTION_PALETTE_STATUS',
        reply,
        shouldOpenModal ? 'Opened Question Palette Modal' : 'Announced Question Palette Summary'
      );
    } else {
      const reply = isHindi
        ? 'प्रश्न पैलेट केवल परीक्षा के दौरान उपलब्ध होता है।'
        : 'Question Palette is only available during an active exam. Say "Start exam" to begin a test.';
      return makeReply('NOT_IN_EXAM', reply);
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
      const reply = isHindi
        ? 'परीक्षा के दौरान उत्तर बताना या सवाल हल करना वर्जित है।'
        : 'Exam integrity mode is active. Solving questions and revealing answers or hints is not allowed during the live test.';
      return makeReply('EXAM_INTEGRITY_REFUSAL', reply, 'Exam Integrity Protected');
    }
  }

  // ==========================================
  // 11. STUDENT PERFORMANCE & ANALYTICS
  // ==========================================
  const isAnalyticsTargeted =
    context.activeView === 'analytics' ||
    normalized.includes('analytics') ||
    rawLower.includes('meri report') ||
    rawLower.includes('performance') ||
    rawLower.includes('परफॉरमेंस') ||
    rawLower.includes('student dashboard') ||
    rawLower.includes('score analytics');

  const a = context.analytics;
  const total = a?.totalTests ?? context.totalSubmissions;
  const timed = a?.timedExamsCount ?? 0;
  const drills = a?.drillsCount ?? 0;
  const bestPct = a?.bestScorePercentage ?? context.bestScorePercentage;
  const bestTitle = a?.bestScoreTitle ?? context.bestScoreTitle;
  const bestMarks = a?.bestScoreMarks ?? '';
  const avgAcc = a?.averageAccuracy ?? context.averageAccuracy;
  const qSolved = a?.questionsSolved ?? 0;
  const corr = a?.correctCount ?? 0;
  const wrong = a?.wrongCount ?? 0;
  const latest = a?.recentSubmissions?.[0];

  // Specific query: History / Recent Submissions
  if (
    isAnalyticsTargeted &&
    (rawLower.includes('history') ||
      rawLower.includes('हिस्ट्री') ||
      rawLower.includes('recent test') ||
      rawLower.includes('previous test') ||
      rawLower.includes('pichla test') ||
      rawLower.includes('pichhla test') ||
      rawLower.includes('pichle test') ||
      rawLower.includes('purane test') ||
      rawLower.includes('past test') ||
      rawLower.includes('past exam') ||
      rawLower.includes('attempts'))
  ) {
    if (a?.recentSubmissions && a.recentSubmissions.length > 0) {
      const items = a.recentSubmissions
        .slice(0, 3)
        .map(
          (s, i) =>
            isHindi
              ? `${i + 1}: ${s.examTitle}, स्कोर ${s.score}/${s.maxScore} अंक, सटीकता ${s.percentage}% (${s.correctCount} सही, ${s.incorrectCount} गलत) दिनांक ${s.date}`
              : `${i + 1}: ${s.examTitle}, score ${s.score} out of ${s.maxScore} points with ${s.percentage}% accuracy (${s.correctCount} correct, ${s.incorrectCount} wrong) on ${s.date}`
        )
        .join('. ');
      const reply = isHindi
        ? `आपके टेस्ट इतिहास में कुल ${total} टेस्ट दर्ज हैं। हालिया 3 टेस्ट: ${items}। आप "समरी सुनो" या "टेस्ट पेज पर जाओ" बोल सकते हैं।`
        : `Your test history shows ${total} total submissions. Recent 3 tests: ${items}. Say "Listen to summary" or "Back to tests".`;
      return makeReply('ANALYTICS_HISTORY', reply, 'Read Test History');
    }
  }

  // Specific query: Questions Solved (Correct vs Wrong)
  if (
    isAnalyticsTargeted &&
    (rawLower.includes('question solved') ||
      rawLower.includes('questions solved') ||
      rawLower.includes('kitne question solve') ||
      rawLower.includes('kitne sawal solve') ||
      rawLower.includes('kitne sahi') ||
      rawLower.includes('kitne galat') ||
      rawLower.includes('correct kitne') ||
      rawLower.includes('wrong kitne'))
  ) {
    const reply = isHindi
      ? `हल किए गए प्रश्नों का विवरण: आपने कुल ${qSolved} प्रश्न हल किए हैं, जिनमें ${corr} सही और ${wrong} गलत हैं।`
      : `Questions Solved Breakdown: You have solved ${qSolved} questions in total across all tests, with ${corr} correct answers and ${wrong} wrong answers.`;
    return makeReply('ANALYTICS_QUESTIONS', reply, 'Read Questions Solved Breakdown');
  }

  // Specific query: Accuracy
  if (
    isAnalyticsTargeted &&
    (rawLower.includes('accuracy') ||
      rawLower.includes('एक्यूरेसी') ||
      rawLower.includes('average accuracy') ||
      rawLower.includes('meri accuracy'))
  ) {
    const reply = isHindi
      ? `औसत सटीकता: ${total} पूर्ण किए गए टेस्टों में आपकी कुल सटीकता ${avgAcc} प्रतिशत है।`
      : `Average Accuracy: Your overall accuracy across ${total} completed tests is ${avgAcc} percent.`;
    return makeReply('ANALYTICS_ACCURACY', reply, 'Read Average Accuracy');
  }

  // Specific query: Best Score
  if (
    isAnalyticsTargeted &&
    (rawLower.includes('best score') ||
      rawLower.includes('top score') ||
      rawLower.includes('highest score') ||
      rawLower.includes('sabse accha score') ||
      rawLower.includes('sabse zyada score') ||
      rawLower.includes('बेस्ट स्कोर'))
  ) {
    const reply = isHindi
      ? `व्यक्तिगत सर्वश्रेष्ठ स्कोर: आपका उच्चतम स्कोर ${bestPct} प्रतिशत (${bestMarks} अंक) "${bestTitle}" में रहा है।`
      : `Personal Best Score: Your highest score is ${bestPct} percent (${bestMarks} points) achieved in "${bestTitle}".`;
    return makeReply('ANALYTICS_BEST_SCORE', reply, 'Read Best Score');
  }

  // Specific query: Tests Completed Count
  if (
    isAnalyticsTargeted &&
    (rawLower.includes('kitne test') ||
      rawLower.includes('kitne exam') ||
      rawLower.includes('tests completed') ||
      rawLower.includes('total test') ||
      rawLower.includes('total exam'))
  ) {
    const reply = isHindi
      ? `दिए गए टेस्ट: आपने कुल ${total} टेस्ट पूरे किए हैं, जिनमें ${timed} समयबद्ध मॉक टेस्ट और ${drills} प्रैक्टिस ड्रिल शामिल हैं।`
      : `Tests Completed: You have completed ${total} tests in total, consisting of ${timed} timed mock exams and ${drills} practice drills.`;
    return makeReply('ANALYTICS_COUNT', reply, 'Read Tests Completed Count');
  }

  // Overall Performance Summary & Real Data
  if (
    normalized.includes('analytics') ||
    rawLower.includes('meri report') ||
    rawLower.includes('performance') ||
    rawLower.includes('परफॉरमेंस') ||
    rawLower.includes('real data') ||
    rawLower.includes('रियल डेटा') ||
    rawLower.includes('data padho') ||
    rawLower.includes('data batao') ||
    rawLower.includes('data sunao') ||
    rawLower.includes('page ka data') ||
    rawLower.includes('page data') ||
    rawLower.includes('mera data') ||
    (context.activeView === 'analytics' &&
      (rawLower.includes('summary') ||
        rawLower.includes('समरी') ||
        rawLower.includes('listen to summary') ||
        rawLower.includes('score') ||
        rawLower.includes('स्कोर') ||
        rawLower.includes('result') ||
        rawLower.includes('रिजल्ट') ||
        rawLower.includes('parinaam') ||
        rawLower.includes('परिणाम'))) ||
    (context.activeView !== 'report' &&
      context.activeView !== 'exam' &&
      (normalized.includes('score') ||
        rawLower.includes('result') ||
        rawLower.includes('parinaam')))
  ) {
    if (context.activeView !== 'analytics') {
      examStore.openAnalytics();
    }
    const latestDetails = latest
      ? (isHindi
          ? ` हालिया टेस्ट "${latest.examTitle}" था जिसमें ${latest.score} अंक और ${latest.percentage}% सटीकता रही।`
          : ` Most recent test was "${latest.examTitle}" on ${latest.date}, scored ${latest.score} out of ${latest.maxScore} points with ${latest.percentage}% accuracy.`)
      : '';
    const reply = isHindi
      ? `${context.studentName} का परफॉर्मेंस सारांश: कुल ${total} टेस्ट दिए (${timed} समयबद्ध मॉक टेस्ट, ${drills} प्रैक्टिस ड्रिल)। सर्वश्रेष्ठ स्कोर: "${bestTitle}" में ${bestPct}% (${bestMarks} अंक)। औसत सटीकता: ${avgAcc}%। कुल हल प्रश्न: ${qSolved} (${corr} सही, ${wrong} गलत)।${latestDetails} आप "हिस्ट्री बताओ" या "टेस्ट पेज पर जाओ" बोल सकते हैं।`
      : `Performance Summary for ${context.studentName}: Total ${total} tests completed (${timed} timed exams, ${drills} practice drills). Best score: ${bestPct} percent (${bestMarks} points) in "${bestTitle}". Average accuracy: ${avgAcc} percent. Questions solved: ${qSolved} total (${corr} correct, ${wrong} wrong).${latestDetails} Say "History batao" or "Back to tests".`;
    return makeReply('VIEW_ANALYTICS', reply, 'Read Performance Analytics Summary');
  }

  // ==========================================
  // 12. AUDITORY GRAPH & CHART SONIFICATION
  // ==========================================
  if (
    normalized.includes('graph') ||
    normalized.includes('chart') ||
    normalized.includes('sonification') ||
    rawLower.includes('graph sunao') ||
    rawLower.includes('chart sunao') ||
    rawLower.includes('play graph') ||
    rawLower.includes('play chart') ||
    rawLower.includes('read graph') ||
    rawLower.includes('read chart') ||
    rawLower.includes('graph data') ||
    rawLower.includes('chart data')
  ) {
    if (context.activeView === 'exam' && context.currentQuestion) {
      const q = context.currentQuestion;
      if (q.graph && q.graph.enabled && q.graph.data?.length) {
        soundEffects.playSelect();
        const g = q.graph;
        const unit = g.unit ? ` ${g.unit}` : '';
        const dataList = g.data.map((d) => `${d.label}: ${d.value}${unit}`).join(', ');
        const stats = SonificationEngine.computeStats(g.data);
        const reply = isHindi
          ? `डेटा चार्ट: "${g.title || 'चार्ट'}"। इसमें ${g.data.length} डेटा बिंदु हैं: ${dataList}। सबसे अधिक मान ${stats.maxPoint?.label ?? ''} में ${stats.maxPoint?.value ?? ''}${unit} है। सबसे कम मान ${stats.minPoint?.label ?? ''} में ${stats.minPoint?.value ?? ''}${unit} है। अब ध्वनि पिच सुनी जा रही है।`
          : `Data Chart: "${g.title || 'Chart'}". It contains ${g.data.length} data points: ${dataList}. Highest value is ${stats.maxPoint?.value ?? ''}${unit} in ${stats.maxPoint?.label ?? ''}. Lowest value is ${stats.minPoint?.value ?? ''}${unit} in ${stats.minPoint?.label ?? ''}. Now playing the auditory pitch sweep.`;

        // Wait until voice finishes speaking, then play the pitch sweep cleanly
        const unsubscribe = speechEngine.onSpeechEnd(() => {
          unsubscribe();
          if (q.graph) {
            SonificationEngine.playOverviewSweep(q.graph, 0.45);
          }
        });

        return makeReply('PLAY_GRAPH', reply, 'Played Graph Sonification');
      } else {
        const reply = isHindi
          ? `प्रश्न ${q.number} में कोई डेटा ग्राफ नहीं है।`
          : `Question ${q.number} does not contain a data graph.`;
        return makeReply('NO_GRAPH', reply);
      }
    }
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
      const summaryText = rep?.verbalSummary?.join(' ') || (isHindi ? `आपका स्कोर 20 में से ${rep?.totalScore || 0} रहा।` : `Your score was ${rep?.totalScore || 0} out of ${rep?.maxScore || 20}.`);
      const reply = isHindi ? `"${rep?.examTitle || 'परीक्षा'}" का डायग्नोस्टिक सारांश: ${summaryText}` : `Diagnostic Summary for "${rep?.examTitle || 'Exam'}": ${summaryText}`;
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
      const reply = isHindi
        ? 'परीक्षा रीसेट कर दी गई है। प्रश्न 1 स्क्रीन पर लोड हो चुका है। शुरू करने के लिए "प्रश्न पढ़ो" बोलें।'
        : 'Exam has been reset. Question 1 is now loaded. Say "Read question" to begin.';
      return makeReply('RETAKE_EXAM', reply, 'Retook Exam');
    }
  }



  // ==========================================
  // 15. SUBMIT EXAM
  // ==========================================
  if (normalized.includes('submit') || rawLower.includes('jama')) {
    if (context.activeView === 'exam' && !examStore.isSubmitted) {
      examStore.setSubmitModalOpen(true);
      const reply = isHindi
        ? 'परीक्षा सबमिट करने की पुष्टि विंडो खुल गई है। समाप्त करने के लिए कन्फर्म करें, या वापस जाने के लिए Escape दबाएँ।'
        : 'Exam submission confirmation window is now open. Confirm to submit your exam, or press Escape to return to the test.';
      return makeReply('CONFIRM_SUBMIT', reply, 'Opened Submit Modal');
    }
  }

  // ==========================================
  // 16. EXPLAIN CURRENT PAGE (Grounded)
  // ==========================================
  if (
    normalized.includes('explain_page') ||
    rawLower.includes('kis page') ||
    rawLower.includes('किस पेज') ||
    rawLower.includes('कौन सा पेज') ||
    rawLower.includes('कौनसा पेज') ||
    rawLower.includes('यह कौन सा') ||
    rawLower.includes('ये कौन सा') ||
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
    rawLower.includes('explain page') ||
    rawLower.includes('कहाँ हूँ') ||
    rawLower.includes('कहाँ पर हूँ') ||
    rawLower.includes('यह क्या है') ||
    rawLower.includes('स्क्रीन समझाओ') ||
    rawLower.includes('पेज समझाओ')
  ) {
    if (context.activeView === 'report') {
      const rep = context.diagnosticReport;
      const examTitle = rep?.examTitle || context.currentExam?.title || 'Mock Examination';
      const score = rep?.totalScore ?? 0;
      const maxScore = rep?.maxScore ?? 20;
      const pct = rep?.scorePercentage ?? 0;
      const reply = isHindi
        ? `आपने "${examTitle}" सफलतापूर्वक पूरी करके सबमिट कर दी है। आप अभी डायग्नोस्टिक रिपोर्ट और परफॉर्मेंस विश्लेषण स्क्रीन पर हैं। आपका स्कोर ${maxScore} में से ${score} (${pct}%) है। आप "समरी पढ़ो", "दोबारा टेस्ट दो" या "मॉक टेस्ट पेज पर जाओ" बोल सकते हैं।`
        : `You have completed and submitted "${examTitle}". You are currently on the Diagnostic Report & Performance Analysis screen. Your score is ${score} out of ${maxScore} (${pct}%). Say "Read summary", "Retake test", or "Go to mock test page".`;
      return makeReply('EXPLAIN_PAGE', reply, 'Explained Diagnostic Report');
    } else if (context.activeView === 'catalog') {
      const isPractice = context.portalTab === 'practice';
      const reply = isHindi
        ? (isPractice
            ? `आप अभी दृष्टिएक्स प्रैक्टिस एरिना डैशबोर्ड पर हैं। यहाँ संकेत और समाधान के साथ कुल ${context.availableDrills.length} अभ्यास उपलब्ध हैं।`
            : `आप अभी दृष्टिएक्स मॉक टेस्ट श्रृंखला कैटलॉग पर हैं। यहाँ कुल ${context.availableExams.length} मॉक परीक्षाएं उपलब्ध हैं। शुरू करने के लिए टेस्ट का नाम बोलें।`)
        : (isPractice
            ? `You are currently on the DristiX Practice Arena & Skill Drills dashboard. There are ${context.availableDrills.length} practice drills available with hints and solutions.`
            : `You are currently on the DristiX Examination & Mock Test Series catalog. There are ${context.availableExams.length} full-length mock exams available. Say "Start SSC CGL" or "Start Exam 1" to begin.`);
      return makeReply('EXPLAIN_PAGE', reply, 'Explained Catalog Page');
    } else if (context.activeView === 'exam') {
      const q = context.currentQuestion;
      const isPractice = context.currentExam?.isPractice;
      const examTitle = context.currentExam?.title || 'Mock Examination';
      const reply = isHindi
        ? `आप अभी "${examTitle}" ${isPractice ? 'प्रैक्टिस ड्रिल' : 'लाइव मॉक परीक्षा'} दे रहे हैं, प्रश्न ${context.currentExam?.totalQuestions || 10} में से प्रश्न ${q?.number || 1} पर हैं। शेष समय: ${context.currentExam?.timeRemainingFormatted}। प्रश्न सुनने के लिए "प्रश्न पढ़ो" बोलें।`
        : `You are currently taking "${examTitle}" ${isPractice ? 'Practice Drill' : 'Live Mock Examination'}, on Question ${q?.number || 1} of ${context.currentExam?.totalQuestions || 10}. Remaining time: ${context.currentExam?.timeRemainingFormatted}. Say "Read question" to hear the question and options.`;
      return makeReply('EXPLAIN_PAGE', reply, 'Explained Exam Page');
    } else if (context.activeView === 'analytics') {
      const a = context.analytics;
      const total = a?.totalTests ?? context.totalSubmissions;
      const timed = a?.timedExamsCount ?? 0;
      const drills = a?.drillsCount ?? 0;
      const bestPct = a?.bestScorePercentage ?? context.bestScorePercentage;
      const bestTitle = a?.bestScoreTitle ?? context.bestScoreTitle;
      const bestMarks = a?.bestScoreMarks ?? '';
      const avgAcc = a?.averageAccuracy ?? context.averageAccuracy;
      const qSolved = a?.questionsSolved ?? 0;
      const corr = a?.correctCount ?? 0;
      const wrong = a?.wrongCount ?? 0;
      const reply = isHindi
        ? `आप अपने परफॉर्मेंस और स्कोर एनालिटिक्स डैशबोर्ड पर हैं। कुल ${total} टेस्ट दिए हैं (${timed} समयबद्ध टेस्ट, ${drills} प्रैक्टिस ड्रिल)। सर्वश्रेष्ठ स्कोर: "${bestTitle}" में ${bestPct}% (${bestMarks} अंक)। औसत सटीकता: ${avgAcc}%। कुल हल प्रश्न: ${qSolved} (${corr} सही, ${wrong} गलत)। आप "समरी सुनो", "हिस्ट्री बताओ" या "टेस्ट पेज पर जाओ" बोल सकते हैं।`
        : `You are on your Performance & Score Analytics Dashboard. Real data recorded: ${total} tests completed (${timed} timed exams, ${drills} practice drills). Best score is ${bestPct}% (${bestMarks} points) in "${bestTitle}". Average accuracy is ${avgAcc}%. Total questions solved: ${qSolved} (${corr} correct, ${wrong} wrong). Say "Listen to summary", "History batao", or "Back to tests".`;
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
    const reply = isHindi
      ? `नमस्ते ${context.studentName}! मैं दृष्टिएक्स का वॉइस असिस्टेंट हूँ। मैं टेस्ट शुरू करने, प्रश्न पढ़ने और विकल्प चुनने में आपकी सहायता कर सकता हूँ। मैं आपकी क्या मदद करूँ?`
      : `Hello ${context.studentName}! I am the DristiX Conversational AI Voice Assistant. I can list available exams, start tests, read questions, and select options on your command. How can I help you?`;
    return makeReply('GREETING', reply);
  }

  if (
    rawLower.includes('aap kaun ho') ||
    rawLower.includes('tum kaun ho') ||
    rawLower.includes('आप कौन हो') ||
    rawLower.includes('who are you')
  ) {
    const reply = isHindi
      ? 'मैं दृष्टिएक्स सुगम्य एआई सहायक हूँ, जो दृष्टिबाधित और प्रतियोगी परीक्षा के छात्रों के लिए आवाज़ से टेस्ट देने में मदद करता है।'
      : 'I am the DristiX Accessible AI Assistant, built specifically for visually impaired and competitive exam candidates to conduct tests and assist hands-free with voice commands.';
    return makeReply('IDENTITY', reply);
  }

  // If the query was purely a single token or ambient noise, do NOT blurt out a fallback
  if (rawTranscript.trim().split(/\s+/).length <= 1 && isPhantomNoise(rawTranscript)) {
    return {
      success: false,
      intent: 'UNRECOGNIZED',
      userQuery: rawTranscript,
      assistantReply: '',
      actionExecuted: undefined,
    };
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
      : 'Performance Analytics Dashboard';

  const fallbackReply = isHindi
    ? `मैंने सुना: "${rawTranscript}"। आप अभी ${
        context.activeView === 'report'
          ? `"${context.diagnosticReport?.examTitle || 'परीक्षा'}" की रिजल्ट स्क्रीन पर हैं। आप "समरी पढ़ो", "दोबारा टेस्ट दो" या "मॉक टेस्ट पेज पर जाओ" बोल सकते हैं।`
          : context.activeView === 'catalog'
          ? (context.portalTab === 'practice'
              ? 'प्रैक्टिस एरिना कैटलॉग पर हैं। आप "अभ्यास सूची बताओ" बोल सकते हैं।'
              : 'मॉक टेस्ट कैटलॉग पर हैं। आप "टेस्ट लिस्ट बताओ" या "एसएससी सीजीएल शुरू करो" बोल सकते हैं।')
          : context.activeView === 'exam'
          ? `प्रश्न ${context.currentQuestion?.number || 1} पर हैं। आप "प्रश्न पढ़ो", "विकल्प 1 चुनो", "अगला प्रश्न" या "समय बताओ" बोल सकते हैं।`
          : 'परफॉर्मेंस डैशबोर्ड पर हैं। आप "समरी सुनो", "हिस्ट्री बताओ" या "टेस्ट पेज पर जाओ" बोल सकते हैं।'
      }`
    : `I heard: "${rawTranscript}". You are currently on the ${pageDescription}. ${
        context.activeView === 'report'
          ? 'You can say "Read summary", "Retake test", or "Go to mock test page".'
          : context.activeView === 'catalog'
          ? 'You can say "List available exams" or "Start SSC CGL".'
          : context.activeView === 'exam'
          ? 'You can say "Read question", "Select option 1", "Next question", or "Check time".'
          : 'You can say "Listen to summary", "History batao", or "Back to tests".'
      }`;
  return makeReply('FALLBACK', fallbackReply, undefined, false);
}

/**
 * High-accuracy multi-candidate processor with clause extraction for trailing noise resilience
 */
export function processVoiceCommand(
  rawTranscriptOrAlternatives: string | string[]
): CommandProcessResult {
  const initialCandidates: string[] = Array.isArray(rawTranscriptOrAlternatives)
    ? rawTranscriptOrAlternatives
    : [rawTranscriptOrAlternatives];

  const candidates: string[] = [];

  for (const c of initialCandidates) {
    const trimmed = c.trim();
    if (!trimmed || isPhantomNoise(trimmed)) continue;
    if (!candidates.includes(trimmed)) {
      candidates.push(trimmed);
    }

    // Extract leading sentence/clause if trailing background talk was appended
    // Split by punctuation (Devanagari danda ।, question mark ?, period ., exclamation !, newline)
    const clauses = trimmed.split(/[।?!.\n\r]+/).map((s) => s.trim()).filter(Boolean);
    if (clauses.length > 1) {
      const firstClause = clauses[0];
      if (firstClause && !candidates.includes(firstClause) && !isPhantomNoise(firstClause)) {
        candidates.push(firstClause);
      }
    }

    // Also extract leading words if candidate is long (>= 5 words)
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length >= 5) {
      const leading5 = words.slice(0, 5).join(' ');
      if (!candidates.includes(leading5) && !isPhantomNoise(leading5)) {
        candidates.push(leading5);
      }
      const leading8 = words.slice(0, 8).join(' ');
      if (!candidates.includes(leading8) && !isPhantomNoise(leading8)) {
        candidates.push(leading8);
      }
    }
  }

  let bestResult: CommandProcessResult | null = null;

  // Search through all alternatives from SpeechRecognition engine without interim announcements
  for (const transcript of candidates) {
    if (!transcript.trim()) continue;
    const res = executeCommand(transcript, false);
    if (res.intent !== 'FALLBACK' && res.intent !== 'UNRECOGNIZED') {
      bestResult = res;
      // Use the clean matched phrase as the userQuery so trailing room noise doesn't clutter chat
      bestResult.userQuery = transcript;
      break; // Immediate high-confidence match!
    }
    if (!bestResult) {
      bestResult = res;
    }
  }

  const finalResult = bestResult || executeCommand(candidates[0] || initialCandidates[0] || '', false);

  if (finalResult.intent !== 'UNRECOGNIZED' && finalResult.assistantReply) {
    useAnnouncerStore.getState().announce(finalResult.assistantReply, 'assertive', true);
  }
  return finalResult;
}
