import type { SectionDiagnostic, GradeResult } from '../../../shared/types.js';
import type { ExamDoc, AttemptDoc } from '../models/index.js';
import { toGradedQuestion, type QuestionLike } from './question.service.js';

/**
 * Normalises the Map-typed state fields into plain records. Mongoose stores
 * these as Maps but the rest of the code — and the JSON we send — works in
 * plain objects.
 */
export function readSelected(attempt: AttemptDoc): Record<string, number> {
  const map = attempt.state?.selectedOptions;
  if (!map) return {};
  return typeof map.get === 'function' ? Object.fromEntries(map) : { ...(map as object) };
}

export function readMarked(attempt: AttemptDoc): Record<string, boolean> {
  const map = attempt.state?.markedForReview;
  if (!map) return {};
  return typeof map.get === 'function' ? Object.fromEntries(map) : { ...(map as object) };
}

/**
 * Scores a closed attempt. This is the ONLY place scoring happens — the browser
 * never receives `correctOption` before this runs, so it cannot compute or forge
 * a score itself.
 */
export function gradeAttempt(
  attempt: AttemptDoc,
  exam: ExamDoc,
  questions: QuestionLike[]
): GradeResult {
  const selected = readSelected(attempt);
  const marked = readMarked(attempt);
  const negativePerWrong = exam.negativeMarking || 0;

  let attemptedCount = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let markedCount = 0;

  const sectionMap = new Map<string, { total: number; attempted: number; correct: number }>();

  const graded = questions.map((q) => {
    const userAnswer = selected[q.id] ?? null;
    const isCorrect = userAnswer !== null && userAnswer === q.correctOption;

    if (userAnswer !== null) {
      attemptedCount++;
      if (isCorrect) correctCount++;
      else incorrectCount++;
    }
    if (marked[q.id]) markedCount++;

    const bucket = sectionMap.get(q.section) ?? { total: 0, attempted: 0, correct: 0 };
    bucket.total++;
    if (userAnswer !== null) {
      bucket.attempted++;
      if (isCorrect) bucket.correct++;
    }
    sectionMap.set(q.section, bucket);

    return toGradedQuestion(q, userAnswer, attempt.mode as 'exam' | 'practice');
  });

  const totalQuestions = questions.length;
  const unattemptedCount = Math.max(0, totalQuestions - attemptedCount);
  const maxScore = totalQuestions;
  const totalScore = Number((correctCount - incorrectCount * negativePerWrong).toFixed(2));
  const scorePercentage =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const sectionDiagnostics: SectionDiagnostic[] = [...sectionMap.entries()].map(
    ([section, s]) => ({
      section,
      total: s.total,
      attempted: s.attempted,
      correct: s.correct,
      accuracy: s.attempted > 0 ? Math.round((s.correct / s.attempted) * 100) : 0,
    })
  );

  const weakAreas: string[] = [];
  const strongAreas: string[] = [];
  for (const s of sectionDiagnostics) {
    (s.attempted === 0 || s.accuracy < 60 ? weakAreas : strongAreas).push(
      `${s.section} (Accuracy: ${s.accuracy}%)`
    );
  }

  const verbalSummary: string[] = [
    `Overall Score: ${totalScore.toFixed(2)} out of ${maxScore} maximum points (${scorePercentage}% correct).`,
    `Attempted: ${attemptedCount} of ${totalQuestions} questions (${correctCount} correct, ${incorrectCount} incorrect).`,
    `Unattempted: ${unattemptedCount} questions.`,
    `Marked for review during exam: ${markedCount} questions.`,
    weakAreas.length > 0
      ? `Focus areas recommended for practice: ${weakAreas.join(', ')}.`
      : 'Excellent performance across all sections.',
  ];

  return {
    attemptId: String(attempt._id),
    examTitle: exam.title,
    status: attempt.status as GradeResult['status'],
    totalQuestions,
    attemptedCount,
    correctCount,
    incorrectCount,
    unattemptedCount,
    markedCount,
    scorePercentage,
    totalScore,
    maxScore,
    sectionDiagnostics,
    verbalSummary,
    weakAreas,
    strongAreas,
    questions: graded,
  };
}
