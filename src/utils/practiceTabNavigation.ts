/**
 * Detects utterances that only mean "switch to the Practice tab" — they do NOT
 * mean "start this practice drill now".
 *
 * Why this helper has to exist: `matchExamFromQuery()` (examMatcher rule 9)
 * treats the bare word "practice" as an alias for a Practice Drill, so the
 * sentence "go on the practice tab" resolves to the first drill in the catalog
 * and the assistant launches it as a live test. Navigation phrasing must be
 * recognised *before* any exam is matched from the query.
 *
 * Deliberately conservative: a bare "practice" with no page/tab cue (e.g.
 * "start practice drill") is still treated as a request to start a drill.
 * Works for English, Hinglish and Devanagari transcripts.
 */
export function isPracticeTabNavigation(rawQuery: string): boolean {
  const q = (rawQuery || '').toLowerCase().trim();
  if (!q) return false;

  // "practice", "practical", ASR-mangled "pratic", देवनागरी "प्रैक्टिस", "अभ्यास", "drill", "ड्रिल"
  const mentionsPractice =
    q.includes('practice') ||
    q.includes('practic') ||
    q.includes('pratic') ||
    q.includes('drill') ||
    q.includes('प्रैक') ||
    q.includes('अभ्यास') ||
    q.includes('ड्रिल');

  if (!mentionsPractice) return false;

  // Only an explicit tab/page/arena cue turns the request into navigation.
  return (
    q.includes('tab') ||
    q.includes('page') ||
    q.includes('टैब') ||
    q.includes('पेज') ||
    q.includes('arena') ||
    q.includes('dashboard') ||
    q.includes('screen') ||
    q.includes('अरीना') ||
    q.includes('डैशबोर्ड')
  );
}
