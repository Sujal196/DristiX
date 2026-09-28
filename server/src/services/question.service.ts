import type {
  GradedQuestion,
  PublicQuestion,
} from '../../../shared/types.js';

/**
 * Structural input shape for a stored question.
 *
 * This is deliberately looser than the `PublicQuestion` we emit: Mongoose
 * returns unset optional strings as `null` rather than omitting them, and
 * subdocuments carry extra methods (`pop`, `id`, ...) that a plain interface
 * does not model. Keeping the input type permissive means the sanitiser
 * accepts a raw hydrated document without a cast, and it is the single place
 * where `null` is normalised away.
 */
export interface QuestionOptionLike {
  id: string;
  number: number;
  text: string;
  mathLatex?: string | null;
}

export interface QuestionLike {
  id: string;
  section: string;
  questionNumber: number;
  questionText: string;
  mathLatex?: string | null;
  diagramUrl?: string | null;
  diagramType?: 'image' | 'svg' | 'chart' | 'geometry' | null;
  diagramDescription?: string | null;
  diagramAiExplanation?: {
    visualBreakdown?: string[];
    educationalContext?: string;
    keyPoints?: string[];
    audioNarration?: string;
  } | null;
  options: QuestionOptionLike[];
  correctOption: number;
  explanation: string;
  hint: string;
}

export type QuestionDoc = QuestionLike;

/**
 * The single place where a question becomes something a browser may see.
 *
 * Every question-delivery path in this server MUST go through one of these two
 * functions. Sanitising by construction here — rather than remembering to delete
 * fields at each call site — is what makes "the answer key never leaves the
 * server" a property of the code rather than a promise in a comment.
 */

/**
 * Strips the answer key. Safe to call at any time during an attempt.
 *
 * `hint` is included ONLY in practice mode. In exam mode the student must not
 * see a hint, and hint text frequently reveals the answer.
 */
export function toPublicQuestion(
  question: QuestionLike,
  mode: 'exam' | 'practice'
): PublicQuestion {
  const base: PublicQuestion = {
    id: question.id,
    section: question.section,
    questionNumber: question.questionNumber,
    questionText: question.questionText,
    options: (question.options ?? []).map((o) => ({
      id: o.id,
      number: o.number,
      text: o.text,
      ...(o.mathLatex ? { mathLatex: o.mathLatex } : {}),
    })),
  };

  if (question.mathLatex) base.mathLatex = question.mathLatex;
  if (question.diagramUrl) base.diagramUrl = question.diagramUrl;
  if (question.diagramType) base.diagramType = question.diagramType as any;
  if (question.diagramDescription) base.diagramDescription = question.diagramDescription;
  if (question.diagramAiExplanation) {
    base.diagramAiExplanation = {
      visualBreakdown: question.diagramAiExplanation.visualBreakdown ?? [],
      educationalContext: question.diagramAiExplanation.educationalContext ?? '',
      keyPoints: question.diagramAiExplanation.keyPoints ?? [],
      audioNarration: question.diagramAiExplanation.audioNarration ?? '',
    };
  }

  if (mode === 'practice') base.hint = question.hint;

  // correctOption and explanation are intentionally never copied.
  return base;
}

export function toPublicQuestions(
  questions: QuestionLike[],
  mode: 'exam' | 'practice'
): PublicQuestion[] {
  return questions.map((q) => toPublicQuestion(q, mode));
}

/**
 * Includes the answer key. ONLY call this from the submit handler, after the
 * attempt is closed. This is what makes it legitimate for the student to see
 * which answers were right.
 */
export function toGradedQuestion(
  question: QuestionLike,
  selectedOption: number | null,
  mode: 'exam' | 'practice'
): GradedQuestion {
  return {
    ...toPublicQuestion(question, mode),
    selectedOption,
    correctOption: question.correctOption,
    isCorrect: selectedOption !== null && selectedOption === question.correctOption,
    explanation: question.explanation,
    unattempted: selectedOption === null,
  };
}
