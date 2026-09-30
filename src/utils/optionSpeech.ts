import { verbalizeMath, verbalizeForSpeech } from './mathVerbalizer';
import { isHindiPreferred } from './voiceRecognition';
import type { QuestionItem } from '../../shared/types';

/**
 * The spoken confirmation that an option is now on the record.
 * Supports both Hindi and English based on the active language mode.
 */
export function describeOptionSelection(
  question: QuestionItem | undefined,
  optionNumber: number
): string {
  const isHindi = isHindiPreferred();
  const option = question?.options.find((o) => o.number === optionNumber);
  if (!option) {
    return isHindi ? `विकल्प ${optionNumber} चुन लिया गया है।` : `Option ${optionNumber} selected.`;
  }

  const mathVerbal = option.mathLatex ? verbalizeMath(option.mathLatex).trim() : '';
  const rawText = option.text ? option.text.trim() : '';
  let rawOptionSpeech = rawText;
  if (mathVerbal) {
    const normRaw = rawText.toLowerCase().replace(/\s+/g, ' ');
    const normMath = mathVerbal.toLowerCase().replace(/\s+/g, ' ');
    if (normRaw && (normRaw.includes(normMath) || normMath.includes(normRaw))) {
      rawOptionSpeech = rawText || mathVerbal;
    } else if (rawText) {
      rawOptionSpeech = `${rawText}, ${mathVerbal}`;
    } else {
      rawOptionSpeech = mathVerbal;
    }
  }
  const optionSpeech = verbalizeForSpeech(rawOptionSpeech);

  return isHindi
    ? `विकल्प ${optionNumber} चुन लिया गया है: ${optionSpeech}।`
    : `Option ${optionNumber} selected: ${optionSpeech}.`;
}

/**
 * The spoken confirmation that a choice is no longer on the record.
 * Supports both Hindi and English based on the active language mode.
 */
export function describeClearSelection(
  question: QuestionItem | undefined,
  hadSelection: boolean
): string {
  const isHindi = isHindiPreferred();
  if (!question) {
    return isHindi ? 'इस समय कोई प्रश्न लोड नहीं है।' : 'There is no question loaded right now.';
  }

  if (isHindi) {
    return hadSelection
      ? `प्रश्न ${question.questionNumber} से चुना हुआ विकल्प हटा दिया गया है। अब आप दूसरा विकल्प चुन सकते हैं।`
      : `प्रश्न ${question.questionNumber} में कोई विकल्प नहीं चुना गया था।`;
  }

  return hadSelection
    ? `Selection cleared for Question ${question.questionNumber}. You can now choose a different option.`
    : `No option was selected for Question ${question.questionNumber}.`;
}
