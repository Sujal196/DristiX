/**
 * Throwaway harness: unpacks the generated fixture and prints what the Word
 * importer recognised, so the parser can be verified without a browser.
 *
 *   server/node_modules/.bin/tsx scripts/test-docx-import.ts
 */
import { readFileSync } from 'node:fs';
import { extractQuestionsFromFile } from '../src/utils/docxImport';

const path = process.argv[2] ?? 'test-fixtures/sample-questions.docx';
const bytes = new Uint8Array(readFileSync(path));
const file = new File([bytes], path.split(/[\\/]/).pop() ?? 'doc.docx');

const result = await extractQuestionsFromFile(file);
console.log(JSON.stringify(result, null, 2));

const problems: string[] = [];
if (result.questions.length !== 3) problems.push(`expected 3 questions, got ${result.questions.length}`);
result.questions.forEach((q, i) => {
  if (!q.questionText) problems.push(`Q${i + 1}: empty question text`);
  if (q.options.length !== 4) problems.push(`Q${i + 1}: expected 4 options, got ${q.options.length}`);
  if (!q.correctOption) problems.push(`Q${i + 1}: no answer detected`);
});
if (path.includes('variant')) {
  const [q1, q2, q3] = result.questions;
  if (q1?.section !== 'GENERAL SCIENCE') problems.push(`Q1 section wrong: ${q1?.section}`);
  if (q1?.correctOption !== 1) problems.push('variant Q1 answer should be 1 (a)');
  if (q2?.options.join('|') !== 'Earth|Jupiter|Mars|Venus') {
    problems.push(`Q2 options wrong: ${JSON.stringify(q2?.options)}`);
  }
  if (q2?.correctOption !== 2) problems.push('variant Q2 answer should be 2');
  if (q3?.options.join('|') !== '3|4|5|6') {
    problems.push(`Q3 inline options wrong: ${JSON.stringify(q3?.options)}`);
  }
  if (q3?.correctOption !== 2) problems.push('variant Q3 answer should be 2 (b)');
  if (!q3?.explanation.startsWith('Trivial arithmetic')) {
    problems.push(`Q3 explanation wrong: ${q3?.explanation}`);
  }
  if (result.questions.length !== 3) problems.push(`variant expected 3 questions, got ${result.questions.length}`);
  if (result.hasAllAnswers !== true) problems.push('variant hasAllAnswers should be true');
} else {
  // The .docx fixture: heading styles, an answer key block, "Q2)" numbering
  // and digit-style options under a "3)" question.
  if (result.questions[0]?.correctOption !== 2) problems.push('Q1 answer should be option 2 (b)');
  if (result.questions[2]?.correctOption !== 1) problems.push('Q3 answer should be option 1 (from key)');
  if (!result.hasAllAnswers) problems.push('hasAllAnswers should be true');
  if (result.questions.length !== 3 || result.questions.some((q) => !q.questionText || q.options.length !== 4)) {
    problems.push('docx fixture did not parse into 3 complete questions');
  }
  if (result.sections.join('|') !== 'Quantitative Aptitude|Measurement') {
    problems.push(`sections wrong: ${JSON.stringify(result.sections)}`);
  }
}

console.log(problems.length ? `\nFAIL:\n- ${problems.join('\n- ')}` : '\nPASS');
process.exit(problems.length ? 1 : 0);
