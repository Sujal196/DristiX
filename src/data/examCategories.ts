/**
 * Exam categories, kept in their own module on purpose.
 *
 * They used to live in `data/exams.ts` next to `EXAMS_CATALOG`. Because
 * `exams.ts` imports the question bank, a single value import of
 * `EXAM_CATEGORIES` from a component pulled the entire catalog — including every
 * answer key — into the production bundle. Extracting the constant means the
 * category list costs nothing and the catalog can be dropped from an api-mode
 * build.
 *
 * Nothing in this file may import from `exams.ts`, `questions.ts` or
 * `practiceDrills.ts`.
 */
export const EXAM_CATEGORIES = [
  'All',
  'Staff Selection',
  'Banking & Insurance',
  'Civil Services',
  'Railways',
] as const;

export type ExamCategory = (typeof EXAM_CATEGORIES)[number];
