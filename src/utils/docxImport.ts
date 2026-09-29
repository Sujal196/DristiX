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
}

export interface ImportResult {
  questions: ImportedQuestion[];
  /** Section headings found, in document order. */
  sections: string[];
  /** True when every question had an answer in the file. */
  hasAllAnswers: boolean;
}

interface DocParagraph {
  text: string;
  style: string;
}

/* ------------------------------------------------------------------ */
/* .docx unpacking                                                     */
/* ------------------------------------------------------------------ */

const DOC_XML = 'word/document.xml';

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

async function readZipEntry(bytes: Uint8Array, wanted: string): Promise<Uint8Array> {
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

  for (let n = 0; n < entryCount; n++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) break;

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));

    if (name === wanted) {
      if (view.getUint32(localOffset, true) !== 0x04034b50) {
        throw new Error('The .docx archive is damaged.');
      }
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const payload = bytes.slice(start, start + compressedSize);

      if (method === 0) return payload;
      if (method === 8) return inflateRaw(payload);
      throw new Error('This .docx uses an unsupported compression method.');
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error('No document content found inside this .docx file.');
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

/** Pulls paragraph text plus its Word style name (Heading1, Title, …). */
function xmlToParagraphs(xml: string): DocParagraph[] {
  const out: DocParagraph[] = [];
  const paragraphRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  const tokenRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>|<w:cr\b[^>]*\/>/g;

  let paragraph: RegExpExecArray | null;
  while ((paragraph = paragraphRe.exec(xml))) {
    const inner = paragraph[1];
    const style = /<w:pStyle\b[^>]*w:val="([^"]+)"/.exec(inner)?.[1] ?? '';

    let text = '';
    let token: RegExpExecArray | null;
    tokenRe.lastIndex = 0;
    while ((token = tokenRe.exec(inner))) {
      if (token[1] !== undefined) text += decodeEntities(token[1]);
      else text += token[0].startsWith('<w:tab') ? ' ' : '\n';
    }

    const flat = text.replace(/\s+/g, ' ').trim();
    if (flat) out.push({ text: flat, style });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Line classification                                                 */
/* ------------------------------------------------------------------ */

type OptionStyle = 'letter' | 'roman' | 'digit';

const NOISE_RE =
  /^(?:page\s*\d+|p\s*\.\s*\d+|www\.\S+|https?:\/\/\S+|\d{1,3}\s*\/\s*\d{1,3}|[-_=*•·~#]{3,}|\d{1,4})$/i;

const SECTION_RE =
  /^(?:section|unit|chapter|part|topic|module|block)\b[\s:.\-–]*(\d{1,2})?\s*[.:)\-–]?\s*([A-Za-z][\w '&/()/-]*)$/i;

const ANSWER_KEY_HEADING_RE = /^(?:answer\s*key|answers|key\s*(?:to|for)\b|solution\s*key)/i;

const QUESTION_RE =
  /^(?:question|ques|q)\s*[.:\-–]?\s*(\d{1,3})\s*[).:\-–]\s*(.*)$/i;

const NUMBERED_START_RE = /^(\d{1,3})\s*[).:\-–]\s*(.*)$/;

const EXPLANATION_RE =
  /^(?:explanation|explanations|explain|solution|solutions|sol|soln|approach|method|worked\s*(?:out|solution))\b\s*[.:)\-–]\s*(.*)$/i;

const HINT_RE = /^(?:hint|hints|clue|tip|remember|note)\b\s*[.:)\-–]\s*(.*)$/i;

const ANSWER_RE =
  /^(?:ans|answer|correct\s*(?:option|answer|choice)?|key|right\s*option)\b\s*[.:)\-–]*\s*(?:option|choice|answer|is)?\s*[.:)\-–]*\s*\(?\s*([a-h]|(?:\d{1,2}))\s*\)?/i;

/** "(b) is the answer" — the marker leads instead of the word "Answer". */
const TRAILING_ANSWER_RE = /^\(?\s*([a-hA-H])\s*\)?\s+(?:is\s+)?(?:the\s+)?(?:correct\s+|right\s+)?answer/i;

/** A correct option can be flagged by "(correct)", "✓" or a standalone "*". */
const OPTION_ANSWER_MARK_RE =
  /\((?:correct|answer|right|key)\)|\[answer\]|✔|✓|(?:^|\s)\*(?:\s|$)/i;

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
  let m = /^\(([a-zA-Z]{1,4})\)\s*(.*)$/.exec(line);
  if (m) {
    const style = styleFromLetter(m[1]);
    return { style, number: letterToIndex(m[1]), rest: m[2], raw: m[0] };
  }

  // a) text / A. text / a. text  (single letter followed by a separator)
  m = /^([a-zA-Z])\s*[).:\-–]\s*(.*)$/.exec(line);
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
  const code = marker.toLowerCase().charCodeAt(0) - 97;
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
  const markerRe = /(^|\s)(?:\(([a-zA-Z]{1,4}|\d{1,2})\)|([a-zA-Z]|\d{1,2})[).:\-–])\s*/g;
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

function matchAnswer(line: string): number | null {
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

  return null;
}

/** "1. B   2. A   3. C" — one line of a trailing answer key. */
function parseAnswerKeyLine(line: string): [number, number][] {
  const pairs: [number, number][] = [];
  const re = /(\d{1,3})\s*[.)\-:]\s*\(?\s*([a-hA-H]|\d{1,2})\s*\)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const questionNumber = Number(m[1]);
    const answer = /\d/.test(m[2]) ? Number(m[2]) : letterToIndex(m[2]);
    if (questionNumber >= 1 && answer >= 1) pairs.push([questionNumber, answer]);
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
  });

  const flush = (): void => {
    if (current && current.questionText.trim()) questions.push(current);
    current = null;
    lastOption = null;
    lastLineKind = null;
  };

  for (const paragraph of paragraphs) {
    const line = paragraph.text.replace(/\s+/g, ' ').trim();
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
      answerKeyMode = false; // a real content line ends the key block
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

      const answer = matchAnswer(line);
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
          current.options.push(option.rest.trim());
          lastOption = { index: current.options.length - 1 };
          lastLineKind = 'option';
          if (OPTION_ANSWER_MARK_RE.test(option.rest)) current.correctOption = current.options.length;
          continue;
        }
      }
    }

    // ── A new question ──
    if (questionMatch) {
      flush();
      current = blankQuestion();
      current.sourceNumber = questionMatch[1] ? Number(questionMatch[1]) : null;
      const body = (questionMatch[2] ?? '').trim();
      if (body) current.questionText = body;
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

  // Answers recorded before their question (or listed in a key) land here.
  for (const question of questions) {
    if (!question.correctOption && question.sourceNumber !== null) {
      const keyed = answerKey.get(question.sourceNumber);
      if (keyed) question.correctOption = keyed;
    }
  }

  // Renumber sequentially so answers keyed by position still line up when the
  // document's own numbering restarted or skipped.
  if (answerKey.size > 0 && questions.some((q) => !q.correctOption)) {
    questions.forEach((question, index) => {
      if (!question.correctOption) {
        const keyed = answerKey.get(index + 1);
        if (keyed) question.correctOption = keyed;
      }
    });
  }

  const mapped: ImportedQuestion[] = questions.map((q) => {
    const options = q.options.map((o) => o.trim());
    // Drop only trailing blanks (an option marker whose text never arrived);
    // interior gaps stay so option numbering cannot shift.
    while (options.length > 0 && !options[options.length - 1]) options.pop();

    return {
      section: q.section,
      questionText: q.questionText.trim(),
      options,
      correctOption: q.correctOption,
      explanation: q.explanation.trim(),
      hint: q.hint.trim(),
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
    const xml = new TextDecoder('utf-8').decode(await readZipEntry(buffer, DOC_XML));
    return parseQuestions(xmlToParagraphs(xml));
  }

  if (name.endsWith('.txt') || name.endsWith('.md')) {
    const text = await file.text();
    const paragraphs = text
      .split(/\r?\n/)
      .map((t) => ({ text: t.replace(/\s+/g, ' ').trim(), style: '' }))
      .filter((p) => p.text);
    return parseQuestions(paragraphs);
  }

  throw new Error('Unsupported file type — upload a .docx, .txt or .md file.');
}
