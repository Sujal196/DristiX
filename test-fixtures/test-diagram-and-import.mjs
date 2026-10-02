import { extractAndStripImageUrls } from './test-strip-image-urls.mjs';

// Test 1: Check pure answer line detection logic
const answerLines = ['1. B', '2. (c)', '3. Ans: A', '4. D'];
const answerRe = /^\(?\s*[a-hA-H1-4]\s*\)?$/i;
const ansPrefixRe = /^(?:ans|answer|key)\s*[.:\-–]?\s*\(?\s*([a-hA-H1-4])\s*\)?$/i;

for (const line of answerLines) {
  const rawBody = line.replace(/^\d{1,3}\s*[).:\-–]\s*/, '').trim();
  const isAns = answerRe.test(rawBody) || ansPrefixRe.test(rawBody);
  console.log(`Line: "${line}" => rawBody: "${rawBody}" => isAnswer: ${isAns}`);
}

// Test 2: Check solution line detection logic
const solLines = ['1. Solution: By Pythagoras theorem...', '2. Explanation: Total expenditure is...'];
const isSol = /^(?:solution|explanation|explanations|sol|soln|हल|उत्तर)\b/i;
for (const line of solLines) {
  const rawBody = line.replace(/^\d{1,3}\s*[).:\-–]\s*/, '').trim();
  console.log(`Line: "${line}" => rawBody: "${rawBody}" => isSolution: ${isSol.test(rawBody)}`);
}

// Test 3: Check diagram voice query detection logic
const diagramQueries = [
  'Explain diagram',
  'Describe the chart',
  'Explain this diagram',
  'diagram explain karo',
  'what is in the diagram',
  'chart samjhao',
  'Solve this question',
  'What is the answer'
];

const isDiagramRegex =
  /(?:diagram|chart|graph|figure|visual|image|चित्र|आरेख|ग्राफ)\b/i;
const isDiagramActionRegex =
  /(?:explain|describe|read|what|tell|batao|samjhao|dekho|khol|open|show|dikhao|detail|breakdown|guide)\b/i;

for (const q of diagramQueries) {
  const isDiag = isDiagramRegex.test(q) && isDiagramActionRegex.test(q);
  console.log(`Query: "${q}" => isDiagramQuery: ${isDiag}`);
}
