import fs from 'node:fs';

async function run() {
  const bytes = new Uint8Array(fs.readFileSync('test-fixtures/docx-with-image.docx'));
  const { unpackDocx, buildImageRelMap, xmlToParagraphs, parseQuestions } = await import('../src/utils/docxImport.ts');

  const unpacked = await unpackDocx(bytes);
  console.log('Document XML length:', unpacked.documentXml.length);
  console.log('Rels XML:', unpacked.relsXml);
  console.log('Media entries:', Array.from(unpacked.media.keys()));

  const imageRelMap = buildImageRelMap(unpacked.relsXml, unpacked.media);
  console.log('ImageRelMap size:', imageRelMap.size);
  for (const [k, v] of imageRelMap.entries()) {
    console.log('  Key:', k, 'Value len:', v.length);
  }

  const paragraphs = xmlToParagraphs(unpacked.documentXml, imageRelMap);
  console.log('\nParagraphs:');
  for (const p of paragraphs) {
    console.log(' P:', p.text, '| Image:', p.imageUrl ? p.imageUrl.slice(0, 30) + '...' : 'none');
  }

  const res = parseQuestions(paragraphs);
  console.log('\nParsed questions:', res.questions.length);
  for (const q of res.questions) {
    console.log('Q:', q.questionText);
    console.log(' Diagram URL:', q.diagramUrl ? q.diagramUrl.slice(0, 40) + '...' : 'NONE');
    console.log(' Diagram Type:', q.diagramType);
  }
}

run().catch(console.error);
