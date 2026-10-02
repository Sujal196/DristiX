import fs from 'node:fs';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Function to construct a valid PDF 1.4 binary buffer with custom lines of text
function createSimplePdf(lines) {
  // Build PDF text stream: BT /F1 12 Tf ... ET
  let streamContent = 'BT\n/F1 12 Tf\n14.4 TL\n';
  let y = 720;
  streamContent += `50 ${y} Td\n`;
  
  for (let i = 0; i < lines.length; i++) {
    const escaped = lines[i].replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    if (i === 0) {
      streamContent += `(${escaped}) Tj\n`;
    } else {
      streamContent += `T*\n(${escaped}) Tj\n`;
    }
  }
  streamContent += 'ET\n';

  const streamLen = Buffer.byteLength(streamContent, 'utf-8');

  let body = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLen} >>
stream
${streamContent}endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
`;

  // Compute xref
  const linesBefore = body.split('\n');
  const offsets = [];
  let currentOffset = 0;
  
  // Find byte offsets of 'n 0 obj'
  const objRegex = /(\d+ 0 obj)/g;
  let match;
  while ((match = objRegex.exec(body)) !== null) {
    offsets.push({ obj: match[1], offset: match.index });
  }

  const startXref = Buffer.byteLength(body, 'utf-8');
  let xref = `xref
0 6
0000000000 65535 f \r
`;
  for (const o of offsets) {
    const padded = String(o.offset).padStart(10, '0');
    xref += `${padded} 00000 n \r\n`;
  }

  xref += `trailer
<< /Size 6 /Root 1 0 R >>
startxref
${startXref}
%%EOF
`;

  return Buffer.from(body + xref, 'utf-8');
}

async function run() {
  const sampleLines = [
    'GENERAL SCIENCE & MATHEMATICS',
    '1. What is the powerhouse of the cell?',
    '(a) Nucleus',
    '(b) Mitochondria',
    '(c) Ribosome',
    '(d) Golgi apparatus',
    'Ans: b',
    'Solution: Mitochondria generate most of the chemical energy needed by the cell.',
    '',
    '2. If 2x + 5 = 15, what is the value of x?',
    '(a) 3    (b) 5    (c) 7    (d) 10',
    'Answer: b',
    'Hint: Subtract 5 from both sides then divide by 2.',
    '',
    'Q3. Which planet is closest to the Sun?',
    'A) Venus',
    'B) Earth',
    'C) Mercury',
    'D) Mars',
    'Correct: C'
  ];

  const pdfBuffer = createSimplePdf(sampleLines);
  const outPath = path.resolve('test-fixtures', 'sample-exam.pdf');
  fs.writeFileSync(outPath, pdfBuffer);
  console.log('Created sample PDF at:', outPath, 'Bytes:', pdfBuffer.length);

  // Now import our extractor
  const { extractParagraphsFromPdf } = await import('../src/utils/pdfImport.ts');
  const { parseQuestions } = await import('../src/utils/docxImport.ts');

  const arrayBuffer = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength);
  const paragraphs = await extractParagraphsFromPdf(arrayBuffer);
  console.log('\n--- Extracted Paragraphs (' + paragraphs.length + ') ---');
  for (const p of paragraphs) {
    console.log(' >', p.text);
  }

  const result = parseQuestions(paragraphs);
  console.log('\n--- Parsed Questions (' + result.questions.length + ') ---');
  for (let i = 0; i < result.questions.length; i++) {
    const q = result.questions[i];
    console.log(`Q${i + 1}: ${q.questionText}`);
    console.log(`   Options (${q.options.length}):`, q.options);
    console.log(`   Correct Option: ${q.correctOption} (${q.options[q.correctOption - 1] || 'None'})`);
    if (q.explanation) console.log(`   Explanation: ${q.explanation}`);
    if (q.hint) console.log(`   Hint: ${q.hint}`);
  }

  console.log('\nSections:', result.sections);
  console.log('hasAllAnswers:', result.hasAllAnswers);

  if (result.questions.length === 3 && result.hasAllAnswers) {
    console.log('\n SUCCESS: All 3 questions cleanly parsed with options and answers!');
  } else {
    console.error('\n FAILED to parse all questions properly.');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
