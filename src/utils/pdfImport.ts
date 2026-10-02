import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseQuestions, extractAndStripImageUrls, type ImportResult, type DocParagraph } from './docxImport';

// Ensure PDF.js worker is properly configured for Vite and browser environments
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
      import.meta.url
    ).href;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.mjs`;
  }
}

interface TextItemPosition {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PdfLine {
  y: number;
  viewportY: number;
  items: TextItemPosition[];
}

interface AssembledLine {
  text: string;
  viewportY: number;
}

interface ExtractedImageRegion {
  x: number;
  y: number; // top-down distance from top of page
  width: number;
  height: number;
  dataUrl: string;
}

function multiplyMatrix(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
  ];
}

const CHART_OR_DIAGRAM_KEYWORD_RE =
  /(?:bar|pie|line|scatter|histogram|chart|graph|figure|diagram|illustration|shown below|given below|refer to|following (?:figure|diagram|chart|graph)|तालिका|चित्र|आरेख|ग्राफ|रेखाचित्र)\b/i;

/**
 * Extracts embedded raster images and rendered vector charts (Line, Pie, Bar charts)
 * from a PDF page using canvas rendering and operator list analysis.
 */
async function extractImagesFromPage(
  page: any,
  pageWidth: number,
  pageHeight: number,
  assembledLines: AssembledLine[]
): Promise<ExtractedImageRegion[]> {
  const extracted: ExtractedImageRegion[] = [];

  // Browser DOM environment check
  if (typeof document === 'undefined') {
    return extracted;
  }

  try {
    const renderScale = 2.0;
    const renderViewport = page.getViewport({ scale: renderScale });
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = Math.round(renderViewport.width);
    pageCanvas.height = Math.round(renderViewport.height);
    const ctx = pageCanvas.getContext('2d');
    if (!ctx) return extracted;

    // Render page to canvas at 2x resolution
    await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;

    // 1. Analyze PDF operator list for paintImageXObject operations
    const ops = await page.getOperatorList();
    const transformStack: number[][] = [];
    let currentTransform = [1, 0, 0, 1, 0, 0];

    interface CandidateBox {
      x: number;
      y: number;
      width: number;
      height: number;
    }
    const candidateBoxes: CandidateBox[] = [];

    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i];

      if (fn === pdfjsLib.OPS.save) {
        transformStack.push([...currentTransform]);
      } else if (fn === pdfjsLib.OPS.restore) {
        currentTransform = transformStack.pop() || [1, 0, 0, 1, 0, 0];
      } else if (fn === pdfjsLib.OPS.transform) {
        currentTransform = multiplyMatrix(currentTransform, args);
      } else if (
        fn === pdfjsLib.OPS.paintImageXObject ||
        fn === pdfjsLib.OPS.paintInlineImageXObject ||
        fn === pdfjsLib.OPS.paintImageXObjectRepeat
      ) {
        const scaleX = currentTransform[0];
        const scaleY = currentTransform[3];
        const transX = currentTransform[4];
        const transY = currentTransform[5];

        const w = Math.abs(scaleX);
        const h = Math.abs(scaleY);
        const x = Math.min(transX, transX + scaleX);
        const pdfY = Math.min(transY, transY + scaleY);
        const y = pageHeight - (pdfY + h);

        // Filter out tiny icons (< 30px) or full page background watermarks
        if (w >= 30 && h >= 30 && (w < pageWidth * 0.95 || h < pageHeight * 0.95)) {
          candidateBoxes.push({ x, y, width: w, height: h });
        }
      }
    }

    // 2. Check question text gaps for vector charts (Line, Pie, Bar charts without raster XObjects)
    for (let li = 0; li < assembledLines.length - 1; li++) {
      const line = assembledLines[li];
      const nextLine = assembledLines[li + 1];

      if (CHART_OR_DIAGRAM_KEYWORD_RE.test(line.text)) {
        const gap = nextLine.viewportY - line.viewportY;
        if (gap >= 45) {
          const hasExisting = candidateBoxes.some(
            (b) => b.y >= line.viewportY - 10 && b.y + b.height <= nextLine.viewportY + 10
          );
          if (!hasExisting) {
            candidateBoxes.push({
              x: 35,
              y: line.viewportY + 15,
              width: pageWidth - 70,
              height: Math.max(30, gap - 20),
            });
          }
        }
      }
    }

    // 3. Crop candidate bounding boxes from the rendered canvas
    for (const box of candidateBoxes) {
      const cropX = Math.max(0, Math.round(box.x * renderScale));
      const cropY = Math.max(0, Math.round(box.y * renderScale));
      const cropW = Math.min(pageCanvas.width - cropX, Math.round(box.width * renderScale));
      const cropH = Math.min(pageCanvas.height - cropY, Math.round(box.height * renderScale));

      if (cropW < 25 || cropH < 25) continue;

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d');
      if (!cropCtx) continue;

      cropCtx.fillStyle = '#ffffff';
      cropCtx.fillRect(0, 0, cropW, cropH);
      cropCtx.drawImage(pageCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      // Verify that the region is not just blank white space
      const imgData = cropCtx.getImageData(0, 0, cropW, cropH);
      const data = imgData.data;
      let nonWhitePixels = 0;
      const step = 4 * 4; // Sample every 4th pixel for speed
      for (let p = 0; p < data.length; p += step) {
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const a = data[p + 3];
        if (a > 30 && (r < 240 || g < 240 || b < 240)) {
          nonWhitePixels++;
        }
      }

      if (nonWhitePixels > 30) {
        const dataUrl = cropCanvas.toDataURL('image/png');
        extracted.push({
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          dataUrl,
        });
      }
    }
  } catch (err) {
    console.warn('[dristix] Error extracting images from PDF page:', err);
  }

  return extracted;
}

/**
 * Extracts structured text paragraphs and attached diagrams/charts from a PDF ArrayBuffer.
 * Handles single-column and multi-column exam papers with precise line-height grouping.
 */
export async function extractParagraphsFromPdf(arrayBuffer: ArrayBuffer): Promise<DocParagraph[]> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const allParagraphs: DocParagraph[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;

    const items: TextItemPosition[] = [];
    for (const item of textContent.items as any[]) {
      if (!item.str || typeof item.str !== 'string') continue;
      const str = item.str;
      const x = item.transform[4];
      const y = item.transform[5];
      const width = item.width || 0;
      const height = item.height || Math.abs(item.transform[3]) || 12;

      items.push({ str, x, y, width, height });
    }

    if (items.length === 0) continue;

    // Check for 2-column layout
    const midX = pageWidth / 2;
    const leftMargin = 30;
    const rightMargin = pageWidth - 30;

    let leftCount = 0;
    let rightCount = 0;
    let centerCount = 0;

    for (const it of items) {
      if (it.x >= leftMargin && it.x + it.width < midX - 15) {
        leftCount++;
      } else if (it.x > midX + 15 && it.x + it.width <= rightMargin) {
        rightCount++;
      } else if (it.x < midX + 25 && it.x + it.width > midX - 25) {
        centerCount++;
      }
    }

    const isTwoColumn = leftCount > 20 && rightCount > 20 && centerCount < (leftCount + rightCount) * 0.15;

    let pageLines: AssembledLine[] = [];
    if (isTwoColumn) {
      const leftItems = items.filter((it) => it.x + it.width / 2 <= midX);
      const rightItems = items.filter((it) => it.x + it.width / 2 > midX);

      const leftLines = assembleLines(leftItems, pageHeight);
      const rightLines = assembleLines(rightItems, pageHeight);
      pageLines = [...leftLines, ...rightLines];
    } else {
      pageLines = assembleLines(items, pageHeight);
    }

    // Extract images and visual charts from this page
    const pageImages = await extractImagesFromPage(page, pageWidth, pageHeight, pageLines);

    // Convert lines and images into structured paragraphs
    const pageParagraphs = linesToParagraphs(pageLines, pageImages);
    allParagraphs.push(...pageParagraphs);
  }

  return allParagraphs;
}

/**
 * Groups positioned text items into horizontal lines sorted from top to bottom.
 */
function assembleLines(items: TextItemPosition[], pageHeight: number): AssembledLine[] {
  if (items.length === 0) return [];

  const linesMap: PdfLine[] = [];

  for (const it of items) {
    if (!it.str.trim() && it.str !== ' ') continue;

    let targetLine: PdfLine | null = null;
    const tolerance = Math.max(2.5, Math.min(4.0, it.height * 0.35));

    for (const l of linesMap) {
      if (Math.abs(l.y - it.y) <= tolerance) {
        targetLine = l;
        break;
      }
    }

    if (targetLine) {
      targetLine.items.push(it);
      targetLine.y = (targetLine.y * (targetLine.items.length - 1) + it.y) / targetLine.items.length;
      targetLine.viewportY = Math.max(0, pageHeight - targetLine.y);
    } else {
      linesMap.push({
        y: it.y,
        viewportY: Math.max(0, pageHeight - it.y),
        items: [it],
      });
    }
  }

  // Sort lines from top of the page (lower viewportY) to bottom of the page (higher viewportY)
  linesMap.sort((a, b) => a.viewportY - b.viewportY);

  const assembled: AssembledLine[] = [];

  for (const line of linesMap) {
    line.items.sort((a, b) => a.x - b.x);

    let lineText = '';
    let prevItem: TextItemPosition | null = null;

    for (const item of line.items) {
      if (!lineText) {
        lineText = item.str;
      } else {
        const prevEnd = prevItem ? prevItem.x + prevItem.width : 0;
        const gap = item.x - prevEnd;

        if (gap > 2.0 && !lineText.endsWith(' ') && !item.str.startsWith(' ')) {
          lineText += ' ' + item.str;
        } else {
          lineText += item.str;
        }
      }
      prevItem = item;
    }

    const trimmed = lineText.replace(/\s+/g, ' ').trim();
    if (trimmed) {
      assembled.push({ text: trimmed, viewportY: line.viewportY });
    }
  }

  return assembled;
}

/**
 * Converts assembled lines into semantic document paragraphs and integrates extracted images/charts.
 */
function linesToParagraphs(lines: AssembledLine[], images: ExtractedImageRegion[]): DocParagraph[] {
  const paragraphs: (DocParagraph & { viewportY: number })[] = [];
  let currentBuffer = '';
  let currentY = 0;

  const isBoundary = (line: string): boolean => {
    if (/^(?:question|ques|q|प्र|प्रश्न)?\s*[.:\-–]?\s*\d{1,3}\s*[).:\-–]/i.test(line)) return true;
    if (/^(?:section|unit|part|chapter|module)\b/i.test(line)) return true;
    if (/^\(?[a-dA-D1-4क-घअ-द]\)\s*/.test(line) || /^[a-dA-D1-4क-घअ-द]\.\s+/.test(line)) return true;
    if (/^(?:(?:ans|answer|correct|key|solution|hint)\b|उत्तर|उत्तरमाला|उत्तर\s*कुंजी|उत्तर\s*तालिका|हल)/i.test(line)) return true;
    if (/^(?:(?:question|ques|q|प्र|प्रश्न)\s*[.:\-–]?\s*)?\d{1,3}\s*(?:[.)\-:=–\t]|->|=|\s+)\s*(?:option|opt|विकल्प|उत्तर|ans|answer)?\s*[:=\-–]?\s*\(?[a-hA-H1-8क-घअ-द]\)?[.:)\-–]?/i.test(line)) return true;
    if (/^(?:\[|\()?\s*(?:image|diagram|figure|fig|chart|graph|asset)\s*(?:url|link)?\s*[:=\-–]?\s*https?:\/\//i.test(line)) return true;
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const item = lines[i];
    const line = item.text;

    if (isBoundary(line)) {
      if (currentBuffer) {
        paragraphs.push({ text: currentBuffer.trim(), style: '', viewportY: currentY });
        currentBuffer = '';
      }
      currentBuffer = line;
      currentY = item.viewportY;
    } else {
      if (currentBuffer) {
        if (/[-–]$/.test(currentBuffer) && /^[a-z]/.test(line)) {
          currentBuffer = currentBuffer.slice(0, -1) + line;
        } else if (/https?:\/\/\S+$/.test(currentBuffer) && /^[a-zA-Z0-9_\-]{6,}/.test(line)) {
          // Rejoin wrapped URLs across line breaks without an accidental space
          const isEnglishWord = /^(?:what|which|how|who|where|when|why|if|the|find|calculate|in|for|from|to|select|choose|consider)\b/i.test(line);
          if (!isEnglishWord) {
            currentBuffer += line;
          } else {
            currentBuffer += ' ' + line;
          }
        } else {
          currentBuffer += ' ' + line;
        }
      } else {
        currentBuffer = line;
        currentY = item.viewportY;
      }
    }
  }

  if (currentBuffer.trim()) {
    paragraphs.push({ text: currentBuffer.trim(), style: '', viewportY: currentY });
  }

  // Associate images with their closest preceding/encompassing question paragraph
  const result: DocParagraph[] = [];
  const sortedImages = [...images].sort((a, b) => a.y - b.y);
  let imgIdx = 0;

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const p = paragraphs[pi];
    const nextP = paragraphs[pi + 1];

    // If an image sits between this paragraph and the next (or within this question's vertical range)
    const attachedImages: string[] = [];
    while (imgIdx < sortedImages.length) {
      const img = sortedImages[imgIdx];
      const isPastNext = nextP && img.y >= nextP.viewportY;
      if (!isPastNext) {
        attachedImages.push(img.dataUrl);
        imgIdx++;
      } else {
        break;
      }
    }

    const stripped = extractAndStripImageUrls(p.text);
    const text = stripped.cleanText;
    const imageUrl = stripped.imageUrl || (attachedImages.length > 0 ? attachedImages[0] : p.imageUrl);

    if (attachedImages.length > 0 || stripped.imageUrl) {
      result.push({ text, style: p.style, imageUrl });
      for (let k = (stripped.imageUrl ? 0 : 1); k < attachedImages.length; k++) {
        result.push({ text: '', style: '', imageUrl: attachedImages[k] });
      }
    } else {
      result.push({ text, style: p.style, imageUrl: p.imageUrl });
    }
  }

  // Any remaining images after the last paragraph
  while (imgIdx < sortedImages.length) {
    result.push({ text: '', style: '', imageUrl: sortedImages[imgIdx].dataUrl });
    imgIdx++;
  }

  return result;
}

/**
 * Secondary high-precision regex pass for PDF question papers if standard parseQuestions
 * needs additional marker adaptation.
 */
function parsePdfQuestionsFallback(paragraphs: DocParagraph[]): ImportResult {
  const normalized: DocParagraph[] = paragraphs.map((p) => {
    let t = p.text;
    t = t
      .replace(/०/g, '0')
      .replace(/१/g, '1')
      .replace(/२/g, '2')
      .replace(/३/g, '3')
      .replace(/४/g, '4')
      .replace(/५/g, '5')
      .replace(/६/g, '6')
      .replace(/७/g, '7')
      .replace(/८/g, '8')
      .replace(/९/g, '9');

    t = t
      .replace(/\(क\)/gi, '(a)')
      .replace(/\(ख\)/gi, '(b)')
      .replace(/\(ग\)/gi, '(c)')
      .replace(/\(घ\)/gi, '(d)')
      .replace(/\(अ\)/gi, '(a)')
      .replace(/\(ब\)/gi, '(b)')
      .replace(/\(स\)/gi, '(c)')
      .replace(/\(द\)/gi, '(d)');

    t = t.replace(/^(?:उत्तर|सही\s*उत्तर|हल)\s*[.:\-–]\s*/i, 'Ans: ');

    return { text: t, style: p.style, imageUrl: p.imageUrl };
  });

  return parseQuestions(normalized);
}

/**
 * Main entry point: extracts structured exam questions with diagram/chart images from a PDF File.
 */
export async function extractQuestionsFromPdf(file: File): Promise<ImportResult> {
  const arrayBuffer = await file.arrayBuffer();

  const paragraphs = await extractParagraphsFromPdf(arrayBuffer);

  if (paragraphs.length === 0) {
    throw new Error(
      `No selectable text was found in "${file.name}". This PDF may be a scanned image or photo. ` +
      'Please use an export with selectable text, or save as Word (.docx).'
    );
  }

  // 1. Primary pass with standard exam parser
  let result = parseQuestions(paragraphs);

  // 2. If no questions detected, retry with secondary normalization pass (Devanagari, Hindi options, brackets)
  if (result.questions.length === 0) {
    result = parsePdfQuestionsFallback(paragraphs);
  }

  return result;
}
