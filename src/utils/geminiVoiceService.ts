import { getAssistantContext } from './assistantContext';
import { useExamStore } from '../store/useExamStore';
import { useAnnouncerStore } from '../store/useAnnouncerStore';
import { soundEffects } from './soundEffects';
import { buildFullQuestionSpeech } from './voiceCommandProcessor';
import type { CommandProcessResult } from './voiceCommandProcessor';
import { describeOptionSelection, describeClearSelection } from './optionSpeech';
import { matchExamFromQuery } from './examMatcher';
import { isPracticeTabNavigation } from './practiceTabNavigation';
import { getDataSource } from '../services/dataSource';

const API_KEY_STORAGE = 'dristix_gemini_api_key';
const GROQ_API_KEY_STORAGE = 'dristix_groq_api_key';

/**
 * NO API KEYS LIVE IN THE BROWSER BUNDLE ANY MORE.
 *
 * These two constants used to read `import.meta.env.VITE_*`, which Vite inlines
 * into the JavaScript at build time — readable by anyone who opened DevTools,
 * and burnable from their own machine. Both are now empty by definition; the
 * keys live only in `server/.env` and the browser talks to `/api/ai/*`.
 *
 * They remain exported because offline mode has no server, and a developer may
 * still opt into a BYO-key path by typing a key into the orb, which is stored in
 * localStorage and never shipped.
 */
export const DEFAULT_GEMINI_API_KEY = '';
export const DEFAULT_GROQ_API_KEY = '';

export interface GeminiParsedCommand {
  action:
    | 'SELECT_OPTION'
    | 'CLEAR_OPTION'
    | 'NEXT_QUESTION'
    | 'PREVIOUS_QUESTION'
    | 'JUMP_QUESTION'
    | 'MARK_REVIEW'
    | 'READ_QUESTION'
    | 'CHECK_TIMER'
    | 'SUBMIT_EXAM'
    | 'FINAL_SUBMIT'
    | 'CONTINUE_EXAM'
    | 'START_EXAM'
    | 'HINT'
    | 'EXPLANATION'
    | 'ANALYTICS'
    | 'LIST_EXAMS'
    | 'EXAM_INTEGRITY_REFUSAL'
    | 'GENERAL_QUERY';
  param?: number | string | null;
  transcript: string;
  reply: string;
}

class GeminiVoiceService {
  private apiKey: string = DEFAULT_GEMINI_API_KEY;
  private groqApiKey: string = DEFAULT_GROQ_API_KEY;
  private discoveredModels: string[] = [];
  private groqActiveModels: string[] = [];
  private lastApiError: string = '';
  private activeAbortController: AbortController | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // A BYO key is opt-in and lives only in this browser's localStorage.
      // In api mode the server holds the real key and the proxy is used instead.
      const stored = localStorage.getItem(API_KEY_STORAGE);
      this.apiKey = (stored || DEFAULT_GEMINI_API_KEY)
        .trim()
        .replace(/^["']|["']$/g, '')
        .trim();

      const storedGroq = localStorage.getItem(GROQ_API_KEY_STORAGE);
      this.groqApiKey = (storedGroq || DEFAULT_GROQ_API_KEY)
        .trim()
        .replace(/^["']|["']$/g, '')
        .trim();

      if (this.hasApiKey()) {
        this.validateApiKey();
      }
      if (this.groqApiKey) {
        this.discoverGroqModels();
      }
    }
  }

  /**
   * True when calls should go through the server proxy rather than directly.
   * The proxy is what keeps the provider key off the client.
   */
  private get usesProxy(): boolean {
    return !this.apiKey;
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public getGroqApiKey(): string {
    return this.groqApiKey;
  }

  public getLastApiError(): string {
    return this.lastApiError;
  }

  public setApiKey(key: string) {
    this.apiKey = (key || '').trim().replace(/^["']|["']$/g, '').trim();
    if (typeof window !== 'undefined') {
      if (this.apiKey) {
        localStorage.setItem(API_KEY_STORAGE, this.apiKey);
        this.validateApiKey();
      } else {
        localStorage.removeItem(API_KEY_STORAGE);
        this.discoveredModels = [];
        this.lastApiError = '';
      }
    }
  }

  public setGroqApiKey(key: string) {
    this.groqApiKey = (key || DEFAULT_GROQ_API_KEY).trim().replace(/^["']|["']$/g, '').trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem(GROQ_API_KEY_STORAGE, this.groqApiKey);
    }
  }

  /**
   * Whether the conversational path can be used.
   *
   * The provider keys now live on the server and requests go through the
   * /api/ai proxy, so this must no longer mean "a key is present in the
   * browser" — that check is permanently false and silently disabled the entire
   * assistant. True whenever either the proxy or a developer-supplied key can
   * serve the request.
   */
  public hasApiKey(): boolean {
    return this.usesProxy || this.getApiKey().length > 10 || this.getGroqApiKey().length > 10;
  }

  /**
   * True only when a key was supplied directly in the browser. Gates the audio
   * upload path, which cannot work through the proxy because it needs the key
   * in the browser to sign the request.
   */
  public hasValidGeminiKey(): boolean {
    const cleanGemini = this.apiKey.trim().replace(/^["']|["']$/g, '').trim();
    return cleanGemini.startsWith('AIzaSy') && cleanGemini.length > 25;
  }

  /**
   * Validate key against Google AI Studio / Generative Language API and discover supported models
   */
  public async validateApiKey(keyToTest?: string): Promise<{ ok: boolean; message: string; models?: string[] }> {
    const key = (keyToTest !== undefined ? keyToTest : this.apiKey).trim().replace(/^["']|["']$/g, '').trim();
    if (!key || key.length < 10) {
      return { ok: false, message: 'API key is too short or empty.' };
    }

    try {
      const endpoints = [
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
        `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(key)}`,
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': key,
            },
          });

          if (response.ok) {
            const data = await response.json();
            const models: string[] = (data?.models || [])
              .filter((m: any) => {
                const name = (m.name || '').toLowerCase();
                const methods = m.supportedGenerationMethods || [];
                if (!methods.includes('generateContent')) return false;
                // Only allow gemini-flash and gemini-pro models (NOT gemma — gemma doesn't support audio)
                // Also exclude tts, preview, embedding, imagen models
                if (
                  name.includes('gemma') ||
                  name.includes('tts') ||
                  name.includes('preview') ||
                  name.includes('embedding') ||
                  name.includes('imagen') ||
                  name.includes('aqa')
                ) {
                  return false;
                }
                // Must be a gemini model
                if (!name.includes('gemini')) return false;
                return true;
              })
              .map((m: any) => (m.name || '').replace(/^models\//, ''));

            this.discoveredModels = models;
            this.lastApiError = '';
            console.log('✅ Gemini API Key verified! Supported models:', models);
            return {
              ok: true,
              message: `Connected successfully! (Using: gemini-1.5-flash)`,
              models,
            };
          } else {
            const errText = await response.text();
            let parsedMsg = `Status ${response.status}`;
            try {
              const errObj = JSON.parse(errText);
              if (errObj.error?.message) {
                parsedMsg = errObj.error.message;
              }
            } catch {}
            this.lastApiError = parsedMsg;
            console.warn(`[Gemini API Check] Endpoint ${endpoint} returned ${response.status}:`, parsedMsg);
          }
        } catch (innerErr: any) {
          console.warn('[Gemini API Check] Connection attempt failed:', innerErr);
        }
      }

      return {
        ok: false,
        message: this.lastApiError || 'Failed to authenticate with Google Generative Language API.',
      };
    } catch (err: any) {
      this.lastApiError = err?.message || 'Network error connecting to Google API';
      return { ok: false, message: this.lastApiError };
    }
  }

  /**
   * Parses a model's JSON reply.
   *
   * A bare JSON.parse is not enough: even when asked for JSON only, models
   * sometimes wrap the object in a ```json fence or prefix it with a sentence,
   * and the command was then silently dropped. This unwraps those cases, and
   * falls back to the first balanced {...} block if the text is still not pure
   * JSON. Shared by every path that reads a model reply so a malformed reply
   * fails the same way everywhere.
   */
  private parseCommandJson(content: string): GeminiParsedCommand | null {
    if (typeof content !== 'string' || !content.trim()) return null;

    const candidates: string[] = [];
    const raw = content.trim();

    // Strip a markdown code fence: ```json ... ``` or ``` ... ```
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]?.trim()) candidates.push(fence[1].trim());

    candidates.push(raw);

    // Any balanced object, for replies with stray prose around it.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end > start) candidates.push(raw.slice(start, end + 1));

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate) as GeminiParsedCommand;
        if (parsed && typeof parsed.action === 'string') return parsed;
      } catch {
        // try the next candidate
      }
    }

    console.warn('[VoiceService] could not parse model reply as a command:', raw.slice(0, 160));
    return null;
  }

  /**
   * Sends the Gemini request through our own backend instead of Google
   * directly. This is the path that keeps the provider key on the server: the
   * browser authenticates to us with a normal access token and never sees the
   * upstream key at all.
   */
  private async executeViaProxy(payload: any): Promise<any> {
    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch {}
    }
    const abortController = new AbortController();
    this.activeAbortController = abortController;

    const timeoutId = setTimeout(() => {
      try {
        abortController.abort();
      } catch {}
    }, 6000);

    try {
      const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];
      if (payload?.systemInstruction?.parts?.[0]?.text) {
        messages.push({ role: 'system', content: payload.systemInstruction.parts[0].text });
      }
      for (const c of payload?.contents ?? []) {
        const text = (c?.parts ?? []).map((p: any) => p?.text ?? '').join('').trim();
        if (text) messages.push({ role: c?.role === 'model' ? 'assistant' : 'user', content: text });
      }
      if (messages.length === 0) return null;

      const data = await getDataSource().ai.chat({
        provider: 'gemini',
        messages,
        model: payload?.model,
        temperature: payload?.generationConfig?.temperature,
        maxTokens: payload?.generationConfig?.maxOutputTokens,
      });

      if (abortController.signal.aborted) return null;

      // Shaped like a real Gemini response so every existing parsing path
      // downstream keeps working without being aware of the proxy.
      return {
        candidates: [{ content: { parts: [{ text: data.reply }] } }],
      };
    } catch (err: any) {
      this.lastApiError = err?.message || 'The AI assistant proxy is unavailable.';
      console.warn('[GeminiProxy] request failed:', err?.message ?? err);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fast, reliable multi-model caller.
   * Immediately aborts any previous pending request and enforces a strict 4.2s timeout
   * so requests never hang, accumulate in background queues, or fire late.
   */
  private async executeGenerateContent(payload: any): Promise<any> {
    const cleanKey = this.apiKey.trim().replace(/^["']|["']$/g, '').trim();

    // Proxy path: no key on the client, the server holds it. Extracted here so
    // the rest of the multi-model logic below is unchanged.
    if (this.usesProxy) return this.executeViaProxy(payload);

    if (!cleanKey) return null;

    // 1. Immediately abort prior in-flight request so earlier spoken commands never linger
    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch {}
    }

    const abortController = new AbortController();
    this.activeAbortController = abortController;

    // 2. High-speed models, newest first.
    //
    // The previous list (gemini-1.5-flash / 2.0-flash / 1.5-pro) has been fully
    // retired by Google and every one of them now returns 404. This path is
    // only taken when the developer supplies their own key; the normal route is
    // the server proxy, which resolves a working model at runtime.
    const FAST_MODELS = [
      'gemini-flash-lite-latest',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-flash-latest',
      'gemini-2.5-flash',
    ];
    const filteredDiscovered = this.discoveredModels.filter(
      (m) => m.includes('flash') && !m.includes('gemma') && !m.includes('tts') && !m.includes('image')
    );
    const modelsToTry = filteredDiscovered.length > 0 ? filteredDiscovered : FAST_MODELS;

    for (const model of modelsToTry) {
      if (abortController.signal.aborted) return null;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;

      const timeoutId = setTimeout(() => {
        try {
          abortController.abort();
        } catch {}
      }, 4200);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey,
          },
          body: JSON.stringify(payload),
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          this.lastApiError = '';
          return data;
        } else {
          const errBody = await response.text();
          let errMsg = `Status ${response.status}`;
          try {
            const errObj = JSON.parse(errBody);
            errMsg = errObj?.error?.message || errMsg;
          } catch {}
          this.lastApiError = errMsg;
          console.warn(`[Gemini API] ${model} error (${response.status}):`, errMsg);
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError' || abortController.signal.aborted) {
          console.log('[Gemini API] In-flight request aborted/timed out to keep voice response real-time.');
          return null;
        }
        console.warn(`[Gemini API] Network failure on ${model}:`, err?.message || err);
      }
    }

    return null;
  }

  /**
   * Universal Structured System Prompt enforcing Language Matching and Strict Exam Integrity
   */
  private buildSystemPrompt(context: any, rawText: string): string {
    return `You are DristiX AI Voice Assistant for visually impaired and competitive exam candidates in India.
Current System State:
- Active Screen: "${context.activeView}"
- Is Exam Submitted: ${context.isSubmitted ? 'YES (Exam is completed and submitted! Candidate is viewing Diagnostic Report)' : 'NO'}
- Is Submit Confirmation Modal Open: ${context.isSubmitModalOpen ? 'YES (Submit confirmation dialog is currently open! The candidate can say "Yes, Final Submit" to finish or "Continue to Exam" to resume)' : 'NO'}
- Portal Tab: "${context.portalTab === 'practice' ? 'Practice Arena (Hints & Solutions)' : 'Mock Examinations (Timed Tests)'}"
- Screen Details: ${
  context.activeView === 'report'
    ? `The candidate has ALREADY COMPLETED and SUBMITTED the examination! They are currently viewing the "Diagnostic Report & Performance Breakdown" for "${context.diagnosticReport?.examTitle || context.currentExam?.title}". Their score is ${context.diagnosticReport?.totalScore || 0}/${context.diagnosticReport?.maxScore || 20} points (${context.diagnosticReport?.scorePercentage || 0}%). DO NOT claim an exam is currently running or that they are on Question 1 or Question 2! They can read summary, retake the test, or return to mock test catalog.`
    : context.activeView === 'catalog'
    ? `User is currently on the "${context.portalTab === 'practice' ? 'Interactive Practice Arena' : 'Examination & Mock Test Series'}" catalog dashboard. There are ${context.availableExams.length} Mock Examinations and ${context.availableDrills.length} Practice Drills available to attempt.`
    : context.activeView === 'exam'
    ? `User is currently taking live ${context.currentExam?.isPractice ? 'Practice Drill' : 'Mock Examination'} "${context.currentExam?.title || 'Mock Test'}" on Question ${context.currentQuestion?.number || 1} of ${context.currentExam?.totalQuestions || 10}.`
    : `User is viewing the Student Analytics & Performance Diagnostic report.`
}
- Current Exam: ${context.currentExam ? `"${context.currentExam.title}" (${context.currentExam.isPractice ? 'Practice Drill' : 'Live Mock Examination'})` : 'None (On Exam Catalog Screen)'}
- Current Question: ${context.activeView === 'exam' && context.currentQuestion ? `Q${context.currentQuestion.number}: "${context.currentQuestion.text}"` : 'None (Not in live exam)'}
- Available Options: ${context.activeView === 'exam' && context.currentQuestion ? JSON.stringify(context.currentQuestion.options) : '[]'}
- Current Selected Option: ${context.currentQuestion?.selectedOption ?? 'None'}
- Time Remaining: "${context.timeRemainingFormatted}"
- Available Exams: ${JSON.stringify(context.availableExams.map((e: any) => ({ id: e.id, title: e.title, code: e.code })))}

User Spoken Command: "${rawText}"

CRITICAL SYSTEM RULES (STRICT COMPLIANCE REQUIRED):

1. MANDATORY ENGLISH FOR ALL SPOKEN REPLIES AND ANNOUNCEMENTS:
- Regardless of whether the user speaks or commands in English, Hindi, or Hinglish:
  * Understand the user's command or intent fully (even if spoken in Hindi or Hinglish, e.g. "dusra option chuno", "sawal padho", "agla sawal", "test shuru karo", "wapas jao").
  * ALWAYS produce your "reply" 100% IN NATURAL, ACCURATE, AND POLITE ENGLISH.
  * NEVER output Hindi or Hinglish text in the "reply" field. All confirmations, questions, and announcements must be in clear English.

2. STRICT EXAM INTEGRITY RULE (NO SOLVING, NO ANSWER DISCLOSURE):
- When the candidate is taking an exam/mock test (Active Screen: "exam"):
  * If the user asks to SOLVE the question, REVEAL THE CORRECT ANSWER, EXPLAIN THE SOLUTION, GIVE HINTS, OR ASK WHICH OPTION IS RIGHT (e.g., "solve this question", "answer batao", "explain this question", "sahi option kaun sa hai", "what is the answer", "is question ko solve karo", "help me solve"):
    -> YOU MUST NEVER solve the question or reveal any answers or hints!
    -> Set "action": "EXAM_INTEGRITY_REFUSAL".
    -> Always reply in English: "Exam integrity mode is active. I cannot solve questions or provide answers during the live test. You can ask me to read the question, navigate, select an option, or check the time."

3. STRICT NO-EXIT BEFORE SUBMIT RULE:
- ONLY when taking an ACTIVE unsubmitted exam (Active Screen: "exam" AND Is Exam Submitted: "NO"):
  * If the candidate asks to go back, return to catalog, exit, close the exam, or start another exam before submitting:
    -> YOU MUST NOT exit the test or start another exam!
    -> Set "action": "SUBMIT_EXAM".
    -> Reply in English: "You cannot leave the exam before submitting it. I have opened the submit confirmation window. Please submit your exam first."
- WHEN ON REPORT SCREEN (Active Screen: "report" OR Is Exam Submitted: "YES"):
  * If the candidate asks to go to mock test page, catalog, home, or choose another exam (e.g. "go on mock test page", "गो ऑन मॉक टेस्ट पेज", "mock test page par jao", "choose another exam", "wapas jao"):
    -> SET "action": "RETURN_CATALOG". They are completely allowed to return to the catalog!

4. SUPPORTED EXAM ACTIONS:
- "WHERE_AM_I": User asks what page, screen, or test they are currently on (e.g. "main kis page par hoon", "which page is this", "where am I").
  * If on Report screen: State clearly that the exam is submitted, and they are viewing the Diagnostic Report & Performance Breakdown for "${context.diagnosticReport?.examTitle || context.currentExam?.title}".
  * If candidate is taking an active exam: State that they are on the live Mock Examination page for "${context.currentExam?.title || 'Mock Test'}" on Question ${context.currentQuestion?.number || 1}.
  * If on catalog: State clearly that they are on the "${context.portalTab === 'practice' ? 'Practice Arena' : 'Examination & Mock Test Series'}" catalog dashboard.
- "RETURN_CATALOG": Return to catalog or mock tests list (e.g. "go to mock test page", "गो ऑन मॉक टेस्ट पेज", "mock test page par jao", "choose another exam", "wapas jao", "catalog").
- "PRACTICE_TAB": Switch to the Practice Arena tab WITHOUT starting any drill (e.g. "go on the practice tab", "practice page par jao", "practical page", "प्रैक्टिस टैब पर जाओ", "अभ्यास पेज"). Use this whenever the user only asks to GO TO, SHOW or SEE the practice tab/page and wants to hear which practice drills are listed — NEVER use START_EXAM for such a request. Only when the user names a specific drill and asks to open/start it may you use START_EXAM.
- "READ_REPORT_SUMMARY": Read performance summary on report screen (e.g. "read summary", "summary padho", "score batao").
- "RETAKE_EXAM": Retake the test (e.g. "retake test", "dobara test do").
- "START_EXAM": Open or start a specific examination. In the "param" field, provide the exact matching exam id from Available Exams (e.g. "upsc-csat-paper2" for UPSC / Civil Services, "rrb-ntpc-general" for Railway / RRB NTPC, "ibps-po-quant-speed" for Banking / IBPS PO, or "ssc-cgl-tier1-full" for SSC CGL). Only use it when the user explicitly asks to start/open a named test or drill — for "go on the practice tab" use "PRACTICE_TAB" instead.
- "SELECT_OPTION": Select option (param: 1, 2, 3, or 4)
- "CLEAR_OPTION": Deselect option
- "NEXT_QUESTION": Next question
- "PREVIOUS_QUESTION": Previous question
- "JUMP_QUESTION": Jump to question (param: number)
- "MARK_REVIEW": Mark for review
- "READ_QUESTION": Read current question and options
- "CHECK_TIMER": Read remaining time
- "SUBMIT_EXAM": Open submit modal during live exam
- "FINAL_SUBMIT": Finalize and confirm exam submission (e.g. "yes final submit", "final submit", "confirm submit", "submit final", "yes submit")
- "CONTINUE_EXAM": Resume active exam and close submit confirmation window (e.g. "continue to exam", "resume exam", "cancel submit", "return to exam")
- "ANALYTICS": View analytics
- "LIST_EXAMS": List available exams or tests on this page (e.g. "which tests are available", "is page par kon kon se test available hai", "kaun kaun se test hai", "available exams", "list tests", "tests ke naam batao", "kon se test hai", "is page par kya test hai")
- "EXAM_INTEGRITY_REFUSAL": Triggered when user asks to solve or reveal answers in test
- "GENERAL_QUERY": General conversation or help

Return ONLY a valid JSON object matching this schema:
{
  "action": string,
  "param": number | string | null,
  "transcript": string,
  "reply": string
}`;
  }

  /**
   * Dynamically discover active models supported by the current Groq API key
   */
  public async discoverGroqModels(): Promise<string[]> {
    const key = (this.groqApiKey || DEFAULT_GROQ_API_KEY).trim();
    if (!key) return [];
    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` },
      });
      if (response.ok) {
        const data = await response.json();
        const models: string[] = (data.data || [])
          .map((m: any) => m.id)
          .filter((id: string) => 
            !id.includes('whisper') && 
            !id.includes('guard') &&
            !id.includes('safeguard')
          );
        if (models.length > 0) {
          console.log('⚡ [Groq API] Discovered active models for key:', models);
          this.groqActiveModels = models;
          return models;
        }
      } else {
        const err = await response.text();
        console.warn('[Groq API] Models discovery response:', response.status, err);
      }
    } catch (err) {
      console.warn('[Groq API] Models discovery error:', err);
    }
    return [];
  }

  /**
   * Returns list of Groq models to try, using discovered active models first,
   * then falling back to comprehensive list of active Groq production models.
   */
  private async getGroqModels(): Promise<string[]> {
    if (this.groqActiveModels.length > 0) {
      return this.groqActiveModels;
    }
    const discovered = await this.discoverGroqModels();
    if (discovered.length > 0) {
      return discovered;
    }
    // The previous fallback list was entirely Llama/Mixtral/Gemma names that
    // Groq has since retired or restricted, so every request 404'd. The
    // server proxy resolves a reachable model at runtime; this list is only a
    // last resort for a developer-supplied key.
    return [
      'openai/gpt-oss-120b',
      'qwen/qwen3.8-27b',
      'openai/gpt-oss-20b',
    ];
  }

  /**
   * Fallback high-speed inference via Groq Cloud with dynamic active model support
   */
  public async executeGroqChatCompletion(systemPrompt: string, userText: string): Promise<GeminiParsedCommand | null> {
    const key = (this.groqApiKey || DEFAULT_GROQ_API_KEY).trim();

    // Proxy path: the server holds the Groq key.
    if (this.usesProxy) {
      try {
        const data = await getDataSource().ai.chat({
          provider: 'groq',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText },
          ],
        });
        if (!data.reply) return null;
        return this.parseCommandJson(data.reply);
      } catch (err: any) {
        this.lastApiError = err?.message || 'The AI assistant proxy is unavailable.';
        console.warn('[GroqProxy] request failed:', err?.message ?? err);
        return null;
      }
    }

    if (!key) return null;

    const groqModels = await this.getGroqModels();

    for (const model of groqModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          try { controller.abort(); } catch {}
        }, 5000);

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userText },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const content = data?.choices?.[0]?.message?.content;
          if (content) {
            const parsed = this.parseCommandJson(content);
            if (parsed) {
              console.log(`⚡ [Groq Fallback] Success via ${model}!`);
              // Put working model first so subsequent calls succeed in 1 request
              this.groqActiveModels = [model, ...this.groqActiveModels.filter((m) => m !== model)];
              return parsed;
            }
          }
        } else {
          const errText = await response.text();
          console.warn(`[Groq API] ${model} error (${response.status}):`, errText);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return null;
        console.warn(`[Groq API] Attempt on ${model} failed:`, err?.message || err);
      }
    }
    return null;
  }

  /**
   * Process a text command using Google Gemini AI, with seamless failover to Groq LLaMA
   */
  public async processTextWithGemini(rawText: string): Promise<CommandProcessResult | null> {
    if (!this.hasApiKey()) return null;

    const context = getAssistantContext();
    const systemPrompt = this.buildSystemPrompt(context, rawText);

    let parsed: GeminiParsedCommand | null = null;

    // 1. Try Google Gemini API first
    if (this.apiKey && this.apiKey.length > 10) {
      try {
        const data = await this.executeGenerateContent({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nUser Spoken Command: "${rawText}"` }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        });

        const contentText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (contentText) {
          parsed = this.parseCommandJson(contentText);
          if (parsed) console.log('🤖 Processed via Google Gemini API');
        }
      } catch (err) {
        console.warn('[Gemini Voice] Gemini text attempt failed, shifting to Groq fallback...', err);
      }
    }

    // 2. If Google Gemini failed, timed out, or returned null, immediately shift to Groq API
    if (!parsed && this.groqApiKey) {
      console.log('⚡ Shifting to Groq API fallback (Llama 3.3)...');
      parsed = await this.executeGroqChatCompletion(systemPrompt, rawText);
    }

    if (parsed) {
      return this.executeParsedAction(parsed, rawText);
    }

    return null;
  }

  /**
   * Process raw audio recording using Gemini Multimodal for 100% accurate speech-to-intent
   */
  public async processAudioWithGemini(audioBlob: Blob): Promise<CommandProcessResult | null> {
    if (!this.hasValidGeminiKey()) return null;

    const base64Audio = await this.blobToBase64(audioBlob);
    const context = getAssistantContext();
    const systemPrompt = this.buildSystemPrompt(context, 'Spoken Audio Recording');

    // IMPORTANT: Audio/multimodal input ONLY works on gemini-1.5-flash and gemini-2.0-flash.
    // Gemma models (gemma-4-31b, gemma-4-26b, etc.) do NOT support audio — they return 400.
    // We override discoveredModels here to ensure audio requests only go to audio-capable models.
    const savedModels = this.discoveredModels;
    this.discoveredModels = ['gemini-1.5-flash', 'gemini-2.0-flash'];

    const data = await this.executeGenerateContent({
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: (audioBlob.type || 'audio/webm').split(';')[0].trim() || 'audio/webm',
                data: base64Audio,
              },
            },
            { text: systemPrompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    // Restore original model list
    this.discoveredModels = savedModels;

    const contentText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!contentText) return null;

    try {
      const parsed = this.parseCommandJson(contentText);
      if (!parsed) {
        console.warn('Failed to parse Gemini audio output as a command');
        return null;
      }
      return this.executeParsedAction(parsed, parsed.transcript || 'Voice Audio');
    } catch (err) {
      console.warn('Failed to parse Gemini audio output:', err);
      return null;
    }
  }

  /**
   * Execute application state change based on structured intent
   */
  private executeParsedAction(
    parsed: GeminiParsedCommand,
    rawQuery: string
  ): CommandProcessResult {
    const examStore = useExamStore.getState();
    const context = getAssistantContext();
    const actionUpper = (parsed.action || '').toUpperCase().trim();
    const queryLower = (rawQuery || '').toLowerCase();
    const replyLower = (parsed.reply || '').toLowerCase();
    let actionExecuted: string = parsed.action;
    /**
     * What actually gets said. Defaults to the model's own wording, but
     * state-confirming actions replace it with deterministic text: the reply
     * has to carry the fact itself, and the store's own announcement for the
     * same action is suppressed so the two cannot interrupt each other.
     */
    let spokenReply = parsed.reply;

    // =========================================================================
    // STRICT EXAM INTEGRITY INTERCEPTOR:
    // If the candidate is on the live exam screen, NEVER solve or reveal answers!
    // =========================================================================
    // EXAM INTEGRITY GUARD WITH DIAGRAM ACCESSIBILITY EXEMPTION
    // =========================================================================
    const isDiagramQuery =
      /(?:diagram|chart|graph|figure|visual|image|चित्र|आरेख|ग्राफ)\b/i.test(rawQuery) &&
      (/(?:explain|describe|read|what|tell|batao|samjhao|dekho|khol|open|show|dikhao|detail|breakdown|guide)\b/i.test(rawQuery) ||
        /^(?:explain\s+diagram|describe\s+diagram|read\s+diagram|diagram\s+explain|diagram\s+samjhao|chart\s+samjhao|diagram|chart|figure)$/i.test(rawQuery.trim()));

    if (context.activeView === 'exam' && isDiagramQuery) {
      window.dispatchEvent(new CustomEvent('dristix:open-diagram-explainer'));
      const q = context.currentQuestion;
      let reply = 'Opening AI Diagram Explainer.';
      if (q) {
        if (q.diagramAiExplanation?.audioNarration) {
          reply = q.diagramAiExplanation.audioNarration;
        } else if (q.diagramDescription) {
          reply = `Question ${q.questionNumber} diagram: ${q.diagramDescription}. Opening AI Diagram Explainer.`;
        } else if (q.diagramUrl) {
          reply = `Opening AI Diagram Explainer for Question ${q.questionNumber}. Analyzing visual elements now.`;
        } else {
          reply = `Question ${q.questionNumber} does not have an attached diagram or visual chart.`;
        }
      }
      useAnnouncerStore.getState().announce(reply, 'assertive', true);
      return {
        success: true,
        intent: 'EXPLAIN_DIAGRAM',
        userQuery: rawQuery,
        assistantReply: reply,
        actionExecuted: 'Explained Visual Diagram',
      };
    }

    const isSolveOrAnswerIntent =
      actionUpper === 'EXAM_INTEGRITY_REFUSAL' ||
      actionUpper === 'EXPLANATION' ||
      actionUpper === 'HINT' ||
      actionUpper === 'SOLVE' ||
      queryLower.includes('solve') ||
      queryLower.includes('solution') ||
      queryLower.includes('answer batao') ||
      queryLower.includes('sahi option') ||
      queryLower.includes('sahi answer') ||
      queryLower.includes('correct answer') ||
      queryLower.includes('what is the answer') ||
      queryLower.includes('explain this') ||
      queryLower.includes('explain question') ||
      queryLower.includes('sawal samjhao') ||
      queryLower.includes('answer kya hai');

    if (context.activeView === 'exam' && !isDiagramQuery && isSolveOrAnswerIntent) {
      soundEffects.playTimerAlert();
      const safeReply = 'Exam integrity mode is active. I cannot solve questions or provide answers during the live test. You can ask me to read the question, navigate, select your chosen option, or check the time.';

      useAnnouncerStore.getState().announce(safeReply, 'assertive', true);
      return {
        success: true,
        intent: 'EXAM_INTEGRITY_REFUSAL',
        userQuery: rawQuery,
        assistantReply: safeReply,
        actionExecuted: 'Exam Integrity Protected (Answer Withheld)',
      };
    }

    const all = [...examStore.availableExams, ...examStore.availablePracticeDrills];
    const matchedRequestedExam = matchExamFromQuery(rawQuery, parsed.param, all);

    // List Available Exams / Tests Interceptor
    // MUST BE EVALUATED BEFORE isReturnCatalogIntent so "list mock tests" or "which tests are available" or "is page par kon kon se test available hai" lists test details instead of silently returning to catalog!
    const isListExamsIntent =
      !matchedRequestedExam &&
      (
        actionUpper === 'LIST_EXAMS' ||
        actionUpper === 'LIST_TESTS' ||
        actionUpper === 'AVAILABLE_EXAMS' ||
        actionUpper === 'AVAILABLE_TESTS' ||
        queryLower.includes('list exam') ||
        queryLower.includes('list test') ||
        queryLower.includes('list mock') ||
        queryLower.includes('available exam') ||
        queryLower.includes('available test') ||
        queryLower.includes('avalable') ||
        queryLower.includes('exams ke naam') ||
        queryLower.includes('test ke naam') ||
        queryLower.includes('tests ke naam') ||
        queryLower.includes('kaun kaun') ||
        queryLower.includes('kon kon') ||
        queryLower.includes('kaun se') ||
        queryLower.includes('kon se') ||
        queryLower.includes('konsa') ||
        queryLower.includes('kaun sa') ||
        queryLower.includes('kya kya') ||
        queryLower.includes('uplabdh') ||
        queryLower.includes('which test') ||
        queryLower.includes('what test') ||
        queryLower.includes('which exam') ||
        queryLower.includes('what exam') ||
        ((queryLower.includes('page') || queryLower.includes('yahan') || queryLower.includes('yaha')) &&
          (queryLower.includes('test') || queryLower.includes('exam') || queryLower.includes('mock')))
      );

    if (isListExamsIntent) {
      if (context.portalTab === 'practice' && !queryLower.includes('mock')) {
        const drills = context.availableDrills;
        const names = drills.map((d, idx) => `${idx + 1}. ${d.title}`).join('; ');
        const reply = `On this practice page, there are ${drills.length} Practice Drills available: ${names}. Say "Start Practice Drill" to begin.`;
        useAnnouncerStore.getState().announce(reply, 'assertive', true);
        return {
          success: true,
          intent: 'LIST_PRACTICE_DRILLS',
          userQuery: rawQuery,
          assistantReply: reply,
          actionExecuted: 'Listed Available Practice Drills',
        };
      }

      const exams = context.availableExams;
      const names = exams
        .map((e, idx) => `${idx + 1}. ${e.title} (${e.durationMinutes} mins, ${e.questionCount} questions)`)
        .join('; ');
      const reply = `On this page, there are ${exams.length} Mock Examinations available: ${names}. Say "Start SSC CGL" or "Start Exam 1" to begin.`;
      useAnnouncerStore.getState().announce(reply, 'assertive', true);
      return {
        success: true,
        intent: 'LIST_EXAMS',
        userQuery: rawQuery,
        assistantReply: reply,
        actionExecuted: 'Listed Available Mock Exams',
      };
    }

    // Continue Exam / Resume Exam / Cancel Submit Interceptor
    const isContinueExamIntent =
      actionUpper === 'CONTINUE_EXAM' ||
      actionUpper === 'RESUME_EXAM' ||
      actionUpper === 'CANCEL_SUBMIT' ||
      queryLower.includes('continue to exam') ||
      queryLower.includes('continue exam') ||
      queryLower.includes('resume exam') ||
      queryLower.includes('return to exam') ||
      queryLower.includes('back to exam') ||
      queryLower.includes('cancel submit') ||
      queryLower.includes('cancel submission') ||
      (examStore.isSubmitModalOpen && (
        queryLower.includes('continue') ||
        queryLower.includes('resume') ||
        queryLower.includes('cancel') ||
        queryLower === 'no' ||
        queryLower === 'nahi' ||
        queryLower === 'wapas'
      ));

    if (isContinueExamIntent && context.activeView === 'exam') {
      const wasModalOpen = examStore.isSubmitModalOpen;
      examStore.setSubmitModalOpen(false);
      soundEffects.playSelect();
      const q = context.currentQuestion;
      const qNum = q?.number || (examStore.currentIndex + 1);
      const reply = wasModalOpen
        ? `Submission cancelled. Resuming exam at Question ${qNum}. You can say "Read question", "Next question", or select an option.`
        : `You are continuing your active exam on Question ${qNum}. Say "Read question" to hear the question.`;
      useAnnouncerStore.getState().announce(reply, 'assertive', true);
      return {
        success: true,
        intent: 'RESUME_EXAM',
        userQuery: rawQuery,
        assistantReply: reply,
        actionExecuted: 'Resumed Exam (Cancelled Submission)',
      };
    }

    // Final Submit / Confirm Submit Interceptor
    const isFinalSubmitIntent =
      actionUpper === 'FINAL_SUBMIT' ||
      actionUpper === 'CONFIRM_SUBMIT' ||
      queryLower.includes('yes, final submit') ||
      queryLower.includes('yes final submit') ||
      queryLower.includes('final submit') ||
      queryLower.includes('confirm submit') ||
      queryLower.includes('submit final') ||
      (examStore.isSubmitModalOpen && (
        queryLower.includes('yes submit') ||
        queryLower.includes('submit exam') ||
        queryLower === 'yes' ||
        queryLower === 'submit' ||
        queryLower === 'confirm' ||
        queryLower === 'haan'
      ));

    if (isFinalSubmitIntent && context.activeView === 'exam' && !examStore.isSubmitted) {
      examStore.setSubmitModalOpen(false);
      soundEffects.playSuccess();
      void examStore.submitExam();
      const reply = 'Final submission confirmed. Submitting your examination now...';
      useAnnouncerStore.getState().announce(reply, 'assertive', true);
      return {
        success: true,
        intent: 'FINAL_SUBMIT',
        userQuery: rawQuery,
        assistantReply: reply,
        actionExecuted: 'Final Submitted Exam',
      };
    }

    // Diagnostic & Analytics Report Summary Interceptor (Active when exam is submitted or in report view)
    const isReportSummaryIntent =
      (context.activeView === 'report' || examStore.isSubmitted) &&
      !isContinueExamIntent &&
      !isFinalSubmitIntent &&
      (
        actionUpper === 'READ_REPORT_SUMMARY' ||
        actionUpper === 'SUMMARY' ||
        actionUpper === 'REPORT' ||
        actionUpper === 'ANALYTICS' ||
        actionUpper === 'RESULT' ||
        queryLower.includes('summary') ||
        queryLower.includes('समरी') ||
        queryLower.includes('analytics') ||
        queryLower.includes('एनालिटिक्स') ||
        queryLower.includes('report') ||
        queryLower.includes('रिपोर्ट') ||
        queryLower.includes('result') ||
        queryLower.includes('रिजल्ट') ||
        queryLower.includes('score') ||
        queryLower.includes('स्कोर') ||
        queryLower.includes('performance') ||
        queryLower.includes('parinam') ||
        queryLower.includes('kitne sahi') ||
        queryLower.includes('kitne number') ||
        queryLower.includes('explain result') ||
        queryLower.includes('explain report') ||
        queryLower.includes('explain analytics')
      );

    if (isReportSummaryIntent) {
      soundEffects.playSelect();
      const rep = context.diagnosticReport || examStore.getDiagnosticReport();
      const summaryText =
        rep?.verbalSummary?.join(' ') ||
        `Overall Score: ${rep?.totalScore || 0} out of ${rep?.maxScore || 0} points (${rep?.scorePercentage || 0}%). Attempted: ${rep?.attemptedCount || 0} questions (${rep?.correctCount || 0} correct, ${rep?.incorrectCount || 0} incorrect). Unattempted: ${rep?.unattemptedCount || 0}.`;
      const reply = `Performance Diagnostic and Analytics Report for "${rep?.examTitle || 'Exam'}": You scored ${rep?.totalScore || 0} out of ${rep?.maxScore || 0} points, which is ${rep?.scorePercentage || 0} percent. ${summaryText} You can say "Retake test" or "Choose another exam".`;
      useAnnouncerStore.getState().announce(reply, 'assertive', true);
      return {
        success: true,
        intent: 'READ_REPORT_SUMMARY',
        userQuery: rawQuery,
        assistantReply: reply,
        actionExecuted: 'Explained Diagnostic & Analytics Report',
      };
    }

    // Return to Catalog / Mock Test Page / Choose Another Exam Interceptor
    // MUST BE EVALUATED BEFORE isStartExamIntent so phrases like "open mock test page" or "go on mocktest page" navigate to catalog!
    // BUT if the user explicitly requested a specific exam (e.g. "open UPSC mock test"), matchedRequestedExam will be defined and we should NOT intercept as catalog navigation!
    const isReturnCatalogIntent =
      !matchedRequestedExam &&
      !isContinueExamIntent &&
      !isFinalSubmitIntent &&
      !queryLower.includes('to exam') &&
      !queryLower.includes('to test') &&
      (
        actionUpper === 'RETURN_CATALOG' ||
        actionUpper === 'RETURN' ||
        actionUpper === 'CATALOG' ||
        actionUpper === 'EXAM_CATALOG' ||
        actionUpper === 'MOCK_TEST_PAGE' ||
        actionUpper === 'MOCK_TESTS' ||
        actionUpper === 'MOCKTEST_PAGE' ||
        actionUpper === 'MOCKTEST' ||
        actionUpper === 'NAVIGATE_CATALOG' ||
        actionUpper === 'NAVIGATE_BACK' ||
        actionUpper === 'BACK' ||
        actionUpper === 'EXIT' ||
        actionUpper === 'HOME' ||
        queryLower.includes('mock test page') ||
        queryLower.includes('mocktest page') ||
        queryLower.includes('go on mock') ||
        queryLower.includes('go to mock') ||
        queryLower.includes('take me to mock') ||
        queryLower.includes('back to mock') ||
        queryLower.includes('return to mock') ||
        queryLower.includes('open mock test page') ||
        queryLower.includes('open mocktest page') ||
        queryLower.includes('मॉक टेस्ट पेज') ||
        queryLower.includes('मॉकटेस्ट पेज') ||
        queryLower.includes('मॉक टेस्ट पर') ||
        queryLower.includes('मॉकटेस्ट पर') ||
        queryLower.includes('गो ऑन') ||
        queryLower.includes('गो टू') ||
        queryLower.includes('choose another') ||
        queryLower.includes('another exam') ||
        queryLower.includes('another test') ||
        queryLower.includes('dusra exam') ||
        queryLower.includes('dusra test') ||
        queryLower.includes('test page') ||
        queryLower.includes('tests page') ||
        queryLower.includes('exam page') ||
        queryLower.includes('exams page') ||
        queryLower.includes('catalog page') ||
        queryLower.includes('catalog par') ||
        queryLower.includes('all exams') ||
        queryLower.includes('all tests') ||
        queryLower.includes('all mock') ||
        queryLower.includes('sare test') ||
        queryLower.includes('sare exam') ||
        queryLower.includes('sare mock') ||
        queryLower.includes('show mock tests') ||
        queryLower.includes('list mock tests') ||
        queryLower.includes('test series') ||
        queryLower.includes('home page') ||
        queryLower.includes('pehle page') ||
        queryLower.includes('main page') ||
        // When on the report screen, any request to see tests, exams, catalog, or return goes to catalog!
        (context.activeView === 'report' && (
          queryLower.includes('mock test') ||
          queryLower.includes('mocktest') ||
          queryLower.includes('test') ||
          queryLower.includes('tests') ||
          queryLower.includes('exam') ||
          queryLower.includes('exams') ||
          queryLower.includes('catalog') ||
          queryLower.includes('home') ||
          queryLower.includes('back') ||
          queryLower.includes('wapas')
        ))
      );

    if (isReturnCatalogIntent) {
      if (context.activeView === 'exam' && !examStore.isSubmitted) {
        examStore.setSubmitModalOpen(true);
        soundEffects.playTimerAlert();
        const safeReply = 'You cannot leave the exam before submitting it. The submit confirmation window is now open. Please submit your test first.';
        useAnnouncerStore.getState().announce(safeReply, 'assertive', true);
        return {
          success: true,
          intent: 'SUBMIT_EXAM',
          userQuery: rawQuery,
          assistantReply: safeReply,
          actionExecuted: 'Opened Submit Modal (Exit Prevented)',
        };
      }

      examStore.returnToCatalog();
      examStore.setPortalTab('exams');
      soundEffects.playSuccess();
      const reply = 'Returned to the Examination Catalog. All available mock tests are displayed on your screen. Say "Start SSC CGL" or "Start Exam 1" to begin.';
      useAnnouncerStore.getState().announce(reply, 'assertive', true);
      return {
        success: true,
        intent: 'RETURN_CATALOG',
        userQuery: rawQuery,
        assistantReply: reply,
        actionExecuted: 'Returned to Mock Test Catalog',
      };
    }

    // Practice Tab navigation interceptor
    // MUST BE EVALUATED BEFORE isStartExamIntent: matchExamFromQuery() resolves the bare
    // word "practice" to the first Practice Drill (examMatcher rule 9), so "go on the
    // practice tab" would otherwise be executed as START_EXAM and launch a live drill
    // instead of just switching tabs. The candidate is taken to the Practice Arena and
    // told which drills are listed; a later "Start <drill name>" opens one.
    const isPracticeTabIntent =
      isPracticeTabNavigation(rawQuery) ||
      actionUpper === 'PRACTICE_TAB' ||
      actionUpper === 'PRACTICE_PAGE' ||
      actionUpper === 'PRACTICE_ARENA' ||
      actionUpper === 'SWITCH_PRACTICE' ||
      actionUpper === 'NAVIGATE_PRACTICE';

    if (isPracticeTabIntent) {
      if (context.activeView === 'exam' && !examStore.isSubmitted) {
        examStore.setSubmitModalOpen(true);
        soundEffects.playTimerAlert();
        const safeReply = 'You cannot leave the exam before submitting it. The submit confirmation window is now open. Please submit your test first.';
        useAnnouncerStore.getState().announce(safeReply, 'assertive', true);
        return {
          success: true,
          intent: 'SUBMIT_EXAM',
          userQuery: rawQuery,
          assistantReply: safeReply,
          actionExecuted: 'Opened Submit Modal (Exit Prevented)',
        };
      }

      examStore.returnToCatalog();
      examStore.setPortalTab('practice');

      const drills = context.availableDrills;
      const names = drills.map((d, idx) => `${idx + 1}. ${d.title}`).join('; ');
      const reply = drills.length
        ? `Switched to the Practice Arena tab. ${drills.length} practice drills are now listed on your screen: ${names}. Say "Start" followed by a drill name to open one.`
        : 'Switched to the Practice Arena tab. No practice drills are available right now. Say "Go to mock test page" to see the mock examinations.';

      soundEffects.playSuccess();
      useAnnouncerStore.getState().announce(reply, 'assertive', true);
      return {
        success: true,
        intent: 'PRACTICE_TAB',
        userQuery: rawQuery,
        assistantReply: reply,
        actionExecuted: 'Opened Practice Tab (No Drill Started)',
      };
    }

    // Detect if this is an exam start request (either via explicit action, matched exam, or intent in reply/query)
    const isStartExamIntent =
      !isReturnCatalogIntent &&
      (
        !!matchedRequestedExam ||
        actionUpper === 'START_EXAM' ||
        actionUpper === 'OPEN_EXAM' ||
        actionUpper === 'START_TEST' ||
        actionUpper === 'OPEN_TEST' ||
        actionUpper === 'SELECT_EXAM' ||
        actionUpper === 'LAUNCH_EXAM' ||
        actionUpper === 'BEGIN_EXAM' ||
        (actionUpper === 'START' && !queryLower.includes('page') && !queryLower.includes('catalog')) ||
        (actionUpper === 'OPEN' && !queryLower.includes('page') && !queryLower.includes('catalog')) ||
        replyLower.includes('open kar') ||
        replyLower.includes('start kar') ||
        replyLower.includes('shuru kar') ||
        replyLower.includes('khol raha') ||
        queryLower.includes('open exam') ||
        queryLower.includes('exam open') ||
        queryLower.includes('start exam') ||
        queryLower.includes('exam start') ||
        queryLower.includes('exam kholo') ||
        queryLower.includes('test kholo') ||
        queryLower.includes('exam shuru') ||
        queryLower.includes('ak exam') ||
        queryLower.includes('ek exam')
      );

    if (isStartExamIntent) {
      // STRICT INTEGRITY: If candidate is taking a test, prevent switching exams before submitting
      if (context.activeView === 'exam' && !examStore.isSubmitted) {
        examStore.setSubmitModalOpen(true);
        soundEffects.playTimerAlert();
        const safeReply = 'An exam is already running. You cannot leave or start another test before submitting this one. Submit confirmation window opened.';
        useAnnouncerStore.getState().announce(safeReply, 'assertive', true);
        return {
          success: true,
          intent: 'SUBMIT_EXAM',
          userQuery: rawQuery,
          assistantReply: safeReply,
          actionExecuted: 'Opened Submit Modal (Exam Switch Prevented)',
        };
      }

      const target = matchedRequestedExam || all[0];

      // If user is on /admin route, ensure we navigate back to main student app
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }

      // The confirmation reply spoken just below stands in for the store's own
      // "Starting…" announcement, which would otherwise cut it off.
      void examStore.selectExam(target.id, target.id.includes('practice') ? 'practice' : 'exam', {
        announce: false,
      });
      soundEffects.playSuccess();
      actionExecuted = `Started ${target.title}`;

      // Build a clear confirmation reply telling user exactly what opened + Q1 info
      const confirmReply = `"${target.title}" has been opened successfully! Question 1 is now loaded on your screen. Say "Read question" to hear the full question and options.`;

      // Vocalize the confirmation reply
      useAnnouncerStore.getState().announce(confirmReply, 'assertive', true);

      return {
        success: true,
        intent: 'START_EXAM',
        userQuery: rawQuery,
        assistantReply: confirmReply,
        actionExecuted,
      };
    }

    switch (actionUpper) {
      case 'SELECT_OPTION':
      case 'CHOOSE_OPTION':
      case 'OPTION_SELECT': {
        const opt = Number(parsed.param) || (queryLower.includes('2') ? 2 : queryLower.includes('3') ? 3 : queryLower.includes('4') ? 4 : 1);
        if (context.activeView === 'exam') {
          // This reply is the only voice for the action — the store's own
          // announcement is stood down, because the second message would cancel
          // the first before the candidate heard which option was taken.
          examStore.selectOption(opt, { announce: false });
          soundEffects.playSelect();
          const { questions, currentIndex, selectedOptions } = useExamStore.getState();
          const total = questions.length;
          const isLastQuestion = currentIndex >= total - 1;
          const allAnswered = Object.keys(selectedOptions).length >= total;
          const selection = describeOptionSelection(questions[currentIndex], opt);

          let guidance = ' Say "Next question" to continue, or "Read question" to review.';
          if (allAnswered) {
            guidance = ` All ${total} questions have been answered. Say "Submit exam" to finish and submit your test, or "Read question" to review.`;
          } else if (isLastQuestion) {
            guidance = ` This is the last question (${total} of ${total}). Say "Submit exam" to finish and submit your test, or "Previous question" or "Read question" to review.`;
          }

          spokenReply = `${selection}${guidance}`;
        }
        break;
      }
      case 'CLEAR_OPTION':
      case 'CLEAR':
      case 'DESELECT': {
        if (context.activeView === 'exam') {
          const state = useExamStore.getState();
          const q = state.questions[state.currentIndex];
          const hadSelection = Boolean(q && state.selectedOptions[q.id]);
          examStore.clearOption({ announce: false });
          soundEffects.playClear();
          actionExecuted = hadSelection ? 'Cleared Option' : 'Nothing selected to clear';
          spokenReply = describeClearSelection(q, hadSelection);
        }
        break;
      }
      case 'NEXT_QUESTION':
      case 'NEXT': {
        if (context.activeView === 'exam') {
          const { questions, currentIndex, selectedOptions } = useExamStore.getState();
          const total = questions.length;
          const isAtLast = currentIndex >= total - 1;
          const answeredCount = Object.keys(selectedOptions).length;

          if (isAtLast) {
            soundEffects.playTimerAlert();
            actionExecuted = 'At Last Question - Ready to Submit';
            spokenReply = answeredCount >= total
              ? `You have reached the end of the test. All ${total} questions have been answered. Say "Submit exam" to finish and submit your test, or "Previous question" to review.`
              : `You are on the last question (${total} of ${total}). ${total - answeredCount} questions remain unattempted. Say "Submit exam" to submit your test, or "Previous question" to review.`;
          } else {
            examStore.nextQuestion();
            actionExecuted = 'Moved to Next Question';
            const nextCtx = getAssistantContext();
            const q = nextCtx.currentQuestion;
            if (q) {
              spokenReply = buildFullQuestionSpeech(q);
            } else {
              spokenReply = 'You have reached the end of the test. Say "Submit exam" when you are ready to finish.';
            }
          }
        }
        break;
      }
      case 'PREVIOUS_QUESTION':
      case 'PREV':
      case 'PREVIOUS': {
        if (context.activeView === 'exam') {
          examStore.previousQuestion();
          actionExecuted = 'Moved to Previous Question';
          const prevCtx = getAssistantContext();
          const q = prevCtx.currentQuestion;
          if (q) {
            spokenReply = buildFullQuestionSpeech(q);
          } else {
            spokenReply = 'You are already on the first question.';
          }
        }
        break;
      }
      case 'JUMP_QUESTION': {
        const qNum = Number(parsed.param);
        if (context.activeView === 'exam' && qNum > 0 && qNum <= examStore.questions.length) {
          examStore.jumpToQuestion(qNum - 1);
          actionExecuted = `Jumped to Question ${qNum}`;
          const jumpCtx = getAssistantContext();
          const q = jumpCtx.currentQuestion;
          if (q) {
            spokenReply = buildFullQuestionSpeech(q);
          }
        }
        break;
      }
      case 'MARK_REVIEW':
      case 'MARK': {
        if (context.activeView === 'exam') {
          examStore.toggleMarkForReview();
          soundEffects.playMark();
          actionExecuted = 'Toggled Mark for Review';
        }
        break;
      }
      case 'READ_QUESTION': {
        if (context.activeView === 'exam') {
          actionExecuted = 'Read Current Question';
          const curCtx = getAssistantContext();
          const q = curCtx.currentQuestion;
          if (q) {
            spokenReply = buildFullQuestionSpeech(q);
          }
        }
        break;
      }
      case 'CHECK_TIMER':
      case 'TIMER': {
        if (context.activeView === 'exam') {
          examStore.readTimer();
          actionExecuted = 'Announced Remaining Time';
        }
        break;
      }
      case 'EXPLAIN_DIAGRAM':
      case 'DIAGRAM': {
        if (context.activeView === 'exam') {
          window.dispatchEvent(new CustomEvent('dristix:open-diagram-explainer'));
          actionExecuted = 'Opened AI Diagram Explainer';
          const q = examStore.questions[examStore.currentIndex];
          if (q) {
            if (q.diagramAiExplanation?.audioNarration) {
              spokenReply = q.diagramAiExplanation.audioNarration;
            } else if (q.diagramDescription) {
              spokenReply = `Question ${q.questionNumber} diagram: ${q.diagramDescription}. Opening AI Diagram Explainer.`;
            } else if (q.diagramUrl) {
              spokenReply = `Opening AI Diagram Explainer for Question ${q.questionNumber}. Analyzing visual elements now.`;
            } else {
              spokenReply = `Question ${q.questionNumber} does not have an attached diagram or visual chart.`;
            }
          }
        }
        break;
      }
      case 'SUBMIT_EXAM':
      case 'SUBMIT': {
        if (context.activeView === 'exam' && !examStore.isSubmitted) {
          if (examStore.isSubmitModalOpen) {
            examStore.setSubmitModalOpen(false);
            soundEffects.playSuccess();
            void examStore.submitExam();
            actionExecuted = 'Final Submitted Exam';
            spokenReply = 'Final submission confirmed. Submitting your examination now...';
          } else {
            examStore.setSubmitModalOpen(true);
            soundEffects.playTimerAlert();
            actionExecuted = 'Opened Submit Confirmation';
            const total = examStore.questions.length;
            const answered = Object.keys(examStore.selectedOptions).length;
            spokenReply = `Confirm exam submission window is open. You have answered ${answered} of ${total} questions. Say "Yes, Final Submit" or press Enter to submit, or say "Continue to Exam" or press Escape to resume your test.`;
          }
        }
        break;
      }
      case 'FINAL_SUBMIT':
      case 'CONFIRM_SUBMIT': {
        if (context.activeView === 'exam' && !examStore.isSubmitted) {
          examStore.setSubmitModalOpen(false);
          soundEffects.playSuccess();
          void examStore.submitExam();
          actionExecuted = 'Final Submitted Exam';
          spokenReply = 'Final submission confirmed. Submitting your examination now...';
        }
        break;
      }
      case 'CONTINUE_EXAM':
      case 'RESUME_EXAM':
      case 'CANCEL_SUBMIT': {
        if (context.activeView === 'exam') {
          const wasModalOpen = examStore.isSubmitModalOpen;
          examStore.setSubmitModalOpen(false);
          soundEffects.playSelect();
          actionExecuted = 'Resumed Exam (Cancelled Submission)';
          const q = context.currentQuestion;
          const qNum = q?.number || (examStore.currentIndex + 1);
          spokenReply = wasModalOpen
            ? `Submission cancelled. Resuming exam at Question ${qNum}. You can say "Read question", "Next question", or select an option.`
            : `You are continuing your active exam on Question ${qNum}. Say "Read question" to hear the question.`;
        }
        break;
      }
      case 'READ_REPORT_SUMMARY':
      case 'SUMMARY': {
        const rep = context.diagnosticReport;
        const sum = rep?.verbalSummary?.join(' ') || `Your score was ${rep?.totalScore || 0} out of ${rep?.maxScore || 20}.`;
        const reply = `Diagnostic Summary for ${rep?.examTitle || 'Exam'}: ${sum}`;
        useAnnouncerStore.getState().announce(reply, 'assertive', true);
        return {
          success: true,
          intent: 'READ_REPORT_SUMMARY',
          userQuery: rawQuery,
          assistantReply: reply,
          actionExecuted: 'Read Diagnostic Summary',
        };
      }
      case 'RETAKE_EXAM':
      case 'RETAKE': {
        examStore.resetExam();
        const reply = 'Exam has been reset. Question 1 is now loaded on your screen. Say "Read question" to begin.';
        useAnnouncerStore.getState().announce(reply, 'assertive', true);
        return {
          success: true,
          intent: 'RETAKE_EXAM',
          userQuery: rawQuery,
          assistantReply: reply,
          actionExecuted: 'Retook Exam',
        };
      }
      case 'ANALYTICS':
      case 'VIEW_ANALYTICS': {
        examStore.openAnalytics();
        actionExecuted = 'Opened Analytics';
        break;
      }
      case 'WHERE_AM_I':
      case 'PAGE_INFO':
      case 'EXPLAIN_PAGE': {
        soundEffects.playSelect();
        let whereReply = parsed.reply;
        if (context.activeView === 'report') {
          const rep = context.diagnosticReport;
          const examTitle = rep?.examTitle || context.currentExam?.title || 'Mock Examination';
          whereReply = `You have completed and submitted "${examTitle}". You are currently on the Performance Diagnostic Report and Score Analysis screen. Your score is ${rep?.totalScore || 0} out of ${rep?.maxScore || 20} (${rep?.scorePercentage || 0}%). You can say "Read summary", "Retake test", or "Go to mock test page".`;
        }
        useAnnouncerStore.getState().announce(whereReply, 'assertive', true);
        return {
          success: true,
          intent: 'WHERE_AM_I',
          userQuery: rawQuery,
          assistantReply: whereReply,
          actionExecuted: 'Explained Current Screen',
        };
      }
      default: {
        soundEffects.playSelect();
        break;
      }
    }

    // Vocalize assistant reply
    useAnnouncerStore.getState().announce(spokenReply, 'assertive', true);

    return {
      success: true,
      intent: parsed.action,
      userQuery: rawQuery,
      assistantReply: spokenReply,
      actionExecuted,
    };
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string)?.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const geminiVoiceService = new GeminiVoiceService();
