import { env } from '../env.js';

/**
 * Resolves a model that the configured key can actually use.
 *
 * This exists because every model name this app used to hardcode has since
 * been retired: `gemini-2.0-flash`, `gemini-1.5-flash` and `gemini-1.5-pro`
 * all return 404, and Groq's `llama-3.3-70b-versatile` is not available to
 * the configured key. Hardcoding a model name means the assistant silently
 * stops working the day the provider retires it, so availability is probed at
 * runtime and the working model is cached for the process.
 */

export class NoUsableModelError extends Error {
  constructor(provider: string, tried: string[]) {
    super(
      `No usable model for ${provider}. Tried: ${tried.join(', ')}. Check which models the configured key has access to.`
    );
    this.name = 'NoUsableModelError';
  }
}

/** Fast models first — this path is used while a student is mid-sentence. */
const GEMINI_CANDIDATES = [
  'gemini-3-flash-preview',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
];

/**
 * Valid Groq model candidates for general text generation and voice command processing.
 */
const GROQ_CANDIDATES = [
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b',
  'allam-2-7b',
  'openai/gpt-oss-20b',
];

/**
 * Races every candidate at once and returns the first success in priority
 * order.
 *
 * Probing serially meant a cold server paid for up to four 15-second timeouts
 * before it could answer anything — an admin clicking "Analyze Image" waited
 * a minute and gave up. Firing them all concurrently keeps the priority list's
 * ordering (an earlier candidate still wins) while the wall-clock cost is a
 * single probe's latency. Resolving early — as soon as every better candidate
 * has provably failed — means a fast first hit is not held hostage by a
 * slower probe still in flight.
 */
async function firstUsable(
  candidates: string[],
  probe: (model: string) => Promise<boolean>
): Promise<string | null> {
  // An empty list would otherwise leave the promise pending forever and hang
  // the request — the Groq path can genuinely produce one when the provider's
  // model listing comes back without anything usable.
  if (candidates.length === 0) return null;

  const results = new Array<boolean | undefined>(candidates.length).fill(undefined);

  return new Promise<string | null>((resolve) => {
    const settle = (): void => {
      for (let i = 0; i < candidates.length; i++) {
        if (results[i] === true) {
          resolve(candidates[i]);
          return;
        }
        if (results[i] === undefined) return; // still probing — a better candidate may yet win
      }
      resolve(null);
    };

    for (let i = 0; i < candidates.length; i++) {
      // Rejections are folded to `false`: a probe that threw would otherwise
      // sit `undefined` forever and stall resolution.
      void Promise.resolve(probe(candidates[i])).then(
        (ok) => {
          results[i] = ok;
          settle();
        },
        () => {
          results[i] = false;
          settle();
        }
      );
    }
  });
}

let geminiModel: string | null = null;
let groqModel: string | null = null;
let whisperModel: string | null = null;

/**
 * Whisper models handle both Hindi and English in a single pass, so the
 * browser never has to negotiate a locale. The turbo variant is listed first
 * because it is roughly four times faster and this runs mid-sentence.
 */
const WHISPER_CANDIDATES = ['whisper-large-v3-turbo', 'whisper-large-v3'];

/** Returns a Whisper model this key can call, caching the result. */
export async function resolveWhisperModel(): Promise<string> {
  if (whisperModel) return whisperModel;
  const key = env.GROQ_API_KEY;
  if (!key) throw new NoUsableModelError('whisper', []);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const data = (await res.json()) as { data?: { id: string }[] };
      const available = new Set((data.data ?? []).map((m) => m.id));
      const ordered = [
        ...WHISPER_CANDIDATES.filter((c) => available.has(c)),
        ...(data.data ?? []).map((m) => m.id).filter((id) => id.startsWith('whisper')),
      ];
      for (const model of ordered) {
        whisperModel = model;
        return model;
      }
    }
  } catch {
    // fall through to the static list
  }

  whisperModel = WHISPER_CANDIDATES[0];
  return whisperModel;
}

async function probeGemini(model: string, key: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function probeGroq(model: string, key: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(15000),
    });
    // 429 means the model exists but is rate limited — still usable.
    return res.ok || res.status === 429;
  } catch {
    return false;
  }
}

/**
 * Returns a Gemini model this key can call, caching the result.
 *
 * The provider's listModels endpoint advertises models that then 404 on
 * generateContent, so availability is confirmed with a real one-token call
 * rather than trusted from the listing.
 */
export async function resolveGeminiModel(): Promise<string> {
  if (geminiModel) return geminiModel;
  const key = env.GEMINI_API_KEY;
  if (!key) throw new NoUsableModelError('gemini', []);

  const hit = await firstUsable(GEMINI_CANDIDATES, (model) => probeGemini(model, key));
  if (hit) {
    geminiModel = hit;
    return hit;
  }

  // Nothing from the preference list worked. Fall back to whatever the
  // provider currently advertises, so a brand new model still gets picked up.
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (res.ok) {
      const data = (await res.json()) as { models?: { name: string }[] };
      const advertised = (data.models ?? [])
        .map((m) => m.name.replace(/^models\//, ''))
        .filter((n) => n.includes('flash') && !n.includes('tts') && !n.includes('image'));

      for (const model of advertised) {
        if (await probeGemini(model, key)) {
          geminiModel = model;
          return model;
        }
      }
    }
  } catch {
    // fall through to the error below
  }

  throw new NoUsableModelError('gemini', GEMINI_CANDIDATES);
}

/** Returns a Groq chat model this key can call, caching the result. */
export async function resolveGroqModel(): Promise<string> {
  if (groqModel) return groqModel;
  const key = env.GROQ_API_KEY;
  if (!key) throw new NoUsableModelError('groq', []);

  // Prefer the known-good list, then intersect with what the key exposes so we
  // never pick a model that will 404.
  let candidates = GROQ_CANDIDATES;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const data = (await res.json()) as { data?: { id: string }[] };
      const available = new Set((data.data ?? []).map((m) => m.id));
      const advertised = (data.data ?? [])
        .map((m) => m.id)
        .filter((id) => !id.includes('whisper') && !id.includes('guard') && !id.includes('safeguard'));
      candidates = [...GROQ_CANDIDATES.filter((c) => available.has(c)), ...advertised];
    }
  } catch {
    // fall back to the hardcoded candidates
  }

  const hit = await firstUsable(candidates, (model) => probeGroq(model, key));
  if (hit) {
    groqModel = hit;
    return hit;
  }

  throw new NoUsableModelError('groq', candidates);}

/** Test hook: forgets resolved models so a restart is not needed after a key change. */
export function resetResolvedModels(): void {
  geminiModel = null;
  groqModel = null;
  whisperModel = null;
}
