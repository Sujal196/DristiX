export type AccessibilityEventType =
  | 'OPTION_SELECTED'
  | 'OPTION_DESELECTED'
  | 'ANSWER_CONFIRMED'
  | 'ANSWER_CLEARED'
  | 'MARK_FOR_REVIEW'
  | 'UNMARK_REVIEW'
  | 'QUESTION_CHANGED'
  | 'SECTION_CHANGED'
  | 'TIMER_WARNING'
  | 'TIMER_CRITICAL'
  | 'NAVIGATION_ERROR'
  | 'ACTION_SUCCESS'
  | 'ACTION_ERROR'
  | 'FOCUS_CHANGED';

export type AcousticPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type AcousticStage =
  | 'QUESTION'
  | 'OPTION'
  | 'SYSTEM'
  | 'WARNING'
  | 'SUCCESS'
  | 'ERROR'
  | 'NAVIGATION';

export interface AccessibilityEventPayloadMap {
  OPTION_SELECTED: {
    questionId: string;
    questionNumber?: number;
    optionNumber: number;
    optionText?: string;
    silentSpeech?: boolean;
  };
  OPTION_DESELECTED: {
    questionId: string;
    questionNumber?: number;
    optionNumber: number;
  };
  ANSWER_CONFIRMED: {
    questionId: string;
    questionNumber?: number;
    optionNumber: number;
  };
  ANSWER_CLEARED: {
    questionId: string;
    questionNumber?: number;
  };
  MARK_FOR_REVIEW: {
    questionId: string;
    questionNumber?: number;
    isMarked: boolean;
  };
  UNMARK_REVIEW: {
    questionId: string;
    questionNumber?: number;
  };
  QUESTION_CHANGED: {
    questionIndex: number;
    questionNumber: number;
    totalQuestions: number;
    questionText: string;
    sectionName?: string;
    previousQuestionIndex?: number;
    autoRead?: boolean;
  };
  SECTION_CHANGED: {
    previousSection?: string;
    newSection: string;
  };
  TIMER_WARNING: {
    remainingSeconds: number;
    formattedTime: string;
    message?: string;
  };
  TIMER_CRITICAL: {
    remainingSeconds: number;
    formattedTime: string;
    message?: string;
  };
  NAVIGATION_ERROR: {
    reason: string;
    message?: string;
  };
  ACTION_SUCCESS: {
    message: string;
  };
  ACTION_ERROR: {
    message: string;
  };
  FOCUS_CHANGED: {
    targetElement?: string;
    label?: string;
    role?: string;
  };
}

export interface AccessibilityEvent<T extends AccessibilityEventType = AccessibilityEventType> {
  type: T;
  payload: AccessibilityEventPayloadMap[T];
  timestamp: number;
  priority?: AcousticPriority;
}
