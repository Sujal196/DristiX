/**
 * Word → structured questions.
 *
 * An examiner already has the paper in Word; making them retype every item
 * into four option boxes is pure drudgery. This reads a .docx in the browser
 * (no server round-trip, no dependency: a .docx is a ZIP whose
 * `word/document.xml` we inflate with the platform's DecompressionStream),
 * then recognises the shapes real exam files use:
 *
 *   1. What is the sum of the angles of a triangle?
 *   (a) 90°   (b) 180°   (c) 270°   (d) 360°
 *   Ans: b
 *   Solution: Angle sum property of a triangle is 180°.
 *
 * Question markers (`1.` `Q2)` `Question 3:`), option styles (`a)` `(A)` `i)`
 * `1)`), answer lines (`Ans:` `Answer: (2)` `Correct option: c`), a trailing
 * answer key (`1. B  2. A …`), section headings and solution/hint lines are
 * each mapped onto the field they belong to, so the admin reviews instead of
 * retyping.
 */

export interface ImportedQuestion {
  section: string;
  questionText: string;
  /** 1..6 options exactly as found; callers decide how many to render. */
  options: string[];
  /** 1-based index, or 0 when the file carried no answer for this item. */
  correctOption: number;
  explanation: string;
  hint: string;
  diagramUrl?: string;
  diagramType?: 'image' | 'chart' | 'geometry' | 'svg';
}

export interface ImportResult {
  questions: ImportedQuestion[];
  /** Section headings found, in document order. */
  sections: string[];
  /** True when every question had an answer in the file. */
  hasAllAnswers: boolean;
}

export interface DocParagraph {
  text: string;
  style: string;
  imageUrl?: string;
}

/* ------------------------------------------------------------------ */
/* .docx unpacking                                                     */
/* ------------------------------------------------------------------ */

function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const Ctor = (
    globalThis as unknown as {
      DecompressionStream?: new (format: string) => unknown;
    }
  ).DecompressionStream;

  if (!Ctor) {
    return Promise.reject(
      new Error(
        'This browser cannot unpack .docx files. Use Chrome or Edge, or save the document as plain text (.txt) and import that.'
      )
    );
  }

  // Typed loosely on purpose: TS 5.7's Uint8Array<ArrayBuffer> vs
  // ArrayBufferLike generics make the platform's DOM lib disagree with itself
  // about a stream's element type, and the runtime contract here is simple —
  // bytes in, inflated bytes out.
  const inflater = new Ctor('deflate-raw') as unknown as TransformStream<any, any>;
  const source = new Blob([data as unknown as BlobPart]);
  const stream = source.stream().pipeThrough(inflater);
  return new Response(stream).arrayBuffer().then((buf) => new Uint8Array(buf));
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const nodeBuf = (globalThis as Record<string, any>).Buffer;
  if (nodeBuf && typeof nodeBuf.from === 'function') {
    return nodeBuf.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 16384;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

interface DocxUnpacked {
  documentXml: string;
  relsXml?: string;
  media: Map<string, Uint8Array>;
}

export async function unpackDocx(bytes: Uint8Array): Promise<DocxUnpacked> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // End Of Central Directory signature, searched backwards from the tail.
  let eocd = -1;
  const lowest = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= lowest; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('This file is not a valid .docx document.');

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  let documentXml = '';
  let relsXml: string | undefined;
  const media = new Map<string, Uint8Array>();

  for (let n = 0; n < entryCount; n++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) break;

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));

    const isDocXml = name === 'word/document.xml';
    const isRelsXml = name === 'word/_rels/document.xml.rels';
    const isMedia = name.startsWith('word/media/') || name.includes('/media/');

    if (isDocXml || isRelsXml || isMedia) {
      if (view.getUint32(localOffset, true) !== 0x04034b50) {
        throw new Error('The .docx archive is damaged.');
      }
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const payload = bytes.slice(start, start + compressedSize);

      let uncompressed: Uint8Array;
      if (method === 0) uncompressed = payload;
      else if (method === 8) uncompressed = await inflateRaw(payload);
      else throw new Error('This .docx uses an unsupported compression method.');

      if (isDocXml) {
        documentXml = new TextDecoder('utf-8').decode(uncompressed);
      } else if (isRelsXml) {
        relsXml = new TextDecoder('utf-8').decode(uncompressed);
      } else if (isMedia) {
        const cleanName = name.replace(/\\/g, '/');
        const baseName = cleanName.split('/').pop() || cleanName;
        media.set(cleanName, uncompressed);
        media.set(baseName, uncompressed);
        media.set('media/' + baseName, uncompressed);
        media.set('word/media/' + baseName, uncompressed);
      }
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  if (!documentXml) {
    throw new Error('No document content found inside this .docx file.');
  }

  return { documentXml, relsXml, media };
}

export function buildImageRelMap(relsXml: string | undefined, media: Map<string, Uint8Array>): Map<string, string> {
  const map = new Map<string, string>();
  if (!relsXml || media.size === 0) return map;

  const tagRe = /<Relationship\b([^>]*)\/?>/gi;
  let tagMatch: RegExpExecArray | null;

  while ((tagMatch = tagRe.exec(relsXml))) {
    const attrs = tagMatch[1];
    const id = /Id=["'\\/]?([a-zA-Z0-9_\-]+)/i.exec(attrs)?.[1];
    const target = /Target=["'\\]?([^"'\s\\>]+)/i.exec(attrs)?.[1];
    const type = /Type=["'\\]?([^"'\s\\>]+)/i.exec(attrs)?.[1] || '';

    if (!id || !target) continue;

    if (type.includes('/image') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(target)) {
      const cleanTarget = target.replace(/\\/g, '/').replace(/^\.\.\//, '');
      const baseName = cleanTarget.split('/').pop() || cleanTarget;
      const bytes = media.get(cleanTarget) || media.get('word/' + cleanTarget) || media.get(baseName);

      if (bytes && bytes.length > 0) {
        const ext = baseName.split('.').pop()?.toLowerCase() || 'png';
        const mime =
          ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'svg'
            ? 'image/svg+xml'
            : ext === 'gif'
            ? 'image/gif'
            : ext === 'webp'
            ? 'image/webp'
            : ext === 'bmp'
            ? 'image/bmp'
            : 'image/png';

        const base64 = uint8ArrayToBase64(bytes);
        map.set(id, `data:${mime};base64,${base64}`);
      }
    }
  }

  return map;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(Math.min(code, 0x10ffff)) : '';
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(Math.min(code, 0x10ffff)) : '';
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Pulls paragraph text, table contents, Word style names, and attached images. */
export function xmlToParagraphs(xml: string, imageRelMap?: Map<string, string>): DocParagraph[] {
  const out: DocParagraph[] = [];
  const tokenRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>|<w:cr\b[^>]*\/>/g;

  function extractInner(inner: string): { text: string; imageUrl?: string } {
    let imageUrl: string | undefined;
    if (imageRelMap && imageRelMap.size > 0) {
      const blipMatch = /(?:r:embed|r:id|o:relid)=["'\\]?([a-zA-Z0-9_\-]+)/i.exec(inner);
      if (blipMatch) {
        const rId = blipMatch[1];
        imageUrl = imageRelMap.get(rId);
      }
    }

    let text = '';
    let token: RegExpExecArray | null;
    tokenRe.lastIndex = 0;
    while ((token = tokenRe.exec(inner))) {
      if (token[1] !== undefined) text += decodeEntities(token[1]);
      else text += token[0].startsWith('<w:tab') ? ' ' : '\n';
    }

    const flat = text.replace(/\s+/g, ' ').trim();
    return { text: flat, imageUrl };
  }

  // Iterate top-level <w:p> and <w:tbl> blocks in document order
  const blockRe = /<(w:p|w:tbl)\b[^>]*>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(xml))) {
    const tag = match[1];
    const inner = match[2];

    if (tag === 'w:p') {
      const style = /<w:pStyle\b[^>]*w:val="([^"]+)"/.exec(inner)?.[1] ?? '';
      const { text, imageUrl } = extractInner(inner);
      if (text || imageUrl) {
        out.push({ text, style, imageUrl });
      }
    } else if (tag === 'w:tbl') {
      // Process table rows and cells
      const trRe = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
      let trMatch: RegExpExecArray | null;
      const rows: { text: string; imageUrl?: string }[][] = [];

      while ((trMatch = trRe.exec(inner))) {
        const tcRe = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
        let tcMatch: RegExpExecArray | null;
        const cells: { text: string; imageUrl?: string }[] = [];

        while ((tcMatch = tcRe.exec(trMatch[1]))) {
          cells.push(extractInner(tcMatch[1]));
        }
        if (cells.length > 0) rows.push(cells);
      }

      // Check if table is horizontal:
      // Row 0 has headers/numbers like: [ 'Q.No', '1', '2', '3', ... ]
      // Row 1 has answers like: [ 'Ans', 'B', 'C', 'A', ... ]
      if (
        rows.length >= 2 &&
        rows[0].length >= 2 &&
        rows[0].length === rows[1].length
      ) {
        const isHeaderRow = /^(?:q|ques|question|s\.?no|no|prashna|प्र|प्रश्न)/i.test(rows[0][0]?.text || '');
        const isAnsRow = /^(?:ans|answer|key|opt|option|uttar|उत्तर)/i.test(rows[1][0]?.text || '');
        const isNumSequence = rows[0].slice(isHeaderRow ? 1 : 0).every((c) => /^\d{1,3}$/.test(c.text.trim()));
        const isAnsSequence = rows[1].slice(isAnsRow ? 1 : 0).every((c) => /^(?:option\s+)?\(?[a-hA-H1-8क-घअ-द]\)?[.:)\-–]?$/i.test(c.text.trim()));

        if ((isHeaderRow && isAnsRow) || (isNumSequence && isAnsSequence)) {
          out.push({ text: 'Answer Key:', style: 'heading' });
          const startCol = isHeaderRow ? 1 : 0;
          for (let c = startCol; c < rows[0].length; c++) {
            const qNum = rows[0][c].text.replace(/[^\d]/g, '');
            const ans = rows[1][c].text.trim();
            if (qNum && ans) {
              out.push({ text: `${qNum}. ${ans}`, style: '' });
            }
          }
          continue;
        }
      }

      // Process standard vertical/grid rows:
      for (const cells of rows) {
        const cellTexts = cells.map((c) => c.text.trim()).filter(Boolean);
        const cellImage = cells.find((c) => c.imageUrl)?.imageUrl;

        if (cellTexts.length === 0 && !cellImage) continue;

        // Check for table header row e.g. ["Q.No", "Answer"] or ["Question", "Correct Option"]
        if (
          cellTexts.length >= 2 &&
          /^(?:q|question|ques|s\.?no|prashna|प्र|प्रश्न)/i.test(cellTexts[0]) &&
          /^(?:ans|answer|key|option|uttar|उत्तर)/i.test(cellTexts[1])
        ) {
          out.push({ text: 'Answer Key:', style: 'heading', imageUrl: cellImage });
          continue;
        }

        // Check if row contains question-answer pairs: e.g. ["1.", "B"] or ["1", "B", "Explanation"] or ["1", "B", "6", "A"]
        let handledAsPairs = false;
        if (cellTexts.length >= 2 && cellTexts.length % 2 === 0) {
          const pairs: string[] = [];
          let allMatched = true;
          for (let j = 0; j < cellTexts.length; j += 2) {
            const numPart = cellTexts[j];
            const ansPart = cellTexts[j + 1];
            const isNum = /^(?:(?:question|ques|q|s\.?no|no|prashna|प्र|प्रश्न)\s*[.:\-–]?\s*)?\d{1,3}[.:)\-–]?$/i.test(numPart);
            const isAns = /^(?:(?:ans|answer|key|opt|option|विकल्प|उत्तर)\s*[:=\-–]?\s*)?\(?\s*([a-hA-H1-8]|क|ख|ग|घ|अ|ब|स|द)\s*\)?[.:)\-–]?$/i.test(ansPart);
            if (isNum && isAns) {
              const num = numPart.replace(/[^\d]/g, '');
              pairs.push(`${num}. ${ansPart}`);
            } else {
              allMatched = false;
              break;
            }
          }
          if (allMatched && pairs.length > 0) {
            handledAsPairs = true;
            for (const p of pairs) {
              out.push({ text: p, style: '', imageUrl: cellImage });
            }
          }
        } else if (cellTexts.length >= 3 && cellTexts.length % 3 === 0) {
          // 3-column table: [Question Number, Answer, Explanation/Note]
          const pairs: { ansLine: string; explLine?: string }[] = [];
          let allMatched = true;
          for (let j = 0; j < cellTexts.length; j += 3) {
            const numPart = cellTexts[j];
            const ansPart = cellTexts[j + 1];
            const explPart = cellTexts[j + 2];
            const isNum = /^(?:(?:question|ques|q|s\.?no|no|prashna|प्र|प्रश्न)\s*[.:\-–]?\s*)?\d{1,3}[.:)\-–]?$/i.test(numPart);
            const isAns = /^(?:(?:ans|answer|key|opt|option|विकल्प|उत्तर)\s*[:=\-–]?\s*)?\(?\s*([a-hA-H1-8]|क|ख|ग|घ|अ|ब|स|द)\s*\)?[.:)\-–]?$/i.test(ansPart);
            if (isNum && isAns) {
              const num = numPart.replace(/[^\d]/g, '');
              pairs.push({
                ansLine: `${num}. ${ansPart}`,
                explLine: explPart ? `Explanation: ${explPart}` : undefined,
              });
            } else {
              allMatched = false;
              break;
            }
          }
          if (allMatched && pairs.length > 0) {
            handledAsPairs = true;
            for (const p of pairs) {
              out.push({ text: p.ansLine, style: '', imageUrl: cellImage });
              if (p.explLine) out.push({ text: p.explLine, style: '' });
            }
          }
        }

        if (!handledAsPairs) {
          // General table row: join with tab
          out.push({ text: cellTexts.join('\t'), style: '', imageUrl: cellImage });
        }
      }
    }
  }

  return out;
}

/**
 * Detects, extracts, and strips any embedded image or diagram URLs from question text.
 * Ensures the question statement contains purely clean question prose,
 * while extracting the URL for diagramUrl / visual attachment.
 */
export function extractAndStripImageUrls(rawText: string): { cleanText: string; imageUrl?: string } {
  if (!rawText) return { cleanText: '' };
  let text = rawText;
  let extractedUrl: string | undefined;

  // 1. Markdown image syntax: ![alt](url)
  const mdImgMatch = /!\[([^\]]*)\]\(((?:https?:\/\/|data:image\/|\/)[^\s)]+)\)/i.exec(text);
  if (mdImgMatch) {
    if (!extractedUrl) extractedUrl = mdImgMatch[2];
    text = text.replace(mdImgMatch[0], ' ');
  }

  // 2. HTML image syntax: <img src="url" ... />
  const htmlImgMatch = /<img\b[^>]*src=["']((?:https?:\/\/|data:image\/|\/)[^"']+)["'][^>]*\/?>/i.exec(text);
  if (htmlImgMatch) {
    if (!extractedUrl) extractedUrl = htmlImgMatch[1];
    text = text.replace(htmlImgMatch[0], ' ');
  }

  // 3. Explicit Image / Diagram / Chart / Graph URL or Link label:
  // e.g. "Image URL: https://...", "Diagram: https://...", "[Image URL: https://...]"
  const labeledUrlRegex = /(?:\[|\()?\s*(?:image|diagram|figure|fig|chart|graph|asset|visual|illustration|चित्र|आरेख|ग्राफ)\s*(?:url|link|source|src|ref)?\s*[:=\-–]?\s*[:=\-–]?\s*(https?:\/\/[^\s"'<>)\]]+(?:\s+[a-zA-Z0-9_\-]{6,30})?)(?:\]|\))?/gi;

  let match: RegExpExecArray | null;
  while ((match = labeledUrlRegex.exec(text))) {
    let url = match[1];
    const parts = url.split(/\s+/);
    if (parts.length > 1) {
      const first = parts[0];
      const second = parts[1];
      const isEnglishWord = /^(?:what|which|how|who|where|when|why|if|the|find|calculate|in|for|from|to|select|choose|consider|according|based)\b/i.test(second);
      if (!isEnglishWord && /^[a-zA-Z0-9_\-]{6,}$/.test(second)) {
        url = (first.endsWith('/') || first.includes('/artifact/')) ? first + second : first + '/' + second;
      } else {
        url = first;
      }
    }

    if (!extractedUrl) {
      extractedUrl = url.replace(/[.,;:)\]]+$/, '');
    }
    text = text.replace(match[0], ' ');
  }

  // 4. Standalone Image URLs in brackets: [https://...] or (https://...)
  const bracketedUrlRegex = /[\[(]\s*(https?:\/\/[^\s)\]]+(?:\.(?:png|jpe?g|webp|svg|gif)|claude\.ai\/artifact\/\S+))\s*[\])]/gi;
  while ((match = bracketedUrlRegex.exec(text))) {
    if (!extractedUrl) {
      extractedUrl = match[1];
    }
    text = text.replace(match[0], ' ');
  }

  // 5. Raw URL ending in image extension or claude artifact:
  const rawImgUrlRegex = /(https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp|svg|gif)(?:\?[^\s"'<>]*)?|https?:\/\/claude\.ai\/artifact\/[a-zA-Z0-9_\-]+)/gi;
  while ((match = rawImgUrlRegex.exec(text))) {
    if (!extractedUrl) {
      extractedUrl = match[1];
    }
    text = text.replace(match[0], ' ');
  }

  // Clean up any double spaces, dangling punctuation, or empty brackets left by removal
  let cleanText = text
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?:;])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .trim();

  return { cleanText, imageUrl: extractedUrl };
}

/* ------------------------------------------------------------------ */
/* Line classification                                                 */
/* ------------------------------------------------------------------ */

type OptionStyle = 'letter' | 'roman' | 'digit';

const NOISE_RE =
  /^(?:page\s*\d+|p\s*\.\s*\d+|www\.\S+|https?:\/\/\S+|\d{1,3}\s*\/\s*\d{1,3}|[-_=*•·~#]{3,}|\d{1,4})$/i;

const SECTION_RE =
  /^(?:section|unit|chapter|part|topic|module|block)\b[\s:.\-–]*(\d{1,2})?\s*[.:)\-–]?\s*([A-Za-z][\w '&/()/-]*)$/i;

const ANSWER_KEY_HEADING_RE =
  /^(?:answer\s*keys?|answers?|key\s*(?:to|for)?|solution\s*keys?|solutions?|hints?\s*(?:&|and)?\s*solutions?|answer\s*sheet|response\s*key|correct\s*answers?|उत्तरमाला|उत्तर\s*कुंजी|उत्तर\s*तालिका|उत्तर\s*सूची|उत्तर)\s*(?:(?:&|and|\+|with)\s*(?:solutions?|explanations?|hints?|analysis))?\s*[:=\-–]?/i;

const QUESTION_RE =
  /^(?:question|ques|q)\s*[.:\-–]?\s*(\d{1,3})\s*[).:\-–]\s*(.*)$/i;

const NUMBERED_START_RE = /^(\d{1,3})\s*[).:\-–]\s*(.*)$/;

const EXPLANATION_RE =
  /^(?:explanation|explanations|explain|solution|solutions|sol|soln|approach|method|worked\s*(?:out|solution))\b\s*[.:)\-–]\s*(.*)$/i;

const HINT_RE = /^(?:hint|hints|clue|tip|remember|note)\b\s*[.:)\-–]\s*(.*)$/i;

const ANSWER_RE =
  /^(?:(?:ans|answer|correct\s*(?:option|answer|choice)?|key|right\s*option)\b|(?:उत्तर|सही\s*उत्तर|उत्तर\s*कुंजी|हल))\s*[.:)\-:=–\t]*\s*(?:option|choice|answer|विकल्प|उत्तर|is)?\s*[.:)\-:=–\t]*\s*\(?\s*([a-hA-H1-8]|क|ख|ग|घ|अ|ब|स|द)\s*\)?[.:)\-–]?/i;

/** "(b) is the answer" or "Option B is correct" — marker leads instead of "Answer". */
const TRAILING_ANSWER_RE =
  /^(?:option\s+)?\(?\s*([a-hA-H1-8]|क|ख|ग|घ|अ|ब|स|द)\s*\)?[.:)\-–]?\s+(?:is\s+)?(?:the\s+)?(?:correct\s+|right\s+)?(?:answer|option|choice)/i;

/** A correct option can be flagged by "(correct)", "✓" or a standalone "*". */
const OPTION_ANSWER_MARK_RE =
  /\((?:correct|answer|right|key|सही)\)|\[(?:correct|answer|right|key|सही)\]|✔|✓|(?:^|\s)\*(?:\s|$)/i;

function isHeadingStyle(style: string): boolean {
  return /^(heading|title|subtitle)/i.test(style);
}

function matchSection(paragraph: DocParagraph): string | null {
  const text = paragraph.text;

  const explicit = SECTION_RE.exec(text);
  if (explicit) {
    const label = `${explicit[1] ? `${explicit[1]}: ` : ''}${explicit[2]}`.trim();
    if (label) return label;
  }

  if (isHeadingStyle(paragraph.style)) return text;

  // A short ALL-CAPS line ("ARITHMETIC & MENTAL ABILITY") reads as a heading.
  if (
    /^[A-Z][A-Z\s&/'()-]{2,59}$/.test(text) &&
    /\s/.test(text) &&
    text.split(/\s+/).length <= 8
  ) {
    return text;
  }

  return null;
}

interface OptionMatch {
  style: OptionStyle;
  number: number;
  rest: string;
  raw: string;
}

function styleFromLetter(marker: string): OptionStyle {
  const lower = marker.toLowerCase();
  if (marker.length > 1) return 'roman'; // ii, iv, vi…
  if (/[ivxl]/.test(lower) && !/[a-h]/.test(lower)) return 'roman';
  return 'letter';
}

function matchOption(line: string): OptionMatch | null {
  // (a) text   |   (A) text   |   (iv) text
  let m = /^\(([a-zA-Z]{1,4}|क|ख|ग|घ|अ|ब|स|द)\)\s*(.*)$/.exec(line);
  if (m) {
    const style = styleFromLetter(m[1]);
    return { style, number: letterToIndex(m[1]), rest: m[2], raw: m[0] };
  }

  // a) text / A. text / a. text  (single letter followed by a separator)
  m = /^([a-zA-Z]|क|ख|ग|घ|अ|ब|स|द)\s*[).:\-–]\s*(.*)$/.exec(line);
  if (m) {
    return { style: styleFromLetter(m[1]), number: letterToIndex(m[1]), rest: m[2], raw: m[0] };
  }

  // 1) text / 1. text / (1) text
  m = /^\(?(\d{1,2})\s*[).:\-–]\s*(.*)$/.exec(line);
  if (m) {
    const number = Number(m[1]);
    if (number >= 1 && number <= 9) return { style: 'digit', number, rest: m[2], raw: m[0] };
  }

  return null;
}

function letterToIndex(marker: string): number {
  if (!marker) return 0;
  const lower = marker.trim().toLowerCase();
  // Devanagari Hindi option markers
  if (lower === 'क' || lower === 'अ') return 1;
  if (lower === 'ख' || lower === 'ब') return 2;
  if (lower === 'ग' || lower === 'स') return 3;
  if (lower === 'घ' || lower === 'द') return 4;

  const code = lower.charCodeAt(0) - 97;
  return code >= 0 && code <= 25 ? code + 1 : 0;
}

/**
 * "a) 90 (b) 180 (c) 270 (d) 360" on a single line — extremely common when a
 * paper was typed compactly. Only trusted when the first marker sits at the
 * very start and every marker shares one style, so ordinary prose that
 * happens to contain "2)" is not shredded into options.
 */
function splitInlineOptions(line: string): { texts: string[]; style: OptionStyle } | null {
  // `\s*` rather than `\s+` so the compact style exam papers actually use
  // ("a)3 b)4 c)5 d)6") still splits; leading position plus a separator is
  // enough evidence to keep prose from being shredded.
  const markerRe = /(^|\s)(?:\(([a-zA-Z]{1,4}|\d{1,2}|क|ख|ग|घ|अ|ब|स|द)\)|([a-zA-Z]|\d{1,2}|क|ख|ग|घ|अ|ब|स|द)[).:\-–])\s*/g;
  const hits: { start: number; textStart: number; marker: string }[] = [];

  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(line))) {
    const marker = m[2] ?? m[3] ?? '';
    hits.push({
      start: m.index + (m[1]?.length ?? 0),
      textStart: markerRe.lastIndex,
      marker,
    });
  }

  if (hits.length < 2 || hits[0].start !== 0) return null;

  const styles = hits.map((h) => (/\d/.test(h.marker) ? 'digit' : styleFromLetter(h.marker)));
  if (styles.some((s) => s !== styles[0])) return null;

  const texts: string[] = [];
  for (let i = 0; i < hits.length; i++) {
    const end = i + 1 < hits.length ? hits[i + 1].start : line.length;
    const text = line.slice(hits[i].textStart, end).trim();
    if (text) texts.push(text);
  }

  return texts.length >= 2 ? { texts, style: styles[0] } : null;
}

function matchAnswer(line: string, options?: string[]): number | null {
  if (!line || !line.trim()) return null;

  const toIndex = (value: string): number | null => {
    if (/\d/.test(value)) {
      const n = Number(value);
      return n >= 1 && n <= 9 ? n : null;
    }
    const index = letterToIndex(value);
    return index >= 1 && index <= 8 ? index : null;
  };

  const direct = ANSWER_RE.exec(line);
  if (direct) {
    const index = toIndex(direct[1]);
    if (index !== null) return index;
  }

  const trailing = TRAILING_ANSWER_RE.exec(line);
  if (trailing) {
    const index = toIndex(trailing[1]);
    if (index !== null) return index;
  }

  // Check if line says 'Ans: <optionText>' matching one of the options (e.g. "Ans: Mitochondria" or "Ans: 180°")
  const prefixMatch = /^(?:(?:ans|answer|correct\s*(?:option|answer|choice)?|key|right\s*option)\b|(?:उत्तर|सही\s*उत्तर|हल))\s*[.:)\-:=–\t]*\s*(?:option|choice|answer|विकल्प|उत्तर|is)?\s*[.:)\-:=–\t]*(.*)$/i.exec(line);
  if (prefixMatch && options && options.length > 0) {
    const rawVal = prefixMatch[1].replace(/^[.:)\-:=–\t\s]+|[.:)\-:=–\t\s]+$/g, '').trim().toLowerCase();
    if (rawVal.length >= 2) {
      for (let i = 0; i < options.length; i++) {
        const opt = (options[i] || '').trim().toLowerCase();
        if (
          opt === rawVal ||
          (opt.length >= 3 && rawVal.includes(opt)) ||
          (rawVal.length >= 3 && opt.includes(rawVal))
        ) {
          return i + 1;
        }
      }
    }
  }

  return null;
}

/** "1. B   2. A   3. C" or "1 - B" or "Q1: B" or table lines — one line of an answer key. */
function parseAnswerKeyLine(line: string): [number, number][] {
  const pairs: [number, number][] = [];
  if (!line || !line.trim()) return pairs;

  // Regex to match question number + answer token in various formats:
  // e.g. '1. B', 'Q1: (c)', 'Question 1 - Option B', '1 = B', '1\tB', '1 (B)', '1: 2', '1.(ख)', '1. B.'
  const re =
    /(?:(?:question|ques|q|प्र|प्रश्न)\s*[.:\-–]?\s*)?(\d{1,3})\s*(?:[.)\-:=–\t]|->|=|\s+)\s*(?:option|opt|विकल्प|उत्तर|ans|answer)?\s*[:=\-–]?\s*\(?\s*([a-hA-H1-8]|क|ख|ग|घ|अ|ब|स|द)\s*\)?[.:)\-–]?/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const questionNumber = Number(m[1]);
    const ansToken = m[2];
    const answer = /\d/.test(ansToken) ? Number(ansToken) : letterToIndex(ansToken);
    if (questionNumber >= 1 && answer >= 1 && answer <= 8) {
      pairs.push([questionNumber, answer]);
    }
  }

  // Fallback: paired tokens like '1 B 2 A 3 C' or separated by tabs/commas
  if (pairs.length === 0) {
    const tokens = line.trim().split(/[\s,;\t|]+/);
    if (tokens.length >= 2 && tokens.length % 2 === 0) {
      let allPairs = true;
      const candidatePairs: [number, number][] = [];
      for (let i = 0; i < tokens.length; i += 2) {
        const qStr = tokens[i].replace(/[^\d]/g, '');
        const aStr = tokens[i + 1].replace(/[()[\].,:]/g, '');
        const qNum = Number(qStr);
        const ans = /\d/.test(aStr) ? Number(aStr) : letterToIndex(aStr);
        if (qNum >= 1 && ans >= 1 && ans <= 8) {
          candidatePairs.push([qNum, ans]);
        } else {
          allPairs = false;
          break;
        }
      }
      if (allPairs && candidatePairs.length > 0) {
        return candidatePairs;
      }
    }
  }

  return pairs;
}

interface ParseableQuestion {
  sourceNumber: number | null;
  section: string;
  questionText: string;
  options: string[];
  optionStyle: OptionStyle | null;
  correctOption: number;
  explanation: string;
  hint: string;
  diagramUrl?: string;
  diagramType?: 'image' | 'chart' | 'geometry' | 'svg';
}

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

export function parseQuestions(paragraphs: DocParagraph[]): ImportResult {
  const questions: ParseableQuestion[] = [];
  const sections: string[] = [];
  const answerKey = new Map<number, number>();

  let section = '';
  let current: ParseableQuestion | null = null;
  let answerKeyMode = false;
  let lastOption: { index: number } | null = null;
  let pendingImageUrl: string | null = null;
  /** What the previous accepted line was, so a continuation lands where a
   *  human would put it — and stray boilerplate is dropped, not shoved into
   *  an option's text. */
  let lastLineKind:
    | 'question'
    | 'option'
    | 'explanation'
    | 'hint'
    | 'answer'
    | 'heading'
    | null = null;

  const blankQuestion = (): ParseableQuestion => ({
    sourceNumber: null,
    section,
    questionText: '',
    options: [],
    optionStyle: null,
    correctOption: 0,
    explanation: '',
    hint: '',
    diagramUrl: '',
    diagramType: undefined,
  });

  const flush = (): void => {
    if (current && current.questionText.trim()) questions.push(current);
    current = null;
    lastOption = null;
    lastLineKind = null;
  };

  for (const paragraph of paragraphs) {
    if (paragraph.imageUrl) {
      if (current) {
        if (!current.diagramUrl) {
          current.diagramUrl = paragraph.imageUrl;
        }
      } else {
        pendingImageUrl = paragraph.imageUrl;
      }
    }

    // Extract any image URL embedded in text and strip it completely from the line
    const stripped = extractAndStripImageUrls(paragraph.text);
    if (stripped.imageUrl) {
      if (current) {
        if (!current.diagramUrl) current.diagramUrl = stripped.imageUrl;
      } else {
        pendingImageUrl = stripped.imageUrl;
      }
    }

    const line = stripped.cleanText.replace(/\s+/g, ' ').trim();
    if (!line || NOISE_RE.test(line)) continue;

    // ── Trailing answer key: "1. B  2. A  3. C" lines after a heading ──
    if (ANSWER_KEY_HEADING_RE.test(line)) {
      flush();
      answerKeyMode = true;
      continue;
    }
    if (answerKeyMode) {
      const pairs = parseAnswerKeyLine(line);
      if (pairs.length > 0) {
        for (const [qNum, answer] of pairs) answerKey.set(qNum, answer);
        continue;
      }
      // If line is just a single option letter in sequential answer key (e.g. "B" or "(B)"):
      const singleLetterMatch = /^\(?\s*([a-hA-H1-8]|क|ख|ग|घ|अ|ब|स|द)\s*\)?[.:)\-–]?$/.exec(line);
      if (singleLetterMatch) {
        const nextQNum = answerKey.size + 1;
        const ans = /\d/.test(singleLetterMatch[1])
          ? Number(singleLetterMatch[1])
          : letterToIndex(singleLetterMatch[1]);
        if (ans > 0) {
          answerKey.set(nextQNum, ans);
          continue;
        }
      }

      // Check if line is a table header, section heading, or informational note inside answer key
      const isHeaderOrNoise =
        /^(?:q(?:uestion)?\s*(?:no\.?|num\.?|#)?|s\.?no\.?|sr\.?no\.?|prashna|ans(?:wer)?|key|option|uttar|उत्तर|set\s+[a-z0-9]|paper|section)\b/i.test(line) ||
        SECTION_RE.test(line);
      if (isHeaderOrNoise) {
        continue;
      }

      // A real question start with question text (> 25 chars) ends answerKeyMode
      const qCheck = QUESTION_RE.exec(line) ?? NUMBERED_START_RE.exec(line);
      if (qCheck && (qCheck[2] ?? '').length > 25) {
        answerKeyMode = false;
      } else {
        continue;
      }
    } else {
      // Even without explicit heading, recognize pure answer lines (e.g. "1. B 2. C" or "1. (b)" or "1 - B")
      // especially when questions have already been parsed.
      const pairs = parseAnswerKeyLine(line);
      if (pairs.length > 0) {
        const rawBodyAfterNum = line.replace(/^(?:(?:question|ques|q|प्र|प्रश्न)\s*[.:\-–]?\s*)?\d{1,3}\s*(?:[.)\-:=–\t]|->|=)\s*/i, '').trim();
        const isShortAnswer = rawBodyAfterNum.length <= 35 && !rawBodyAfterNum.includes('?');
        if (questions.length >= 1 && (pairs.length > 1 || isShortAnswer)) {
          flush();
          answerKeyMode = true;
          for (const [qNum, answer] of pairs) answerKey.set(qNum, answer);
          continue;
        }
      }
    }

    const questionMatch = QUESTION_RE.exec(line) ?? NUMBERED_START_RE.exec(line);
    const isQuestionStart = Boolean(questionMatch && (questionMatch[2] || questionMatch[1]));

    // ── Section heading. Skipped while a question is still being dictated —
    // otherwise an ALL-CAPS continuation line would flush the question. ──
    const headingAllowed = !current || current.options.length > 0;
    if (!isQuestionStart && headingAllowed) {
      const heading = matchSection(paragraph);
      if (heading) {
        flush();
        section = heading;
        sections.push(heading);
        continue;
      }
    }

    // ── Explanation / hint / answer, attributed to the open question ──
    const target = current ?? questions[questions.length - 1] ?? null;
    if (target) {
      const explanation = EXPLANATION_RE.exec(line);
      if (explanation) {
        if (current) {
          current.explanation = [current.explanation, explanation[1]].filter(Boolean).join(' ').trim();
          lastOption = null;
          lastLineKind = 'explanation';
          continue;
        }
      }

      const hint = HINT_RE.exec(line);
      if (hint && current) {
        current.hint = [current.hint, hint[1]].filter(Boolean).join(' ').trim();
        lastOption = null;
        lastLineKind = 'hint';
        continue;
      }

      const answer = matchAnswer(line, current?.options ?? target?.options);
      if (answer !== null) {
        if (current) current.correctOption = answer;
        else target.correctOption = answer;
        lastOption = null;
        lastLineKind = 'answer';
        continue;
      }
    }

    // ── Options packed onto one line: "(a) 90 (b) 180 (c) 270 (d) 360" ──
    // Checked before the single-option matcher, which would otherwise claim
    // the line's first marker and swallow the rest as its text.
    if (!current || current.options.length === 0) {
      const inline = splitInlineOptions(line);
      if (inline) {
        if (!current) current = blankQuestion();
        current.options = inline.texts.slice(0, 6);
        current.optionStyle = inline.style;
        lastOption = { index: current.options.length - 1 };
        lastLineKind = 'option';
        continue;
      }
    }

    // ── Option lines ──
    const option = matchOption(line);
    if (current && option) {
      const continuingLetterStyle = option.style !== 'digit';
      const continuingDigitStyle =
        option.style === 'digit' &&
        (current.optionStyle === 'digit'
          ? option.number === current.options.length + 1
          : // First digit option must be "1) …" and must not itself read as a
            // question ("1. What is …?"), or a question with no options yet
            // would swallow the next question as its option 1.
            option.number === 1 && !/\?\s*$/.test(option.rest));

      if ((continuingLetterStyle || continuingDigitStyle) && current.options.length < 6) {
        // Option styles are set by the first option seen; a stray marker of a
        // different style falls through to the question-start check below.
        if (!current.optionStyle || current.optionStyle === option.style) {
          current.optionStyle = current.optionStyle ?? option.style;
          let cleanOptText = option.rest.trim();
          if (OPTION_ANSWER_MARK_RE.test(cleanOptText)) {
            current.correctOption = current.options.length + 1;
            cleanOptText = cleanOptText.replace(OPTION_ANSWER_MARK_RE, '').trim();
          }
          current.options.push(cleanOptText);
          lastOption = { index: current.options.length - 1 };
          lastLineKind = 'option';
          continue;
        }
      }
    }

    // ── A new question ──
    if (questionMatch) {
      const qNum = questionMatch[1] ? Number(questionMatch[1]) : null;
      const rawBody = (questionMatch[2] ?? '').trim();

      // Guard 1: Answer line like "1. (b)", "1. B", "1. Option B", "1. B.", "1. Ans: C", "1 = B", "1 - B", "1. (B) - Paris is capital"
      const totalExisting = questions.length + (current && current.questionText.trim() ? 1 : 0);
      const ansMatch =
        /^(?:(?:ans|answer|key|opt|option|विकल्प|उत्तर)\s*[:=\-–>]*\s*|[:=\-–>]+\s*)?\(?\s*([a-hA-H1-8]|क|ख|ग|घ|अ|ब|स|द)\s*\)?(?:\s*[.:)\-–]|\s+(?:is\s+|was\s+)?(?:the\s+)?(?:correct|answer|right|option)|$|\s+.*)/i.exec(
          rawBody
        ) ||
        /^(?:(?:ans|answer|key|उत्तर)\s*[.:\-:=–\t]*\s*(?:option|choice|answer)?\s*[.:)\-:=–\t]*\(?\s*([a-hA-H1-8]|क|ख|ग|घ|अ|ब|स|द)\s*\)?)/i.exec(
          rawBody
        );
      if (ansMatch && qNum && (qNum <= totalExisting || answerKeyMode)) {
        const ans = /\d/.test(ansMatch[1]) ? Number(ansMatch[1]) : letterToIndex(ansMatch[1]);
        if (ans > 0) {
          if (current && current.questionText.trim()) flush();
          answerKeyMode = true;
          answerKey.set(qNum, ans);

          // Extract any explanation text trailing the answer
          const trailingExpl = rawBody
            .replace(
              /^(?:(?:ans|answer|key|opt|option|विकल्प|उत्तर)\s*[:=\-–>]*\s*|[:=\-–>]+\s*)?\(?\s*([a-hA-H1-8]|क|ख|ग|घ|अ|ब|स|द)\s*\)?(?:\s*[.:)\-–]|\s+(?:is\s+|was\s+)?(?:the\s+)?(?:correct|answer|right|option))?\s*/i,
              ''
            )
            .trim();
          if (trailingExpl && questions[qNum - 1]) {
            questions[qNum - 1].explanation = [questions[qNum - 1].explanation, trailingExpl].filter(Boolean).join(' ').trim();
          }
          continue;
        }
      }

      // Guard 2: Solution line like "1. Solution: ...", "1. Explanation: ..."
      const isSolutionLine = EXPLANATION_RE.test(rawBody) || /^(?:solution|explanation|हल|उत्तर)\b/i.test(rawBody);
      if (isSolutionLine && questions.length > 0) {
        const explText = rawBody.replace(/^(?:solution|explanation|explanations|sol|soln|हल|उत्तर)\s*[.:)\-–]\s*/i, '').trim();
        if (qNum && questions[qNum - 1]) {
          questions[qNum - 1].explanation = [questions[qNum - 1].explanation, explText].filter(Boolean).join(' ').trim();
        } else if (current) {
          current.explanation = [current.explanation, explText].filter(Boolean).join(' ').trim();
        }
        continue;
      }

      flush();
      current = blankQuestion();
      current.sourceNumber = qNum;
      const strippedBody = extractAndStripImageUrls(rawBody);
      if (strippedBody.cleanText) current.questionText = strippedBody.cleanText;
      if (strippedBody.imageUrl && !current.diagramUrl) {
        current.diagramUrl = strippedBody.imageUrl;
      }
      if (pendingImageUrl) {
        current.diagramUrl = current.diagramUrl || pendingImageUrl;
        pendingImageUrl = null;
      }
      if (paragraph.imageUrl && !current.diagramUrl) {
        current.diagramUrl = paragraph.imageUrl;
      }
      lastOption = null;
      lastLineKind = 'question';
      continue;
    }

    // ── Continuation of the previous line's own content ──
    if (current) {
      if (lastLineKind === 'question') {
        current.questionText = `${current.questionText} ${line}`.trim();
      } else if (lastLineKind === 'option' && lastOption) {
        current.options[lastOption.index] = `${current.options[lastOption.index]} ${line}`.trim();
      } else if (lastLineKind === 'explanation') {
        current.explanation = `${current.explanation} ${line}`.trim();
      } else if (lastLineKind === 'hint') {
        current.hint = `${current.hint} ${line}`.trim();
      }
      // Anything else (a stray footer like "Read the instructions carefully")
      // is deliberately dropped rather than grafted onto an option.
    }
  }

  flush();

  const hasRealQuestions = questions.some((item) => item.options.length >= 2);
  const validQuestions = questions.filter((q) => {
    if (hasRealQuestions && q.options.length < 2 && !q.questionText.includes('?') && q.questionText.length < 30) {
      return false;
    }
    return Boolean(q.questionText.trim());
  });

  // Apply answer key to valid questions both by sourceNumber and by sequential 1-based index
  validQuestions.forEach((question, index) => {
    if (!question.correctOption && question.sourceNumber !== null) {
      const keyed = answerKey.get(question.sourceNumber);
      if (keyed) question.correctOption = keyed;
    }
    if (!question.correctOption) {
      const keyed = answerKey.get(index + 1);
      if (keyed) question.correctOption = keyed;
    }
  });

  const mapped: ImportedQuestion[] = validQuestions.map((q) => {
    const options = q.options.map((o) => o.trim());
    // Drop only trailing blanks (an option marker whose text never arrived);
    // interior gaps stay so option numbering cannot shift.
    while (options.length > 0 && !options[options.length - 1]) options.pop();

    const stripped = extractAndStripImageUrls(q.questionText);
    const cleanQuestionText = stripped.cleanText || q.questionText.trim();
    const finalDiagramUrl = q.diagramUrl || stripped.imageUrl;

    const isChart =
      Boolean(finalDiagramUrl) &&
      /(?:bar|pie|line|histogram|scatter|graph|chart|तालिका|चित्र|आरेख|ग्राफ)\b/i.test(cleanQuestionText);

    return {
      section: q.section,
      questionText: cleanQuestionText,
      options,
      correctOption: q.correctOption,
      explanation: q.explanation.trim(),
      hint: q.hint.trim(),
      diagramUrl: finalDiagramUrl || undefined,
      diagramType: finalDiagramUrl ? (isChart ? 'chart' : 'image') : undefined,
    };
  });

  return {
    questions: mapped,
    sections,
    hasAllAnswers: mapped.length > 0 && mapped.every((q) => q.correctOption >= 1),
  };
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export async function extractQuestionsFromFile(file: File): Promise<ImportResult> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.doc') && !name.endsWith('.docx')) {
    throw new Error('Legacy .doc files are not supported — open it in Word and save as .docx.');
  }

  if (name.endsWith('.docx')) {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const unpacked = await unpackDocx(buffer);
    const imageRelMap = buildImageRelMap(unpacked.relsXml, unpacked.media);
    const paragraphs = xmlToParagraphs(unpacked.documentXml, imageRelMap);
    return parseQuestions(paragraphs);
  }

  if (name.endsWith('.pdf')) {
    const { extractQuestionsFromPdf } = await import('./pdfImport');
    return extractQuestionsFromPdf(file);
  }

  if (name.endsWith('.txt') || name.endsWith('.md')) {
    const text = await file.text();
    const paragraphs = text
      .split(/\r?\n/)
      .map((t) => ({ text: t.replace(/\s+/g, ' ').trim(), style: '' }))
      .filter((p) => p.text);
    return parseQuestions(paragraphs);
  }

  throw new Error('Unsupported file type — upload a .docx, .pdf, .txt or .md file.');
}
