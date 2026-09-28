import { Router } from 'express';
import { z } from 'zod';
import { env } from '../env.js';
import {
  NoUsableModelError,
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

    const upstream = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(30000),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error('[dristix] transcription error', upstream.status, detail.slice(0, 300));
      throw new HttpError(502, 'provider_error', 'The transcription provider returned an error.');
    }

    const data = (await upstream.json()) as { text?: string };
    res.json({
      text: (data.text ?? '').trim(),
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
        res.json(await callGroq(body));
        return;
      }
      res.json(await callGemini(body));
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

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
  });

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

  const response = await fetch(
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
    }
  );

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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error('[dristix] gemini vision error', response.status, detail.slice(0, 400));
    throw new HttpError(502, 'provider_error', 'The AI Vision provider returned an error.');
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? '';
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

    let reply = '';
    try {
      if (env.GEMINI_API_KEY) {
        reply = await callGeminiMultimodal(prompt, imageData);
      } else if (env.GROQ_API_KEY) {
        const groqRes = await callGroq({
          provider: 'groq',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          maxTokens: 1024,
        });
        reply = groqRes.reply;
      } else {
        throw new HttpError(503, 'provider_unavailable', 'No AI provider is configured on server.');
      }

      // Sanitize potential markdown code block formatting
      let cleanJson = reply.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
      let parsed = JSON.parse(cleanJson);

      res.json({
        visualBreakdown: Array.isArray(parsed.visualBreakdown) ? parsed.visualBreakdown : [body.diagramDescription || 'Visual diagram representation.'],
        educationalContext: typeof parsed.educationalContext === 'string' ? parsed.educationalContext : 'Diagram illustrates question geometry/data.',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : ['Observe diagram labels carefully.'],
        audioNarration: typeof parsed.audioNarration === 'string' ? parsed.audioNarration : (body.diagramDescription || body.questionText),
      });
    } catch (err: any) {
      console.error('[dristix] explain-diagram fallback triggered', err);
      // Smart offline / fallback diagram breakdown
      const fallbackDesc = body.diagramDescription || 'Diagram illustration for question.';
      res.json({
        visualBreakdown: [
          `Format: ${body.diagramType || 'Visual Diagram'}`,
          `Overview: ${fallbackDesc}`,
          `Formula Context: ${body.mathLatex || 'Standard Geometry/Data'}`
        ],
        educationalContext: `The diagram provides visual context for: "${body.questionText}". Key values and geometric/data positions should be used to apply the relevant formula.`,
        keyPoints: [
          'Identify given variables from the diagram.',
          'Apply step-by-step problem-solving methods.',
          'Verify calculated values against options.'
        ],
        audioNarration: `Diagram explanation: ${fallbackDesc}. Question states ${body.questionText}.`,
      });
    }
  })
);

