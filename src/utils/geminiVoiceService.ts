import { getAssistantContext } from './assistantContext';
import { useExamStore } from '../store/useExamStore';
import { useAnnouncerStore } from '../store/useAnnouncerStore';
import { soundEffects } from './soundEffects';
import type { CommandProcessResult } from './voiceCommandProcessor';

const API_KEY_STORAGE = 'dristix_gemini_api_key';
const GROQ_API_KEY_STORAGE = 'dristix_groq_api_key';
export const DEFAULT_GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
export const DEFAULT_GROQ_API_KEY = (import.meta.env.VITE_GROQ_API_KEY || '').trim();

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
      const stored = localStorage.getItem(API_KEY_STORAGE);
      const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
      this.apiKey = (stored || envKey || DEFAULT_GEMINI_API_KEY).trim().replace(/^["']|["']$/g, '').trim();

      const storedGroq = localStorage.getItem(GROQ_API_KEY_STORAGE);
      const envGroq = (import.meta as any).env?.VITE_GROQ_API_KEY || '';
      this.groqApiKey = (storedGroq || envGroq || DEFAULT_GROQ_API_KEY).trim().replace(/^["']|["']$/g, '').trim();

      if (this.hasApiKey()) {
        this.validateApiKey();
      }
      if (this.groqApiKey) {
        this.discoverGroqModels();
      }
    }
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

  public hasApiKey(): boolean {
    const cleanGemini = this.apiKey.trim().replace(/^["']|["']$/g, '').trim();
    const cleanGroq = this.groqApiKey.trim().replace(/^["']|["']$/g, '').trim();
    return cleanGemini.length > 10 || cleanGroq.length > 10;
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
                // Filter out preview TTS, deprecated 2.5, embedding, or overloaded models
                if (
                  name.includes('tts') ||
                  name.includes('preview') ||
                  name.includes('2.5') ||
                  name.includes('embedding') ||
                  name.includes('imagen')
                ) {
                  return false;
                }
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
   * Fast, reliable multi-model caller.
   * Immediately aborts any previous pending request and enforces a strict 4.2s timeout
   * so requests never hang, accumulate in background queues, or fire late.
   */
  private async executeGenerateContent(payload: any): Promise<any> {
    const cleanKey = this.apiKey.trim().replace(/^["']|["']$/g, '').trim();
    if (!cleanKey) return null;

    // 1. Immediately abort prior in-flight request so earlier spoken commands never linger
    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch {}
    }

    const abortController = new AbortController();
    this.activeAbortController = abortController;

    // 2. High-speed models: prioritize discovered models, including gemini-2.5-flash
    const modelsToTry = this.discoveredModels.length > 0
      ? this.discoveredModels
      : ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];

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

1. MANDATORY DYNAMIC LANGUAGE AUTO-DETECTION:
- YOU MUST STRICTLY IDENTIFY THE LANGUAGE OF WHAT THE USER SPOKE OR TYPED ("${rawText}"):
  * If the user spoke or typed in ENGLISH (e.g. "select option 1", "read the question", "next question", "previous question", "how much time left", "submit my exam", "help me", "which page am I on", "go to mock test page"):
    -> Your "reply" MUST BE 100% IN NATURAL, ACCURATE ENGLISH. Do NOT mix Hindi or Hinglish words when the user spoke in English!
  * If the user spoke or typed in HINDI or HINGLISH (e.g. "pehla option chuno", "dusra option lagao", "agla sawal", "sawal padh ke sunao", "kitna time bacha hai", "exam submit karo", "main abhi kis page par hoon", "गो ऑन मॉक टेस्ट पेज", "mock test page par jao"):
    -> Your "reply" MUST BE IN NATURAL, POLITE HINDI / HINGLISH.
- NEVER rely on any preset language button. ALWAYS determine the reply language strictly from the user's actual spoken utterance.

2. STRICT EXAM INTEGRITY RULE (NO SOLVING, NO ANSWER DISCLOSURE):
- When the candidate is taking an exam/mock test (Active Screen: "exam"):
  * If the user asks to SOLVE the question, REVEAL THE CORRECT ANSWER, EXPLAIN THE SOLUTION, GIVE HINTS, OR ASK WHICH OPTION IS RIGHT (e.g., "solve this question", "answer batao", "explain this question", "sahi option kaun sa hai", "what is the answer", "is question ko solve karo", "help me solve"):
    -> YOU MUST NEVER solve the question or reveal any answers or hints!
    -> Set "action": "EXAM_INTEGRITY_REFUSAL".
    -> If the user asked in English, reply: "Exam integrity mode is active. I cannot solve questions or provide answers during the live test. You can ask me to read the question, navigate, select an option, or check the time."
    -> If the user asked in Hindi/Hinglish, reply: "Pariksha niyam ke anusaar, live mock test ke dauran main sawal ka solution ya answer nahi bata sakta. Aap option chunne, agla sawal lagane ya samay poochne ke liye bol sakte hain."

3. STRICT NO-EXIT BEFORE SUBMIT RULE:
- ONLY when taking an ACTIVE unsubmitted exam (Active Screen: "exam" AND Is Exam Submitted: "NO"):
  * If the candidate asks to go back, return to catalog, exit, close the exam, or start another exam before submitting:
    -> YOU MUST NOT exit the test or start another exam!
    -> Set "action": "SUBMIT_EXAM".
    -> If asked in English: "You cannot leave the exam before submitting it. I have opened the submit confirmation window. Please submit your exam first."
    -> If asked in Hindi/Hinglish: "Pariksha submit kiye bina aap wapas nahi ja sakte. Maine exam submit confirmation window open kar di hai. Kripya pehle exam submit karein."
- WHEN ON REPORT SCREEN (Active Screen: "report" OR Is Exam Submitted: "YES"):
  * If the candidate asks to go to mock test page, catalog, home, or choose another exam (e.g. "go on mock test page", "गो ऑन मॉक टेस्ट पेज", "mock test page par jao", "choose another exam", "wapas jao"):
    -> SET "action": "RETURN_CATALOG". They are completely allowed to return to the catalog!

4. SUPPORTED EXAM ACTIONS:
- "WHERE_AM_I": User asks what page, screen, or test they are currently on (e.g. "main kis page par hoon", "which page is this", "where am I").
  * If on Report screen: State clearly that the exam is submitted, and they are viewing the Diagnostic Report & Performance Breakdown for "${context.diagnosticReport?.examTitle || context.currentExam?.title}".
  * If candidate is taking an active exam: State that they are on the live Mock Examination page for "${context.currentExam?.title || 'Mock Test'}" on Question ${context.currentQuestion?.number || 1}.
  * If on catalog: State clearly that they are on the "${context.portalTab === 'practice' ? 'Practice Arena' : 'Examination & Mock Test Series'}" catalog dashboard.
- "RETURN_CATALOG": Return to catalog or mock tests list (e.g. "go to mock test page", "गो ऑन मॉक टेस्ट पेज", "mock test page par jao", "choose another exam", "wapas jao", "catalog").
- "READ_REPORT_SUMMARY": Read performance summary on report screen (e.g. "read summary", "summary padho", "score batao").
- "RETAKE_EXAM": Retake the test (e.g. "retake test", "dobara test do").
- "START_EXAM": Open or start a test (param: exam title or code)
- "SELECT_OPTION": Select option (param: 1, 2, 3, or 4)
- "CLEAR_OPTION": Deselect option
- "NEXT_QUESTION": Next question
- "PREVIOUS_QUESTION": Previous question
- "JUMP_QUESTION": Jump to question (param: number)
- "MARK_REVIEW": Mark for review
- "READ_QUESTION": Read current question and options
- "CHECK_TIMER": Read remaining time
- "SUBMIT_EXAM": Open submit modal
- "ANALYTICS": View analytics
- "LIST_EXAMS": List available exams
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
    return [
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'llama3-70b-8192',
      'llama3-8b-8192',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
      'qwen-2.5-32b',
      'deepseek-r1-distill-llama-70b',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'llama-3.2-3b-preview',
      'llama-3.2-1b-preview',
    ];
  }

  /**
   * Fallback high-speed inference via Groq Cloud with dynamic active model support
   */
  public async executeGroqChatCompletion(systemPrompt: string, userText: string): Promise<GeminiParsedCommand | null> {
    const key = (this.groqApiKey || DEFAULT_GROQ_API_KEY).trim();
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
            const parsed: GeminiParsedCommand = JSON.parse(content);
            console.log(`⚡ [Groq Fallback] Success via ${model}!`);
            // Put working model first so subsequent calls succeed in 1 request
            this.groqActiveModels = [model, ...this.groqActiveModels.filter(m => m !== model)];
            return parsed;
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
          parsed = JSON.parse(contentText);
          console.log('🤖 Processed via Google Gemini API');
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
    if (!this.apiKey || this.apiKey.length <= 10) return null;

    const base64Audio = await this.blobToBase64(audioBlob);
    const context = getAssistantContext();
    const systemPrompt = this.buildSystemPrompt(context, 'Spoken Audio Recording');

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

    const contentText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!contentText) return null;

    try {
      const parsed: GeminiParsedCommand = JSON.parse(contentText);
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

    // Detect language of user query (pure English vs Hindi/Hinglish)
    const isPureEnglish =
      /^[a-zA-Z0-9\s.,?!'\-—/()]+$/.test(rawQuery) &&
      !/(karo|karna|karein|batao|bataiye|kya|hai|hain|kaun|konsa|kon|kis|sawal|uttar|samjhao|shuru|agla|pichla|dusra|teesra|choutha|pahla|chuno|lagao|kholo|chalao|kitna|kitne|samay|padho|bolo|sunao|chahiye|hal|mujhe|mera|meri|mere|main|mai|hoon|hu|ho|par|pe|kahan|yahan|wahan|pariksha|khatam|nahi|raha|rahi|rahe|liye|wapas|kaise|sakte|sakta|sakti|ek|do|teen|char|paanch|aap|tum|hum)/i.test(
        rawQuery
      );

    // =========================================================================
    // STRICT EXAM INTEGRITY INTERCEPTOR:
    // If the candidate is on the live exam screen, NEVER solve or reveal answers!
    // =========================================================================
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

    if (context.activeView === 'exam' && isSolveOrAnswerIntent) {
      soundEffects.playTimerAlert();
      const safeReply = isPureEnglish
        ? 'Exam integrity mode is active. I cannot solve questions or provide answers during the live test. You can ask me to read the question, navigate, select your chosen option, or check the time.'
        : 'Pariksha niyam ke anusaar, live mock test ke dauran main sawal ka solution ya answer nahi bata sakta. Aap option chunne, agla sawal lagane ya bacha hua samay poochne ke liye bol sakte hain.';

      useAnnouncerStore.getState().announce(safeReply, 'assertive', true);
      return {
        success: true,
        intent: 'EXAM_INTEGRITY_REFUSAL',
        userQuery: rawQuery,
        assistantReply: safeReply,
        actionExecuted: 'Exam Integrity Protected (Answer Withheld)',
      };
    }

    // Detect if this is an exam start request (either via explicit action or intent in reply/query)
    const isStartExamIntent =
      actionUpper === 'START_EXAM' ||
      actionUpper === 'OPEN_EXAM' ||
      actionUpper === 'START_TEST' ||
      actionUpper === 'OPEN_TEST' ||
      actionUpper === 'SELECT_EXAM' ||
      actionUpper === 'START' ||
      actionUpper === 'OPEN' ||
      actionUpper === 'LAUNCH_EXAM' ||
      actionUpper === 'BEGIN_EXAM' ||
      replyLower.includes('open kar') ||
      replyLower.includes('start kar') ||
      replyLower.includes('shuru kar') ||
      replyLower.includes('khol raha') ||
      queryLower.includes('open exam') ||
      queryLower.includes('exam open') ||
      queryLower.includes('start exam') ||
      queryLower.includes('exam start') ||
      queryLower.includes('test open') ||
      queryLower.includes('test start') ||
      queryLower.includes('exam kholo') ||
      queryLower.includes('test kholo') ||
      queryLower.includes('exam shuru') ||
      queryLower.includes('ak exam') ||
      queryLower.includes('ek exam');

    if (isStartExamIntent) {
      // STRICT INTEGRITY: If candidate is taking a test, prevent switching exams before submitting
      if (context.activeView === 'exam' && !examStore.isSubmitted) {
        examStore.setSubmitModalOpen(true);
        soundEffects.playTimerAlert();
        const safeReply = isPureEnglish
          ? 'An exam is already running. You cannot leave or start another test before submitting this one. Submit confirmation window opened.'
          : 'Aapki pariksha abhi chal rahi hai. Naya test shuru karne se pehle kripya is exam ko submit karein.';
        useAnnouncerStore.getState().announce(safeReply, 'assertive', true);
        return {
          success: true,
          intent: 'SUBMIT_EXAM',
          userQuery: rawQuery,
          assistantReply: safeReply,
          actionExecuted: 'Opened Submit Modal (Exam Switch Prevented)',
        };
      }

      const all = [...examStore.availableExams, ...examStore.availablePracticeDrills];
      let target = all[0];
      const searchKey = `${parsed.param || ''} ${rawQuery}`.toLowerCase();

      if (searchKey.includes('ssc') || searchKey.includes('cgl')) {
        target = all.find((e) => e.code.includes('SSC')) || target;
      } else if (searchKey.includes('ibps') || searchKey.includes('bank') || searchKey.includes('po')) {
        target = all.find((e) => e.code.includes('IBPS')) || target;
      } else if (searchKey.includes('rrb') || searchKey.includes('railway') || searchKey.includes('ntpc')) {
        target = all.find((e) => e.code.includes('RRB')) || target;
      } else if (searchKey.includes('upsc') || searchKey.includes('csat')) {
        target = all.find((e) => e.code.includes('CSAT')) || target;
      } else if (searchKey.includes('practice') || searchKey.includes('drill')) {
        target = all.find((e) => e.id.includes('practice')) || target;
      } else if (searchKey.includes('dusra') || searchKey.includes('second') || searchKey.includes('2')) {
        target = all[1] || target;
      } else if (searchKey.includes('teesra') || searchKey.includes('third') || searchKey.includes('3')) {
        target = all[2] || target;
      }

      // If user is on /admin route, ensure we navigate back to main student app
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }

      examStore.selectExam(target.id, target.id.includes('practice') ? 'practice' : 'exam');
      soundEffects.playSuccess();
      actionExecuted = `Started ${target.title}`;

      // Vocalize assistant reply
      useAnnouncerStore.getState().announce(parsed.reply, 'assertive', true);

      return {
        success: true,
        intent: 'START_EXAM',
        userQuery: rawQuery,
        assistantReply: parsed.reply,
        actionExecuted,
      };
    }

    // Return to Catalog / Choose Another Exam Interceptor
    const isReturnCatalogIntent =
      actionUpper === 'RETURN_CATALOG' ||
      actionUpper === 'NAVIGATE_BACK' ||
      actionUpper === 'BACK' ||
      actionUpper === 'EXIT' ||
      queryLower.includes('mock test page') ||
      queryLower.includes('मॉक टेस्ट पेज') ||
      queryLower.includes('mock test par') ||
      queryLower.includes('मॉक टेस्ट पर') ||
      queryLower.includes('go on mock') ||
      queryLower.includes('go to mock') ||
      queryLower.includes('गो ऑन') ||
      queryLower.includes('गो टू') ||
      queryLower.includes('choose another') ||
      queryLower.includes('dusra exam') ||
      queryLower.includes('test page par jao') ||
      queryLower.includes('pehle page') ||
      queryLower.includes('catalog par');

    if (isReturnCatalogIntent) {
      if (context.activeView === 'exam' && !examStore.isSubmitted) {
        examStore.setSubmitModalOpen(true);
        soundEffects.playTimerAlert();
        const safeReply = isPureEnglish
          ? 'You cannot go back before submitting the exam. Submit confirmation window is open. Please submit your test first.'
          : 'Pariksha submit kiye bina aap wapas nahi ja sakte. Exam submit confirmation window open kar di gayi hai. Pehle test submit karein.';
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
      soundEffects.playSuccess();
      const reply = isPureEnglish
        ? 'Returned to Examination Catalog. You can choose another mock test or practice drill to begin.'
        : 'Mock Examination Catalog page par wapas aa gaye hain. Yahan se aap koi bhi doosra test ya practice drill chun sakte hain.';
      useAnnouncerStore.getState().announce(reply, 'assertive', true);
      return {
        success: true,
        intent: 'RETURN_CATALOG',
        userQuery: rawQuery,
        assistantReply: reply,
        actionExecuted: 'Returned to Catalog',
      };
    }

    switch (actionUpper) {
      case 'SELECT_OPTION':
      case 'CHOOSE_OPTION':
      case 'OPTION_SELECT': {
        const opt = Number(parsed.param) || (queryLower.includes('2') ? 2 : queryLower.includes('3') ? 3 : queryLower.includes('4') ? 4 : 1);
        if (context.activeView === 'exam') {
          examStore.selectOption(opt);
          soundEffects.playSelect();
          actionExecuted = `Selected Option ${opt}`;
        }
        break;
      }
      case 'CLEAR_OPTION':
      case 'CLEAR':
      case 'DESELECT': {
        if (context.activeView === 'exam') {
          examStore.clearOption();
          soundEffects.playClear();
          actionExecuted = 'Cleared Option';
        }
        break;
      }
      case 'NEXT_QUESTION':
      case 'NEXT': {
        if (context.activeView === 'exam') {
          examStore.nextQuestion();
          actionExecuted = 'Moved to Next Question';
        }
        break;
      }
      case 'PREVIOUS_QUESTION':
      case 'PREV':
      case 'PREVIOUS': {
        if (context.activeView === 'exam') {
          examStore.previousQuestion();
          actionExecuted = 'Moved to Previous Question';
        }
        break;
      }
      case 'JUMP_QUESTION': {
        const qNum = Number(parsed.param);
        if (context.activeView === 'exam' && qNum > 0 && qNum <= examStore.questions.length) {
          examStore.jumpToQuestion(qNum - 1);
          actionExecuted = `Jumped to Question ${qNum}`;
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
          examStore.readCurrentQuestion();
          actionExecuted = 'Read Current Question';
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
      case 'SUBMIT_EXAM':
      case 'SUBMIT': {
        if (context.activeView === 'exam' && !examStore.isSubmitted) {
          examStore.setSubmitModalOpen(true);
          soundEffects.playTimerAlert();
          actionExecuted = 'Opened Submit Confirmation';
        }
        break;
      }
      case 'READ_REPORT_SUMMARY':
      case 'SUMMARY': {
        const rep = context.diagnosticReport;
        const sum = rep?.verbalSummary?.join(' ') || `Aapka score ${rep?.totalScore || 0}/${rep?.maxScore || 20} raha.`;
        const reply = isPureEnglish
          ? `Diagnostic Summary for ${rep?.examTitle || 'Exam'}: ${sum}`
          : `${rep?.examTitle || 'Exam'} ki Summary: ${sum}`;
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
        const reply = isPureEnglish
          ? 'Resetting examination. Question 1 has been reloaded.'
          : 'Pariksha dobara shuru kar di gayi hai. Question 1 aapki screen par aa gaya hai.';
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
          whereReply = isPureEnglish
            ? `You have completed and submitted the "${examTitle}". You are currently on the Performance Diagnostic Report and Score Analysis screen. Your score is ${rep?.totalScore || 0} out of ${rep?.maxScore || 20} (${rep?.scorePercentage || 0}%). You can say "Read summary", "Retake test", or "Go to mock test page".`
            : `Aapne "${examTitle}" pariksha submit kar di hai. Is samay aap apne Diagnostic Report aur Score Summary page par hain. Aapka score ${rep?.totalScore || 0}/${rep?.maxScore || 20} (${rep?.scorePercentage || 0}%) raha. Aap "Summary padho", "Dobara test do", ya "Mock test page par jao" bol sakte hain.`;
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
    useAnnouncerStore.getState().announce(parsed.reply, 'assertive', true);

    return {
      success: true,
      intent: parsed.action,
      userQuery: rawQuery,
      assistantReply: parsed.reply,
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
