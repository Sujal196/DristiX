import type { Exam } from '../data/exams';

/**
 * Universal High-Accuracy Dynamic Exam Matcher.
 * Matches:
 * 1. Exact model parameter (ID, Code, Title)
 * 2. Admin-created custom exams by exact title or cleaned title
 * 3. 2-3 letter acronyms (NDA, CAT, JEE, NET, CDS, GATE, NEET, etc.)
 * 4. Specific known national exams & multilingual aliases (UPSC, RRB, IBPS, SSC)
 * 5. Dynamic numerical/ordinal indices (Exam 1 through Exam 50+, "5th test", "paanchwa")
 * 6. High-specificity token overlap scoring so any newly created admin exam opens instantly.
 */
export function matchExamFromQuery(
  rawQuery: string,
  param: string | number | null | undefined,
  allExams: Exam[]
): Exam | null {
  if (!allExams || allExams.length === 0) return null;

  const query = (rawQuery || '').toLowerCase().trim();
  const p = String(param || '').toLowerCase().trim();
  const combined = `${p} ${query}`.toLowerCase();

  // 1. Direct ID / Code / Exact Title Match from Model Parameter
  if (p && p !== 'null' && p !== 'undefined') {
    const directMatch = allExams.find(
      (e) =>
        e.id.toLowerCase() === p ||
        e.code.toLowerCase() === p ||
        e.title.toLowerCase() === p
    );
    if (directMatch) return directMatch;
  }

  // 2. Direct Substring ID or Code Match in User Query
  for (const exam of allExams) {
    const idLower = exam.id.toLowerCase();
    const codeLower = exam.code.toLowerCase();
    if (combined.includes(idLower) || (codeLower.length >= 3 && combined.includes(codeLower))) {
      return exam;
    }
  }

  // 3. Exact Full Title or Cleaned Core Title in Query
  // Checks if the user uttered the full or core title of any exam (including newly added admin exams)
  const commonBoilerplate = /\b(mock|test|exam|examination|series|paper|drill|practice|full|tier|tier-1|tier-2|2024|2025|2026|set\s*[a-z0-9]?)\b/gi;

  for (const exam of allExams) {
    const titleLower = exam.title.toLowerCase();
    if (combined.includes(titleLower)) {
      return exam;
    }

    const coreTitle = titleLower.replace(commonBoilerplate, '').replace(/\s+/g, ' ').trim();
    if (coreTitle.length >= 3 && combined.includes(coreTitle)) {
      return exam;
    }
  }

  // 4. Code Token Substrings (e.g. Code is "NDA-01" or "GATE-CS", user says "NDA" or "GATE")
  for (const exam of allExams) {
    const codeTokens = exam.code
      .toLowerCase()
      .split(/[-_\s]+/)
      .filter((t) => t.length >= 3 && !['test', 'mock', 'exam', 'set'].includes(t));
    if (codeTokens.some((t) => new RegExp(`\\b${t}\\b`, 'i').test(combined))) {
      return exam;
    }
  }

  // 5. UPSC / Civil Services / CSAT Multilingual & Phonetic Aliases
  const isUPSC =
    combined.includes('upsc') ||
    combined.includes('u.p.s.c') ||
    combined.includes('u p s c') ||
    combined.includes('up sc') ||
    combined.includes('civil service') ||
    combined.includes('civil services') ||
    combined.includes('civil') ||
    combined.includes('सिविल सेवा') ||
    combined.includes('सिविल') ||
    combined.includes('सिविल्स') ||
    combined.includes('यूपीएससी') ||
    combined.includes('सीसैट') ||
    combined.includes('csat') ||
    combined.includes('ias') ||
    combined.includes('ips') ||
    combined.includes('paper 2') ||
    combined.includes('paper-2') ||
    combined.includes('paper2') ||
    combined.includes('paper ii');

  if (isUPSC) {
    const upsc = allExams.find(
      (e) =>
        e.id.includes('upsc') ||
        e.code.includes('CSAT') ||
        e.title.toLowerCase().includes('civil services') ||
        e.title.toLowerCase().includes('upsc')
    );
    if (upsc) return upsc;
  }

  // 6. Railway / RRB NTPC Aliases
  const isRailway =
    combined.includes('rrb') ||
    combined.includes('ntpc') ||
    combined.includes('railway') ||
    combined.includes('railways') ||
    combined.includes('rail') ||
    combined.includes('आरआरबी') ||
    combined.includes('एनटीपीसी') ||
    combined.includes('रेलवे');

  if (isRailway) {
    const rrb = allExams.find(
      (e) =>
        e.id.includes('rrb') ||
        e.code.includes('RRB') ||
        e.title.toLowerCase().includes('rrb') ||
        e.title.toLowerCase().includes('railway')
    );
    if (rrb) return rrb;
  }

  // 7. IBPS / Banking & Insurance Aliases
  const isBanking =
    combined.includes('ibps') ||
    combined.includes('banking') ||
    combined.includes('आईबीपीएस') ||
    combined.includes('पीओ') ||
    combined.includes('बैंकिंग') ||
    combined.includes('bank') ||
    combined.includes('बैंक') ||
    (combined.includes('po') && !combined.includes('open') && !combined.includes('report'));

  if (isBanking) {
    const ibps = allExams.find(
      (e) =>
        e.id.includes('ibps') ||
        e.code.includes('IBPS') ||
        e.title.toLowerCase().includes('ibps') ||
        e.title.toLowerCase().includes('bank')
    );
    if (ibps) return ibps;
  }

  // 8. SSC CGL / Staff Selection Aliases
  const isSSC =
    combined.includes('ssc') ||
    combined.includes('cgl') ||
    combined.includes('एसएससी') ||
    combined.includes('सीजीएल') ||
    combined.includes('staff selection') ||
    combined.includes('tier 1') ||
    combined.includes('tier-1') ||
    combined.includes('tier1');

  if (isSSC) {
    const ssc = allExams.find(
      (e) =>
        e.id.includes('ssc') ||
        e.code.includes('SSC') ||
        e.title.toLowerCase().includes('ssc') ||
        e.title.toLowerCase().includes('cgl')
    );
    if (ssc) return ssc;
  }

  // 9. Practice Drills / Topic-wise Arena
  const isPractice =
    combined.includes('practice') ||
    combined.includes('drill') ||
    combined.includes('अभ्यास') ||
    combined.includes('arithmetic') ||
    combined.includes('syllogism') ||
    combined.includes('grammar');

  if (isPractice) {
    const practice = allExams.find((e) => e.id.includes('practice'));
    if (practice) return practice;
  }

  // 10. Dynamic Numerical Position & Ordinal Matching (Exam 1, Test 2, Exam 5, 6th Test, etc.)
  // Matches "exam 1", "test 3", "exam 5", "test 10"
  const numMatch = combined.match(/\b(?:exam|test|number|no\.?)\s*(\d+)\b/i);
  if (numMatch && numMatch[1]) {
    const targetIdx = parseInt(numMatch[1], 10) - 1;
    if (targetIdx >= 0 && targetIdx < allExams.length) {
      return allExams[targetIdx];
    }
  }

  // Matches "1st exam", "2nd test", "5th test", "10th exam"
  const ordMatch = combined.match(/\b(\d+)(?:st|nd|rd|th)\s*(?:exam|test)?\b/i);
  if (ordMatch && ordMatch[1]) {
    const targetIdx = parseInt(ordMatch[1], 10) - 1;
    if (targetIdx >= 0 && targetIdx < allExams.length) {
      return allExams[targetIdx];
    }
  }

  // Hindi ordinals (pehla, dusra, teesra, chautha, paanchwa, chhatha, saatwa, aathwa)
  const hindiOrdinals: { [key: string]: number } = {
    pehla: 0,
    pehli: 0,
    first: 0,
    dusra: 1,
    doosra: 1,
    dusri: 1,
    second: 1,
    teesra: 2,
    teesri: 2,
    third: 2,
    chautha: 3,
    chauthi: 3,
    fourth: 3,
    paanchwa: 4,
    panchwa: 4,
    fifth: 4,
    chhatha: 5,
    sixth: 5,
    saatwa: 6,
    seventh: 6,
    aathwa: 7,
    eighth: 7,
  };

  for (const [word, idx] of Object.entries(hindiOrdinals)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(combined) && idx < allExams.length) {
      return allExams[idx];
    }
  }

  // 11. Highest-Specificity Dynamic Token Overlap (For ANY Admin-Created Exam)
  // Scores every available exam based on how many distinct meaningful words from its title appear in the query
  let bestExam: Exam | null = null;
  let highestScore = 0;

  for (const exam of allExams) {
    const words = exam.title
      .toLowerCase()
      .split(/[\s\-:,/]+/)
      .map((w) => w.replace(/[^a-z0-9]/gi, ''))
      .filter((w) => w.length >= 3 && !['test', 'mock', 'exam', 'paper', 'series', 'drill', 'open', 'start'].includes(w));

    let score = 0;
    for (const w of words) {
      if (new RegExp(`\\b${w}\\b`, 'i').test(combined) || combined.includes(w)) {
        // Boost short unique acronyms (e.g. "nda", "cat", "gate", "neet", "ctet")
        score += w.length <= 4 ? 3 : 2;
      }
    }

    if (score > highestScore && score >= 2) {
      highestScore = score;
      bestExam = exam;
    }
  }

  if (bestExam) {
    return bestExam;
  }

  return null;
}

