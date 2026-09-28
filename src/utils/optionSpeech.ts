import { verbalizeMath } from './mathVerbalizer';
import type { QuestionItem } from '../../shared/types';

/**
 * The spoken confirmation that an option is now on the record.
 *
 * It names the option *and* repeats the option's own words. "Option 3
 * selected" tells a candidate working without sight nothing about which answer
 * they just committed to, and the number alone is no better — hearing "270
 * degrees" read back is how a mis-speak gets caught before moving on.
 *
 * One sentence, built in one place, because a confirmation split across two
 * announcements is a confirmation that never gets heard: every announcement
 * interrupts the last, so the second one cuts the first off part-way through.
 */
export function describeOptionSelection(
  question: QuestionItem | undefined,
  optionNumber: number
): string {
  const option = question?.options.find((o) => o.number === optionNumber);
  if (!option) return `Option ${optionNumber} selected.`;

  const optionSpeech = option.mathLatex
    ? `${option.text}, ${verbalizeMath(option.mathLatex)}`
    : option.text;

  return `Option ${optionNumber} selected: ${optionSpeech}.`;
}

/**
 * The spoken confirmation that a choice is no longer on the record.
 *
 * `hadSelection` comes from the caller because this module deliberately knows
 * nothing about the store — the store imports it.
 */
export function describeClearSelection(
  question: QuestionItem | undefined,
  hadSelection: boolean
): string {
  if (!question) return 'There is no question loaded right now.';

  return hadSelection
    ? `Selection cleared for Question ${question.questionNumber}. You can now choose a different option.`
    : `No option was selected for Question ${question.questionNumber}.`;
}
