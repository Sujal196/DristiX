import type { AcousticPriority, AcousticStage } from '../events/AccessibilityEvents';

export type EarconType =
  | 'OPTION_SELECTED'
  | 'MARK_REVIEW'
  | 'CLEAR_RESPONSE'
  | 'ANSWER_CONFIRMED'
  | 'QUESTION_CHANGE'
  | 'SECTION_CHANGE'
  | 'SUCCESS'
  | 'ERROR'
  | 'WARNING'
  | 'FOCUS_CHANGE'
  | 'MIC_START'
  | 'MIC_STOP';

export interface SpeakOptions {
  type?: AcousticStage;
  text: string;
  priority?: AcousticPriority;
  interrupt?: boolean;
  rate?: number;
  pitch?: number;
  lang?: 'en-IN' | 'hi-IN' | 'en-US' | string;
}

export interface EarconPlayOptions {
  gainMultiplier?: number;
  priority?: AcousticPriority;
}
