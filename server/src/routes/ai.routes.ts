import { Router } from 'express';
import { z } from 'zod';
import { env } from '../env.js';
import {
  NoUsableModelError,
  resetResolvedModels,
  resolveGeminiModel,
  resolveGroqModel,
  resolveWhisperModel,
} from '../services/aiModels.js';
import { audioUpload } from '../middleware/audioUpload.js';
import type { TranscribeResult } from '../../../shared/types.js';

/** Confirms a client-supplied Groq model is reachable before spending a request on it. */
async function isUsableGroq(model: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(15000),
    });
    return res.ok || res.status === 429;
  } catch {
    return false;
  }
}
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import type { AiChatResponse } from '../../../shared/types.js';

export const aiRouter = Router();

/**
 * AI proxy.
 *
 * The browser used to call Gemini and Groq directly with the API key attached.
 * That key is now only ever read here, on the server, so it is never present in
 * the client bundle and cannot be lifted by a user.
 */
aiRouter.use(requireAuth, aiLimiter);

const requestSchema = z.object({
  provider: z.enum(['gemini', 'groq']),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().min(1).max(8000),
      })
    )
    .min(1)
    .max(40),
  model: z.string().max(80).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(4096).optional(),
});

// No hardcoded default models. Every name this app used to pin has been
// retired by its provider, so availability is probed at runtime — see
// services/aiModels.ts.
/**
 * POST /api/ai/transcribe
 *
 * Server-side speech-to-text.
 *
 * The browser used to depend on SpeechRecognition, which streams audio to
 * Google's own speech service. When that service is unreachable the recogniser
 * fires `onstart` and then dies with `aborted`, having received no audio at
 * all — even though getUserMedia on the same machine peaks at 245/255, proving
 * the microphone is fine. Recording locally and transcribing here removes that
 * dependency entirely.
 */
aiRouter.post(
  '/transcribe',
  audioUpload,
  asyncHandler(async (req, res) => {
    const file = (req as unknown as { file?: { buffer: Buffer; mimetype: string; originalname: string } })
      .file;
    if (!file) throw new HttpError(400, 'no_audio', 'No audio was uploaded.');
    if (file.buffer.length < 1000) {
      throw new HttpError(400, 'audio_too_short', 'The recording was too short to transcribe.');
    }

    const key = env.GROQ_API_KEY;
    if (!key) {
      throw new HttpError(503, 'provider_unavailable', 'No transcription provider is configured.');
    }

    const model = await resolveWhisperModel();

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
      file.originalname || 'clip.webm'
    );
    form.append('model', model);
    form.append('response_format', 'json');
    form.append('temperature', '0');

    // Dynamic prompt injection & language conditioning
    const reqBody = (req.body || {}) as Record<string, unknown>;
    const clientPrompt = typeof reqBody.prompt === 'string' ? reqBody.prompt.trim() : '';
    const clientLang = typeof reqBody.language === 'string' ? reqBody.language.trim().toLowerCase() : '';

    if (clientLang && ['hi', 'en'].includes(clientLang)) {
      form.append('language', clientLang);
    }

    const isHindi = clientLang === 'hi';
    const basePrompt = isHindi
      ? 'DristiX ऑनलाइन परीक्षा वॉयस असिस्टेंट। परीक्षार्थी हिन्दी या हिंग्लिश में बोल रहे हैं: अगला सवाल, पिछला सवाल, सवाल पढ़ो, विकल्प एक, विकल्प दो, विकल्प तीन, विकल्प चार, विकल्प हटाओ, मार्क करो, सबमिट करो, समय बताओ।'
      : 'DristiX online examination voice assistant. Candidate speaks Hindi or English commands: ' +
        'Next question, previous question, read question, option 1, option 2, option 3, option 4, ' +
        'clear option, mark for review, submit test, time left, ' +
        'agla sawal, pichla sawal, sawal padho, pehla option, dusra option, teesra option, chautha option, ' +
        'hata do, mark karo, samay batao.';
    const finalPrompt = clientPrompt ? `${basePrompt} Active context: ${clientPrompt}`.slice(0, 800) : basePrompt;
    form.append('prompt', finalPrompt);

    let upstream: Response | null = null;
    let lastNetworkErr: unknown = null;

    // Retry once on transient network glitch (e.g. TCP reset or connect timeout)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        upstream = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}` },
          body: form,
          signal: AbortSignal.timeout(15000),
        });
        break;
      } catch (err: any) {
        lastNetworkErr = err;
        const isNetworkOrTimeout =
          err?.name === 'TimeoutError' ||
          err?.name === 'AbortError' ||
          err?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
          err?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
          err?.cause?.code === 'ECONNRESET' ||
          (typeof err?.message === 'string' && err.message.includes('fetch failed'));

        if (attempt < 2 && isNetworkOrTimeout) {
          console.warn(`[dristix] Groq transcription attempt ${attempt} network glitch, retrying in 300ms...`);
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }
      }
    }

    if (!upstream) {
      console.warn('[dristix] Groq transcription network unreachable / timed out:', (lastNetworkErr as Error)?.message || lastNetworkErr);
      // Graceful return: client falls back to browser recognizer without crashing or throwing a 500 error
      res.json({
        text: '',
        provider: 'groq',
        model,
      } satisfies TranscribeResult);
      return;
    }

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error('[dristix] transcription error', upstream.status, detail.slice(0, 300));
      throw new HttpError(502, 'provider_error', 'The transcription provider returned an error.');
    }

    const data = (await upstream.json()) as { text?: string };
    let rawText = (data.text ?? '').trim();

    // Guard against Whisper hallucinations on ambient noise/silence:
    // Whisper often hallucinates Korean, Chinese, Japanese, or Cyrillic on near-silent mic audio.
    // DristiX only accepts Hindi (Devanagari / Hinglish) and English.
    const hasForbiddenForeignScript =
      /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff\u0e00-\u0e7f]/.test(
        rawText
      );
    if (hasForbiddenForeignScript) {
      console.warn('[dristix] Discarded Whisper foreign language hallucination on ambient noise:', rawText);
      rawText = '';
    }

    res.json({
      text: rawText,
      provider: 'groq',
      model,
    } satisfies TranscribeResult);
  })
);

aiRouter.post(
  '/chat',
  asyncHandler(async (req, res) => {
    const body = requestSchema.parse(req.body);

    try {
      if (body.provider === 'groq') {
        try {
          res.json(await callGroq(body));
          return;
        } catch (groqErr) {
          // If Groq had a connection timeout or 502/503 and Gemini is available, fail over smoothly
          if (env.GEMINI_API_KEY) {
            console.warn('[dristix] Groq provider failed, falling over to Gemini:', (groqErr as Error)?.message);
            res.json(await callGemini(body));
            return;
          }
          throw groqErr;
        }
      }

      try {
        res.json(await callGemini(body));
      } catch (geminiErr) {
        // If Gemini had a connection timeout or 502/503 and Groq is available, fail over smoothly
        if (env.GROQ_API_KEY) {
          console.warn('[dristix] Gemini provider failed, falling over to Groq:', (geminiErr as Error)?.message);
          res.json(await callGroq(body));
          return;
        }
        throw geminiErr;
      }
    } catch (err) {
      // A retired or inaccessible model is a configuration problem worth
      // naming, not an opaque 502 the caller can do nothing with.
      if (err instanceof NoUsableModelError) {
        throw new HttpError(503, 'no_usable_model', err.message);
      }
      throw err;
    }
  })
);

async function callGroq(
  body: z.infer<typeof requestSchema>
): Promise<AiChatResponse> {
  if (!env.GROQ_API_KEY) {
    throw new HttpError(503, 'provider_unavailable', 'The Groq provider is not configured on this server.');
  }

  // A client-supplied model is only honoured if it is actually reachable,
  // otherwise a stale name from the browser would reintroduce the same 502.
  let model = body.model;
  if (model) {
    const ok = await isUsableGroq(model);
    if (!ok) model = undefined;
  }
  model ??= await resolveGroqModel();

  let response: Response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: body.messages,
        temperature: body.temperature ?? 0.4,
        max_tokens: body.maxTokens ?? 1024,
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (err: any) {
    console.error('[dristix] groq network error:', err?.message || err);
    throw new HttpError(502, 'provider_error', `Groq connection failed: ${err?.message || 'Network timeout'}`);
  }

  if (!response.ok) {
    const detail = await response.text();
    console.error('[dristix] groq error', response.status, detail.slice(0, 400));
    throw new HttpError(502, 'provider_error', 'The AI provider returned an error.');
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    model?: string;
  };

  return {
    reply: data.choices?.[0]?.message?.content?.trim() ?? '',
    provider: 'groq',
    model: data.model ?? model,
  };
}

async function callGemini(
  body: z.infer<typeof requestSchema>
): Promise<AiChatResponse> {
  if (!env.GEMINI_API_KEY) {
    throw new HttpError(503, 'provider_unavailable', 'The Gemini provider is not configured on this server.');
  }

  const model = (await resolveGeminiModel());
  const system = body.messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');
  const contents = body.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          generationConfig: {
            temperature: body.temperature ?? 0.4,
            maxOutputTokens: body.maxTokens ?? 1024,
          },
        }),
        signal: AbortSignal.timeout(25000),
      }
    );
  } catch (err: any) {
    console.error('[dristix] gemini network error:', err?.message || err);
    throw new HttpError(502, 'provider_error', `Gemini connection failed: ${err?.message || 'Network timeout'}`);
  }

  if (!response.ok) {
    const detail = await response.text();
    console.error('[dristix] gemini error', response.status, detail.slice(0, 400));
    throw new HttpError(502, 'provider_error', 'The AI provider returned an error.');
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const reply =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? '';

  return { reply, provider: 'gemini', model };
}

async function callGeminiMultimodal(
  prompt: string,
  imageData?: { mimeType: string; data: string }
): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    throw new HttpError(503, 'provider_unavailable', 'The Gemini provider is not configured on this server.');
  }

  const model = await resolveGeminiModel();
  console.log(`[dristix] gemini vision request via ${model}`);
  const parts: any[] = [];

  // Put image data FIRST so Gemini Vision processes pixels before reading instructions
  if (imageData) {
    parts.push({
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.data,
      },
    });
  }

  parts.push({ text: prompt });

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.1,
            // 1024 cut the JSON off mid-string on a plain text-only request
            // ("Unterminated string in JSON at position 1336") — the reply
            // died in keyPoints/audioNarration and could never parse.
            maxOutputTokens: 2048,
          },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );
  } catch (err) {
    // Timeout or dropped connection: the cached model may be the problem, so
    // let the next request re-resolve instead of failing the same way forever.
    console.error('[dristix] gemini vision request failed', err);
    resetResolvedModels();
    throw err;
  }

  if (!response.ok) {
    const detail = await response.text();
    console.error('[dristix] gemini vision error', response.status, detail.slice(0, 400));
    // Rate limits and provider outages invalidate the cached pick; dropping it
    // means the retry probes again and can land on a healthy model.
    if (response.status === 429 || response.status >= 500) resetResolvedModels();
    throw new HttpError(502, 'provider_error', 'The AI Vision provider returned an error.');
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };

  const candidate = data.candidates?.[0];
  const reply = candidate?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? '';

  // Name the real cause instead of letting JSON.parse report a confusing
  // "Unterminated string" on whatever partial text arrived.
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new HttpError(502, 'provider_truncated', 'The AI model ran out of output tokens and cut its reply short.');
  }
  if (!reply) {
    const blocked = data.promptFeedback?.blockReason;
    throw new HttpError(
      502,
      'provider_error',
      blocked ? `The AI provider blocked the request (${blocked}).` : 'The AI provider returned an empty reply.'
    );
  }

  return reply;
}

const explainDiagramSchema = z.object({
  questionText: z.string().min(1),
  mathLatex: z.string().optional(),
  diagramUrl: z.string().optional(),
  diagramType: z.enum(['image', 'svg', 'chart', 'geometry']).optional(),
  diagramDescription: z.string().optional(),
});

aiRouter.post(
  '/explain-diagram',
  asyncHandler(async (req, res) => {
    const body = explainDiagramSchema.parse(req.body);

    let imageData: { mimeType: string; data: string } | undefined = undefined;

    // Fetch or parse image data if diagramUrl is provided
    if (body.diagramUrl && body.diagramUrl.trim()) {
      const url = body.diagramUrl.trim();
      try {
        if (url.startsWith('data:')) {
          const match = url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            imageData = { mimeType: match[1], data: match[2] };
          } else if (url.startsWith('data:image/svg+xml')) {
            const svgText = decodeURIComponent(url.replace(/^data:image\/svg\+xml;utf8,/, ''));
            const base64 = Buffer.from(svgText).toString('base64');
            imageData = { mimeType: 'image/svg+xml', data: base64 };
          }
        } else if (url.startsWith('http://') || url.startsWith('https://')) {
          const imgRes = await fetch(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'image/*,*/*',
            },
            signal: AbortSignal.timeout(15000),
          });
          if (imgRes.ok) {
            const arrayBuf = await imgRes.arrayBuffer();
            const base64 = Buffer.from(arrayBuf).toString('base64');
            let rawType = (imgRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
            if (!rawType || !rawType.startsWith('image/')) {
              if (url.endsWith('.png')) rawType = 'image/png';
              else if (url.endsWith('.jpg') || url.endsWith('.jpeg')) rawType = 'image/jpeg';
              else if (url.endsWith('.svg')) rawType = 'image/svg+xml';
              else if (url.endsWith('.webp')) rawType = 'image/webp';
              else rawType = 'image/png';
            }
            imageData = { mimeType: rawType, data: base64 };
          } else {
            console.warn('[dristix] image HTTP fetch failed with status:', imgRes.status);
          }
        }
      } catch (err) {
        console.warn('[dristix] image fetch failed for vision analysis:', err);
      }
    }

    // An examiner explicitly asked for pixel analysis. Continuing without the
    // image would hand Gemini the vision prompt in text-only mode, where it
    // happily invents shapes and colours instead of admitting it saw nothing —
    // exactly the silent-degradation class this route was cleaned up to stop.
    if (body.diagramUrl?.trim() && !imageData) {
      throw new HttpError(
        400,
        'image_unreadable',
        'The diagram image could not be loaded or decoded, so no visual analysis was run. Please re-upload the image.'
      );
    }

    // Node decodes malformed base64 leniently (it just drops the odd
    // characters), so a corrupted data URL used to sail past the check above
    // and reach Gemini as a pixel payload Google rejects — the examiner then
    // saw a generic provider error instead of "your upload is broken".
    if (imageData) {
      const compact = imageData.data.replace(/\s+/g, '');
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact) || compact.length < 8 || compact.length % 4 !== 0) {
        throw new HttpError(
          400,
          'image_unreadable',
          'The diagram image data is not valid base64, so no visual analysis was run. Please re-upload the image.'
        );
      }
    }

    console.log(
      '[dristix] explain-diagram vision image payload:',
      imageData
        ? `${imageData.mimeType} (${Math.round(imageData.data.length / 1024)} KB base64)`
        : 'NO IMAGE DATA AVAILABLE (Gemini text-only mode)'
    );

    const prompt = `You are a Precision Screen Reader & Multimodal Vision Accessibility Engine for DristiX Adaptive Learning.
Your mission is to provide an exact, highly detailed visual scene description of ANY diagram (geometry figure, graph, chart, physics diagram, etc.) for visually impaired students so they can mentally picture every single point, line, angle, shape, or data label in the drawing.

${
  imageData
    ? `MANDATORY VISUAL INSPECTION INSTRUCTIONS:
Examine the image pixels closely and describe the EXACT visual figure step-by-step:
1. OVERALL SHAPE & LABELS: State the main shape or diagram format (e.g., Triangle, Circle, Quadrilateral, Bar Chart, Coordinate Axis). Name all visible vertices and key points (e.g. vertices P, Q, R or A, B, C, O, etc.) and their spatial positions (top, bottom-left, center, etc.).
2. MEASUREMENTS & VALUES: State all marked angles, side lengths, radius values, speeds, temperatures, or data numbers drawn in the figure (e.g., degree numbers, cm/m lengths).
3. INTERNAL LINES & MARKINGS: Inspect every line, arrow, perpendicular symbol (square box for 90°), parallel arrow, tangent, or bisector drawn in or around the figure. Describe which points they connect.
4. ABSOLUTE SCENE DESCRIPTION: Describe ONLY the actual physical drawing and visual markings. DO NOT give generic textbook theory or formula proofs unless they explicitly describe the visual elements present in this specific image.`
    : 'Analyze the question and diagram details.'
}

Question Text: ${body.questionText}
${body.mathLatex ? `Math Equation: ${body.mathLatex}` : ''}
${body.diagramDescription ? `Diagram Notes: ${body.diagramDescription}` : ''}

Respond ONLY with a valid JSON object matching this exact structure (no markdown formatting, no code blocks):
{
  "visualBreakdown": [
    "Bullet 1: Main shape/figure type with spatial arrangement of key vertices/points",
    "Bullet 2: Given measurements, angles, lengths, or data values drawn in the figure",
    "Bullet 3: Internal lines, perpendicular/parallel markings, or special features connecting the points"
  ],
  "educationalContext": "A clear, comprehensive visual description of the diagram explaining the exact positions, labeled points, angles, and lines drawn in the figure.",
  "keyPoints": [
    "Key labeled element 1",
    "Key labeled element 2"
  ],
  "audioNarration": "A fluent, clear spoken description of this specific diagram detailing all visible shapes, labeled points, marked angles, and lines designed for text-to-speech audio narration."
}`;

    let parsed: Record<string, unknown> | undefined;
    let parseError = '';

    // Two attempts, but only for malformed replies: a model occasionally cuts
    // its JSON short or wraps it in stray markdown, which is worth one retry.
    // Provider-level failures (HttpError) escape immediately — retrying those
    // inside the request would only add latency to a request that will fail.
    for (let attempt = 1; attempt <= 2 && !parsed; attempt++) {
      try {
        let reply = '';
        if (env.GEMINI_API_KEY) {
          reply = await callGeminiMultimodal(prompt, imageData);
        } else if (env.GROQ_API_KEY) {
          const groqRes = await callGroq({
            provider: 'groq',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            maxTokens: 2048,
          });
          reply = groqRes.reply;
        } else {
          throw new HttpError(503, 'provider_unavailable', 'No AI provider is configured on server.');
        }

        // Sanitize potential markdown code block formatting
        const cleanJson = reply.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
        parsed = JSON.parse(cleanJson) as Record<string, unknown>;
      } catch (err) {
        if (err instanceof HttpError) throw err;
        parseError = err instanceof Error ? err.message : String(err);
        console.error(`[dristix] explain-diagram attempt ${attempt} produced unparseable reply:`, parseError);
      }
    }

    if (!parsed) {
      // This used to answer with a canned paragraph and HTTP 200, so a dead
      // provider was indistinguishable from a successful analysis and nobody
      // ever fixed the provider. Fail with a real status instead.
      console.error('[dristix] explain-diagram failed after retries');
      throw new HttpError(502, 'ai_unavailable', `AI Vision could not analyze the diagram (${parseError}).`);
    }

    // Shape normalisation only — the analysis itself already happened.
    res.json({
      visualBreakdown: Array.isArray(parsed.visualBreakdown)
        ? (parsed.visualBreakdown as string[])
        : [body.diagramDescription || 'Visual diagram representation.'],
      educationalContext:
        typeof parsed.educationalContext === 'string' ? parsed.educationalContext : 'Diagram illustrates question geometry/data.',
      keyPoints: Array.isArray(parsed.keyPoints) ? (parsed.keyPoints as string[]) : ['Observe diagram labels carefully.'],
      audioNarration:
        typeof parsed.audioNarration === 'string'
          ? parsed.audioNarration
          : body.diagramDescription || body.questionText,
    });
  })
);

