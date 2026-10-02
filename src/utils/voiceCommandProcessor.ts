import { getAssistantContext } from './assistantContext';
import { useExamStore } from '../store/useExamStore';
import { useAnnouncerStore } from '../store/useAnnouncerStore';
import { soundEffects } from './soundEffects';
import { verbalizeMath, verbalizeForSpeech } from './mathVerbalizer';
import { describeOptionSelection, describeClearSelection } from './optionSpeech';
import { matchExamFromQuery } from './examMatcher';
import { isPracticeTabNavigation } from './practiceTabNavigation';
import { SonificationEngine } from '../accessibility/sonification/SonificationEngine';
import { speechEngine } from './speechEngine';

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
  'the',
  'a',
  'an',
  'um',
  'uh',
  'ah',
  'hmm',
  'oh',
  'haan',
  'हूँ',
  'हाँ',
  'हूं',
  'ok',
  'okay',
  'huh',
  'shh',
  'thank you',
  'thanks',
  'dhanyawad',
  'dhanyavaad',
  'धन्यवाद',
  'namaste',
  'नमस्ते',
  'alvida',
  'अलविदा',
  'bye',
  'goodbye',
  'bye bye',
]);

/**
 * Detects whether an incoming user transcript is an intentional exam or navigation command.
 * Intentional commands must never be filtered out as phantom noise, acoustic echo, or ambient speech.
 */
export function isIntentionalVoiceCommand(text: string): boolean {
  if (!text) return false;
  const raw = text.trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  const norm = lower.replace(/[^\w\s\u0900-\u097F]/gi, '').trim();

  // If submit confirmation modal is currently open, confirm/resume responses are active
  const examStoreState = useExamStore.getState();
  if (examStoreState.isSubmitModalOpen) {
    if (
      /^(?:yes[, ]+final\s+submit|yes\s+final\s+submit|final\s+submit|yes\s+submit|confirm\s+submit|submit\s+final|yes|haan|ha|confirm|submit|submit\s+exam|submit\s+test|finish|finish\s+exam|jama\s*karo|enter)$/i.test(lower) ||
      /^(?:continue\s+to\s+exam|continue\s+the\s+exam|continue\s+exam|continue\s+test|continue|resume\s+exam|resume\s+the\s+exam|resume\s+test|resume|return\s+to\s+exam|back\s+to\s+exam|go\s+back\s+to\s+exam|cancel\s+submit|cancel\s+submission|cancel|no|nahi|nahin|wapas|ruk|ruko|stop|mat\s*karo|escape|esc)$/i.test(lower)
    ) {
      return true;
    }
  }

  // Submit modal explicit commands (active anywhere in exam)
  if (
    /^(?:yes[, ]+final\s+submit|yes\s+final\s+submit|final\s+submit|yes\s+submit|confirm\s+submit|submit\s+final|confirm\s+submission|final\s+submission|yes\s+submit\s+exam|yes\s+submit\s+the\s+exam|yes\s+final)$/i.test(lower) ||
    /^(?:continue\s+to\s+exam|continue\s+the\s+exam|continue\s+exam|continue\s+test|continue|resume\s+exam|resume\s+the\s+exam|resume\s+test|resume|return\s+to\s+exam|back\s+to\s+exam|cancel\s+submit|cancel\s+submission|cancel)$/i.test(lower)
  ) {
    return true;
  }

  // Diagnostic and Analytics Report commands when exam is submitted
  if (examStoreState.isSubmitted) {
    if (
      /^(?:summary|read\s+summary|score|result|analytics|report|read\s+report|performance|explain\s+result|explain\s+report|explain\s+analytics|result\s+batao|analytics\s+batao|retake|retake\s+exam|retake\s+test|dobara|again)$/i.test(norm) ||
      norm.includes('result') ||
      norm.includes('analytics') ||
      norm.includes('summary') ||
      norm.includes('score')
    ) {
      return true;
    }
  }

  // General exam and navigation commands
  if (
    /^(?:next|next\s+question|agla\s+sawal|aage|previous|prev|previous\s+question|pichhla\s+sawal|read\s+question|repeat\s+question|sawal\s+padho|clear\s+option|unselect|check\s+timer|time\s+remaining|time\s+left|samay\s+batao|kitna\s+time|submit\s+exam|finish\s+exam|stop|ruko|pause|chup)$/i.test(norm) ||
    /^(?:option|select\s+option|vikalp|choice)\s+[1-4a-d]$/i.test(norm)
  ) {
    return true;
  }

  return false;
}

/**
 * Checks whether an incoming transcript is a phantom noise hallucination or meaningless ambient sound.
 */
export function isPhantomNoise(text: string): boolean {
  if (!text) return true;
  const raw = text.trim();
  if (!raw) return true;

  // Never filter intentional commands as phantom noise!
  if (isIntentionalVoiceCommand(raw)) return false;

  // Single punctuation/symbol characters or whitespace
  if (/^[\s.,!?;:_\-*#~♪♫()[\]]+$/.test(raw)) return true;

  // Audio/subtitle bracket tags: [music], (applause), etc.
  if (/^[[(<*].*[\])>*]$/.test(raw)) return true;

  const cleaned = raw
    .toLowerCase()
    .replace(/^[.,?!:;\s]+|[.,?!:;\s]+$/g, '')
    .trim();

  if (!cleaned) return true;
  if (cleaned.length <= 1) return true;
  if (PHANTOM_NOISE_TOKENS.has(cleaned)) return true;

  // Common Whisper video outro / channel / subscription hallucination patterns
  if (
    /^(thank you|thanks)(\s+(for watching|so much|very much|a lot|everyone))?[.!]?$/i.test(cleaned) ||
    /^(please\s+)?(subscribe|like and subscribe)(\s+to\s+(my|the|this)?\s*channel)?[.!]?$/i.test(cleaned) ||
    /^(see you(\s+(next time|in the next video|soon|later))?|goodbye|bye(\s+bye)?)[.!]?$/i.test(cleaned) ||
    /^(subtitles?(\s+by)?|transcribed by|captioned by|translated by|amara\.org|dotsub|opensubtitles)[.!]?$/i.test(cleaned) ||
    /^(देखने के लिए धन्यवाद|सब्सक्राइब करें|लाइक करें|शुभ रात्रि)[.!]?$/i.test(cleaned)
  ) {
    return true;
  }

  // Repeating single/pair word hallucination loops (e.g. "you you you", "thank you thank you")
  const words = cleaned.split(/\s+/);
  if (words.length >= 3) {
    const allSame = words.every((w) => w === words[0]);
    if (allSame) return true;
    if (words.length >= 4 && words.length % 2 === 0) {
      const pair = `${words[0]} ${words[1]}`;
      const isRepeatedPair = words.every((w, i) => w === words[i % 2]);
      if (isRepeatedPair && pair.length <= 12) return true;
    }
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
  const formulaText = q.equationLatex
    ? ` Equation: ${verbalizeMath(q.equationLatex)}.`
    : '';
  const diagramText = q.diagramAiExplanation?.audioNarration
    ? ` Visual Diagram Breakdown: ${q.diagramAiExplanation.audioNarration}.`
    : q.diagramDescription
    ? ` Visual Diagram: ${q.diagramDescription}.`
    : q.diagramUrl
    ? ` This question includes an attached visual diagram. Say "Explain diagram" to hear the full visual breakdown.`
    : '';
  const graphText =
    q.graph && q.graph.enabled
      ? ` Graph details: ${SonificationEngine.generateSummary(q.graph)}.`
      : '';
  const optionsText =
    q.options && q.options.length > 0
      ? ` The options are: ${q.options.map((o) => `Option ${o.number}: ${verbalizeForSpeech(o.text)}`).join('. ')}.`
      : '';
  const statusText = q.selectedOption
    ? ` Currently selected: Option ${q.selectedOption}.`
    : ' No option has been selected yet.';

  const leading = prefix ? `${prefix} ` : '';
  return `${leading}Question ${q.number}: ${verbalizeForSpeech(q.text)}.${formulaText}${diagramText}${graphText}${optionsText}${statusText}`;
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
  text = text.replace(/(पढ़ो|पढ़कर सुनाओ|सुनाओ|बोलो|रीड|बताओ|दिखाओ|दिखाइए|शो|read|bolo|sunao|sunaao|padho|show)/gi, 'read');

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
  // Only convert explain/solution to 'solution' when not referencing a diagram/chart/visual asset
  if (!/(?:diagram|chart|graph|figure|visual|image|चित्र|आरेख|ग्राफ)\b/i.test(text)) {
    text = text.replace(/(सॉल्यूशन|हल|एक्सप्लेनेशन|समझाइए|समझाओ|solution|explanation|explain)/gi, 'solution');
  } else {
    text = text.replace(/(सॉल्यूशन|हल)/gi, 'solution');
  }

  // 10. Exam lists / inquiries
  text = text.replace(/(मॉक\s*टेस्ट्स?|मॉकटेस्ट|mock\s*tests?|mocktest)/gi, 'mocktest');
  text = text.replace(
    /(कितने|कितना|कौन कौन से|कौन-कौन से|कौन-कौन|कौन सा|कौन से|कौन-सा|कौन-सी|कौन सी|क्या क्या|क्या-क्या|उपलब्ध|kaun kaun se|kon kon se|kaun kaun|kon kon|koun koun|kaun se|kon se|koun se|konsa|kousa|kaun sa|kaun si|kon si|kya kya|kitne|kitna|list|lists|available|avalable|uplabdh|show\s*all|which|what)/gi,
    'list'
  );
  text = text.replace(/(एग्जाम्स?|परीक्षाएं|परीक्षा|टेस्ट्स?|exams?|tests?|pariksha)/gi, 'exam');

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
  // DIAGRAM & VISUAL CHART ACCESSIBILITY:
  // Strictly permitted during live exams / mock tests for visually impaired candidates
  // ==========================================
  const combinedText = `${rawLower} ${normalized}`;
  const isDiagramQuery =
    /(?:diagram|chart|graph|figure|visual|image|chitra|aarekh|चित्र|आरेख|ग्राफ|voice\s*guide|visual\s*guide)\b/i.test(combinedText) &&
    (/(?:explain|describe|read|bolo|sunao|what|tell|batao|samjhao|dekho|khol|open|show|dikhao|detail|breakdown|guide|voice|audio)\b/i.test(combinedText) ||
      /^(?:explain\s+diagram|describe\s+diagram|read\s+diagram|diagram\s+explain|diagram\s+samjhao|chart\s+samjhao|diagram|chart|figure|voice\s*guide|visual\s*guide|diagram\s*breakdown)$/i.test(rawLower));

  if (isDiagramQuery && context.activeView === 'exam') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dristix:open-diagram-explainer'));
    }
    const q = context.currentQuestion;
    const qNum = q?.questionNumber ?? q?.number ?? 1;
    void examStore.explainCurrentDiagram(true);
    const reply = q?.diagramAiExplanation?.audioNarration
      ? q.diagramAiExplanation.audioNarration
      : `Opening AI Diagram Explainer and Voice Guide for Question ${qNum}.`;
    return {
      success: true,
      intent: 'EXPLAIN_DIAGRAM',
      userQuery: rawTranscript,
      assistantReply: reply,
      actionExecuted: 'Explained Visual Diagram',
    };
  }

  // ==========================================
  // EXAM INTEGRITY GUARD:
  // Strictly prevent solving questions or revealing answers during live exam
  // ==========================================
  if (context.activeView === 'exam' && !isDiagramQuery) {
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
  // EXAM SUBMIT CONFIRMATION & RESUME MODAL ACCESSIBILITY:
  // "Continue to Exam" (resumes test) & "Yes, Final Submit" (submits test)
  // Accessible via voice during the confirmation modal and throughout the exam
  // ==========================================
  const isContinueToExam =
    /^(?:continue\s+to\s+exam|continue\s+the\s+exam|continue\s+exam|continue\s+test|continue|resume\s+exam|resume\s+the\s+exam|resume\s+test|resume|return\s+to\s+exam|back\s+to\s+exam|go\s+back\s+to\s+exam|cancel\s+submit|cancel\s+submission|cancel|don'?t\s+submit|do\s+not\s+submit|no\s+submit|close\s+submit|close\s+modal|keep\s+testing|keep\s+writing)$/i.test(rawLower) ||
    /^(?:continue\s+to\s+exam|continue\s+exam|continue|resume\s+exam|resume|cancel\s+submit|cancel|back\s+to\s+exam|return\s+to\s+exam)$/i.test(normalized) ||
    /(?:continue\s+to\s+exam|resume\s+exam|return\s+to\s+exam|cancel\s+submit|cancel\s+submission|continue\s+the\s+exam|resume\s+the\s+exam)/i.test(rawLower) ||
    /(?:continue\s+to\s+exam|resume\s+exam|cancel\s+submit)/i.test(normalized) ||
    (examStore.isSubmitModalOpen && (
      /^(?:no|nahi|nahin|cancel|wapas|back|close|exit|ruk|ruko|stop|mat\s*karo|continue|resume|escape)$/i.test(rawLower) ||
      /^(?:no|nahi|nahin|cancel|back|continue|resume)$/i.test(normalized) ||
      /(?:continue|resume|wapas\s+exam|exam\s+jari|pariksha\s+jari|abhi\s+nahi)/i.test(rawLower)
    ));

  const isFinalSubmit =
    /^(?:yes[, ]+final\s+submit|yes\s+final\s+submit|final\s+submit|yes\s+submit|confirm\s+submit|submit\s+final|confirm\s+submission|final\s+submission|yes\s+submit\s+exam|yes\s+submit\s+the\s+exam|yes\s+final)$/i.test(rawLower) ||
    /(?:yes[, ]+final\s+submit|yes\s+final\s+submit|final\s+submit|confirm\s+submit|submit\s+final|confirm\s+submission|final\s+submission)/i.test(rawLower) ||
    /(?:yes[, ]+final\s+submit|final\s+submit|confirm\s+submit)/i.test(normalized) ||
    (examStore.isSubmitModalOpen && (
      /^(?:yes|haan|ha|confirm|submit|submit\s+exam|submit\s+test|finish|finish\s+exam|jama\s*karo|haan\s*submit|submit\s*karo|enter)$/i.test(rawLower) ||
      /^(?:yes|haan|ha|confirm|submit)$/i.test(normalized) ||
      /(?:final\s*submit|yes.*submit|submit.*final|confirm.*submit|jama\s*kar)/i.test(rawLower)
    ));

  if (isContinueToExam) {
    if (context.activeView === 'exam') {
      speechEngine.stop();
      const wasModalOpen = examStore.isSubmitModalOpen;
      examStore.setSubmitModalOpen(false);
      soundEffects.playSelect();
      const q = context.currentQuestion;
      const qNum = q?.number || (examStore.currentIndex + 1);
      const reply = wasModalOpen
        ? `Submission cancelled. Resuming exam at Question ${qNum}. You can say "Read question", "Next question", or select an option.`
        : `You are continuing your active exam on Question ${qNum}. Say "Read question" to hear the question.`;
      return makeReply('RESUME_EXAM', reply, 'Resumed Exam (Cancelled Submission)');
    }
  }

  if (isFinalSubmit) {
    if (context.activeView === 'exam' && !examStore.isSubmitted) {
      speechEngine.stop();
      examStore.setSubmitModalOpen(false);
      soundEffects.playSuccess();
      void examStore.submitExam();
      const reply = 'Final submission confirmed. Submitting your examination now...';
      return makeReply('FINAL_SUBMIT', reply, 'Final Submitted Exam');
    }
  }

  // ==========================================
  // 1. QUERY AVAILABLE EXAMS & TESTS
  // ==========================================
  const isExamListQuery =
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
    ((rawLower.includes('page') || rawLower.includes('yahan') || rawLower.includes('yaha')) &&
      (rawLower.includes('test') || rawLower.includes('exam') || rawLower.includes('mock')));

  if (isExamListQuery) {
    if (context.portalTab === 'practice' && !rawLower.includes('mock')) {
      const drills = context.availableDrills;
      const names = drills.map((d, idx) => `${idx + 1}. ${d.title}`).join('; ');
      const reply = `On this practice page, there are ${drills.length} Practice Drills available: ${names}. Say "Start Practice Drill" to begin.`;
      return makeReply('LIST_PRACTICE_DRILLS', reply, 'List Available Practice Drills');
    }

    const exams = context.availableExams;
    const names = exams
      .map((e, idx) => `${idx + 1}. ${e.title} (${e.durationMinutes} mins, ${e.questionCount} questions)`)
      .join('; ');
    const reply = `On this page, there are ${exams.length} Mock Examinations available: ${names}. Say "Start SSC CGL" or "Start Exam 1" to begin.`;
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
  // 2b. GO TO THE PRACTICE TAB (navigation only — must run BEFORE Start Exam)
  //
  // matchExamFromQuery() reads the bare word "practice" as an alias for the
  // first Practice Drill, so without this guard "go on the practice tab" used
  // to launch that drill as a live test instead of switching tabs. The
  // candidate is first taken to the Practice Arena and told which drills are
  // listed; only a later "Start <drill name>" opens one.
  // ==========================================
  if (isPracticeTabNavigation(rawTranscript)) {
    // STRICT INTEGRITY: Cannot leave active unsubmitted exam
    if (context.activeView === 'exam' && !examStore.isSubmitted) {
      examStore.setSubmitModalOpen(true);
      soundEffects.playTimerAlert();
      const reply = 'You cannot leave the exam before submitting it. The submit confirmation window is now open. Please submit your test first.';
      return makeReply('CONFIRM_SUBMIT', reply, 'Opened Submit Modal (Exit Prevented)');
    }

    examStore.returnToCatalog();
    examStore.setPortalTab('practice');

    const drills = context.availableDrills;
    const names = drills.map((d, idx) => `${idx + 1}. ${d.title}`).join('; ');
    const reply = drills.length
      ? `Switched to the Practice Arena tab. ${drills.length} practice drills are now listed on your screen: ${names}. Say "Start" followed by a drill name to open one.`
      : 'Switched to the Practice Arena tab. No practice drills are available right now. Say "Go to mock test page" to see the mock examinations.';
    return makeReply('PRACTICE_TAB', reply, 'Opened Practice Tab (No Drill Started)');
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
    !isContinueToExam &&
    !rawLower.includes('continue to exam') &&
    !rawLower.includes('return to exam') &&
    !rawLower.includes('back to exam') &&
    (
      (normalized.includes('back') && !rawLower.includes('back to exam') && !rawLower.includes('back to test')) ||
      (normalized.includes('return') && !rawLower.includes('return to exam') && !rawLower.includes('return to test')) ||
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

    // The confirmation reply below is spoken for this action, so the store's
    // own "Starting…" line is suppressed — otherwise it interrupts the reply.
    void examStore.selectExam(matchedExam.id, matchedExam.id.includes('practice') ? 'practice' : 'exam', {
      announce: false,
    });
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
    rawLower.includes('dobara bolo') ||
    rawLower.includes('options padho') ||
    rawLower.includes('read option') ||
    rawLower.includes('option padho')
  ) {
    if (context.activeView !== 'exam' || !context.currentQuestion) {
      const reply = 'You are not currently in an exam. Say "Start exam" to begin a test.';
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
      const reply = 'Please start an exam first before selecting an option. Say "Start exam" to begin.';
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
    const { questions, currentIndex, selectedOptions } = useExamStore.getState();
    const total = questions.length;
    const answeredCount = Object.keys(selectedOptions).length;
    const isLastQuestion = currentIndex >= total - 1;
    const allAnswered = answeredCount >= total;

    const selection = describeOptionSelection(questions[currentIndex], optNum);
    let guidance = ' Say "Next question" to continue or "Read question" to review.';
    if (allAnswered) {
      guidance = ` All ${total} questions have been answered. Say "Submit exam" to finish and submit your test, or "Read question" to review.`;
    } else if (isLastQuestion) {
      guidance = ` This is the last question (${total} of ${total}). Say "Submit exam" to finish and submit your test, or "Previous question" or "Read question" to review.`;
    }

    const reply = `${selection}${guidance}`;
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
      const { questions, currentIndex, selectedOptions } = useExamStore.getState();
      const total = questions.length;
      const isAtLast = currentIndex >= total - 1;
      const answeredCount = Object.keys(selectedOptions).length;

      if (isAtLast) {
        soundEffects.playTimerAlert();
        const reply = answeredCount >= total
          ? `You have reached the end of the test. All ${total} questions have been answered. Say "Submit exam" to finish and submit your test, or "Previous question" to review.`
          : `You are on the last question (${total} of ${total}). ${total - answeredCount} questions remain unattempted. Say "Submit exam" to submit your test, or "Previous question" to review.`;
        return makeReply('NEXT_QUESTION', reply, 'At Last Question - Ready to Submit');
      }

      examStore.nextQuestion();
      const nextCtx = getAssistantContext();
      const q = nextCtx.currentQuestion;
      if (!q) {
        const reply = 'You have reached the end of the test. Say "Submit exam" when you are ready to finish.';
        return makeReply('NEXT_QUESTION', reply, 'At Last Question');
      }
      const reply = buildFullQuestionSpeech(q);
      return makeReply('NEXT_QUESTION', reply, `Navigated to Question ${q.number}`);
    }
  }

  if (normalized.includes('previous')) {
    if (context.activeView === 'exam') {
      examStore.previousQuestion();
      const prevCtx = getAssistantContext();
      const q = prevCtx.currentQuestion;
      if (!q) {
        const reply = 'You are already on the first question.';
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
    normalized.match(/(?:question|sawal|prashna)\s*(?:number)?\s*(\d+)/i) ||
    rawTranscript.match(/(?:क्वेश्चन|सवाल|प्रश्न)\s*(?:नंबर)?\s*(\d+)/i);
  if (
    jumpMatch &&
    !normalized.includes('read') &&
    !normalized.includes('option') &&
    !normalized.includes('next') &&
    !normalized.includes('previous')
  ) {
    const targetNum = parseInt(jumpMatch[1], 10);
    if (context.activeView === 'exam' && targetNum >= 1 && targetNum <= examStore.questions.length) {
      examStore.jumpToQuestion(targetNum - 1);
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
  // 10.5 EXAM TIMER & REMAINING TIME
  // ==========================================
  if (
    normalized.includes('timer') ||
    normalized.includes('time') ||
    rawLower.includes('samay') ||
    rawLower.includes('kitna time') ||
    rawLower.includes('kitna samay') ||
    rawLower.includes('time remaining') ||
    rawLower.includes('time left') ||
    rawLower.includes('time batao') ||
    rawLower.includes('samay batao')
  ) {
    if (context.activeView === 'exam' && !examStore.isSubmitted) {
      soundEffects.playSelect();
      const minutes = Math.floor(examStore.timeRemaining / 60);
      const seconds = examStore.timeRemaining % 60;
      const reply = `Time remaining: ${minutes} minutes and ${seconds} seconds. Timer display: ${examStore.formattedTime}.`;
      return makeReply('CHECK_TIMER', reply, 'Announced Remaining Time');
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
    rawLower.includes('data batao')
  ) {
    if (context.activeView === 'exam' && context.currentQuestion) {
      const q = context.currentQuestion;
      if (q.graph && q.graph.enabled && q.graph.data?.length) {
        soundEffects.playSelect();
        const g = q.graph;
        const unit = g.unit ? ` ${g.unit}` : '';
        const dataList = g.data.map((d) => `${d.label}: ${d.value}${unit}`).join(', ');
        const stats = SonificationEngine.computeStats(g.data);
        const reply = `Data Chart: "${g.title || 'Chart'}". It contains ${g.data.length} data points: ${dataList}. Highest value is ${stats.maxPoint?.value ?? ''}${unit} in ${stats.maxPoint?.label ?? ''}. Lowest value is ${stats.minPoint?.value ?? ''}${unit} in ${stats.minPoint?.label ?? ''}. Now playing the auditory pitch sweep.`;

        // Wait until voice finishes speaking, then play the pitch sweep cleanly
        const unsubscribe = speechEngine.onSpeechEnd(() => {
          unsubscribe();
          if (q.graph) {
            SonificationEngine.playOverviewSweep(q.graph, 0.45);
          }
        });

        return makeReply('PLAY_GRAPH', reply, 'Played Graph Sonification');
      } else {
        const reply = `Question ${q.number} does not contain a data graph.`;
        return makeReply('NO_GRAPH', reply);
      }
    }
  }

  // ==========================================
  // 13. REPORT SCREEN SPECIFIC ACTIONS (Summary, Retake, Explain Result)
  // ==========================================
  if (context.activeView === 'report' || examStore.isSubmitted) {
    if (
      rawLower.includes('summary') ||
      rawLower.includes('समरी') ||
      rawLower.includes('score') ||
      rawLower.includes('स्कोर') ||
      rawLower.includes('result') ||
      rawLower.includes('रिजल्ट') ||
      rawLower.includes('analytics') ||
      rawLower.includes('एनालिटिक्स') ||
      rawLower.includes('report') ||
      rawLower.includes('रिपोर्ट') ||
      rawLower.includes('performance') ||
      rawLower.includes('parinam') ||
      rawLower.includes('marks') ||
      rawLower.includes('kitne sahi') ||
      rawLower.includes('kitne number') ||
      rawLower.includes('kitna score') ||
      rawLower.includes('explain result') ||
      rawLower.includes('explain report') ||
      rawLower.includes('explain analytics') ||
      rawLower.includes('kaisa raha') ||
      rawLower.includes('result batao') ||
      rawLower.includes('score batao') ||
      rawLower.includes('analytics batao')
    ) {
      soundEffects.playSelect();
      const rep = context.diagnosticReport || examStore.getDiagnosticReport();
      const summaryText =
        rep?.verbalSummary?.join(' ') ||
        `Overall Score: ${rep?.totalScore || 0} out of ${rep?.maxScore || 0} points (${rep?.scorePercentage || 0}%). Attempted: ${rep?.attemptedCount || 0} questions (${rep?.correctCount || 0} correct, ${rep?.incorrectCount || 0} incorrect). Unattempted: ${rep?.unattemptedCount || 0}.`;
      const reply = `Performance Diagnostic and Analytics Report for "${rep?.examTitle || 'Exam'}": You scored ${rep?.totalScore || 0} out of ${rep?.maxScore || 0} points, which is ${rep?.scorePercentage || 0} percent. ${summaryText} You can say "Retake test" or "Choose another exam".`;
      return makeReply('READ_REPORT_SUMMARY', reply, 'Explained Diagnostic & Analytics Report');
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
  // 15. SUBMIT EXAM (OPEN CONFIRMATION WINDOW)
  // ==========================================
  if (
    normalized.includes('submit') ||
    rawLower.includes('jama') ||
    rawLower.includes('finish exam') ||
    rawLower.includes('end exam')
  ) {
    if (context.activeView === 'exam' && !examStore.isSubmitted) {
      examStore.setSubmitModalOpen(true);
      soundEffects.playTimerAlert();
      const total = examStore.questions.length;
      const answered = Object.keys(examStore.selectedOptions).length;
      const reply = `Confirm exam submission window is open. You have answered ${answered} of ${total} questions. Say "Yes, Final Submit" or press Enter to submit, or say "Continue to Exam" or press Escape to resume your test.`;
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

  // If the query was detected as a phantom noise or hallucination, NEVER blurt out a fallback or speak!
  if (isPhantomNoise(rawTranscript)) {
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

  // Only announce if a real valid command succeeded!
  // 'FALLBACK' or 'UNRECOGNIZED' should NEVER be blurted out by the local runner,
  // allowing the conversational LLM or the explicit fallback to handle it.
  if (
    finalResult.success &&
    finalResult.intent !== 'FALLBACK' &&
    finalResult.intent !== 'UNRECOGNIZED' &&
    finalResult.assistantReply
  ) {
    useAnnouncerStore.getState().announce(finalResult.assistantReply, 'assertive', true);
  }
  return finalResult;
}
