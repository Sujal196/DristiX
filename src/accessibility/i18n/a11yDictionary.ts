export type SupportedA11yLang = 'en-IN' | 'hi-IN' | 'en-US';

export interface A11ySemanticDictionary {
  OPTION_SELECTED: (num: number, text?: string) => string;
  ANSWER_CLEARED: (qNum?: number) => string;
  MARK_REVIEW: (qNum?: number) => string;
  UNMARK_REVIEW: (qNum?: number) => string;
  QUESTION_ANNOUNCEMENT: (qNum: number, total: number, section?: string) => string;
  SECTION_CHANGED: (newSection: string) => string;
  TIMER_WARNING: (timeStr: string) => string;
  TIMER_CRITICAL: (timeStr: string) => string;
  NAV_FIRST_QUESTION: string;
  NAV_LAST_QUESTION: string;
}

const DICTIONARY: Record<SupportedA11yLang, A11ySemanticDictionary> = {
  'en-IN': {
    OPTION_SELECTED: (num, text) => (text ? `Option ${num}: ${text}` : `Option ${num} selected`),
    ANSWER_CLEARED: (qNum) => (qNum ? `Selection cleared for Question ${qNum}.` : 'Selection cleared.'),
    MARK_REVIEW: (qNum) => (qNum ? `Question ${qNum} marked for review.` : 'Marked for review.'),
    UNMARK_REVIEW: (qNum) => (qNum ? `Question ${qNum} unmarked from review.` : 'Unmarked from review.'),
    QUESTION_ANNOUNCEMENT: (qNum, total, section) =>
      section ? `Question ${qNum} of ${total}. Section: ${section}.` : `Question ${qNum} of ${total}.`,
    SECTION_CHANGED: (newSection) => `Section changed to ${newSection}.`,
    TIMER_WARNING: (timeStr) => `Attention: ${timeStr} remaining.`,
    TIMER_CRITICAL: (timeStr) => `Urgent: ${timeStr} remaining in examination!`,
    NAV_FIRST_QUESTION: 'You are at the first question.',
    NAV_LAST_QUESTION: 'You are at the last question.',
  },
  'en-US': {
    OPTION_SELECTED: (num, text) => (text ? `Option ${num}: ${text}` : `Option ${num} selected`),
    ANSWER_CLEARED: (qNum) => (qNum ? `Selection cleared for Question ${qNum}.` : 'Selection cleared.'),
    MARK_REVIEW: (qNum) => (qNum ? `Question ${qNum} marked for review.` : 'Marked for review.'),
    UNMARK_REVIEW: (qNum) => (qNum ? `Question ${qNum} unmarked from review.` : 'Unmarked from review.'),
    QUESTION_ANNOUNCEMENT: (qNum, total, section) =>
      section ? `Question ${qNum} of ${total}. Section: ${section}.` : `Question ${qNum} of ${total}.`,
    SECTION_CHANGED: (newSection) => `Section changed to ${newSection}.`,
    TIMER_WARNING: (timeStr) => `Attention: ${timeStr} remaining.`,
    TIMER_CRITICAL: (timeStr) => `Urgent: ${timeStr} remaining in examination!`,
    NAV_FIRST_QUESTION: 'You are at the first question.',
    NAV_LAST_QUESTION: 'You are at the last question.',
  },
  'hi-IN': {
    OPTION_SELECTED: (num, text) => (text ? `विकल्प ${num}: ${text}` : `विकल्प ${num} चुना गया`),
    ANSWER_CLEARED: (qNum) => (qNum ? `प्रश्न ${qNum} का चयन हटा दिया गया।` : 'चयन हटा दिया गया।'),
    MARK_REVIEW: (qNum) => (qNum ? `प्रश्न ${qNum} समीक्षा के लिए चिह्नित किया गया।` : 'समीक्षा के लिए चिह्नित किया गया।'),
    UNMARK_REVIEW: (qNum) => (qNum ? `प्रश्न ${qNum} से समीक्षा चिह्न हटा दिया गया।` : 'समीक्षा चिह्न हटा दिया गया।'),
    QUESTION_ANNOUNCEMENT: (qNum, total, section) =>
      section ? `प्रश्न संख्या ${qNum}, कुल ${total} में से। अनुभाग: ${section}।` : `प्रश्न संख्या ${qNum}, कुल ${total} में से।`,
    SECTION_CHANGED: (newSection) => `नया अनुभाग: ${newSection}।`,
    TIMER_WARNING: (timeStr) => `ध्यान दें: परीक्षा में ${timeStr} शेष हैं।`,
    TIMER_CRITICAL: (timeStr) => `चेतावनी: केवल ${timeStr} शेष हैं!`,
    NAV_FIRST_QUESTION: 'आप पहले प्रश्न पर हैं।',
    NAV_LAST_QUESTION: 'आप अंतिम प्रश्न पर हैं।',
  },
};

export function getA11yDictionary(lang: SupportedA11yLang = 'en-IN'): A11ySemanticDictionary {
  return DICTIONARY[lang] || DICTIONARY['en-IN'];
}
