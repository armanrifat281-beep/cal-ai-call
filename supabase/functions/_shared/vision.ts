import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0';

/**
 * Which model reads the photo.
 *
 * The app's contract with the analyser was always written to be
 * provider-independent - see `src/features/scanner/types.ts` - and this is
 * the half that makes that real. Everything above this file speaks in
 * prompts and JSON; only this file knows whose API is being called.
 *
 * The provider is chosen by which key is configured, not by a setting. A
 * deployment has whichever account its owner pays for (or does not pay
 * for), and asking them to keep a key and a matching toggle in step is one
 * more thing to get wrong.
 *
 * Anthropic wins when both are set: it is what the prompts were written and
 * tuned against.
 */
export interface VisionRequest {
  systemPrompt: string;
  userPrompt: string;
  /**
   * The photo, already validated and resized by the app.
   *
   * Optional because not every request has one: a recipe asked for from a
   * list of ingredients is text only, and the same provider layer serves
   * both rather than each feature growing its own copy.
   */
  imageBase64?: string | null;
  mimeType?: string | null;
  /** JSON Schema the answer must fit. */
  schema: Record<string, unknown>;
  maxTokens: number;
  timeoutMs: number;
  /**
   * How hard to think, where the provider supports it.
   *
   * Per request rather than per provider: reading a photograph needs care
   * but not deep reasoning, while writing a recipe that has to be cookable
   * genuinely does, and collapsing the two to one value would quietly
   * downgrade one of them.
   */
  effort?: 'low' | 'medium' | 'high';
}

export interface VisionResult {
  /** The model's raw JSON text. Parsing and validation are the caller's. */
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
  /** True when the model declined rather than failed. */
  refused: boolean;
  /**
   * True when the answer was cut off at the token budget.
   *
   * Worth distinguishing: the text is valid as far as it goes but the JSON
   * is unclosed, so it fails to parse. Reported as "unreadable" it looks
   * like a broken model; named, it says the budget was too small for a busy
   * plate, which is a different thing to fix.
   */
  truncated: boolean;
}

export interface VisionProvider {
  /** Recorded against every scan, so a figure can be traced to its model. */
  readonly label: string;
  analyse(request: VisionRequest): Promise<VisionResult>;
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

const ANTHROPIC_MODEL = 'claude-opus-5-5';

/**
 * Used when a request does not ask for a particular effort.
 *
 * `medium` suits reading a photo: it needs care but not deep reasoning.
 * Callers that need more - writing a recipe someone has to cook from - set
 * `effort` on the request.
 */
const ANTHROPIC_EFFORT = 'medium' as const;

/** The photo first when there is one, then the instruction. */
function anthropicContent(request: VisionRequest): Anthropic.ContentBlockParam[] {
  const content: Anthropic.ContentBlockParam[] = [];

  if (request.imageBase64 && request.mimeType) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: request.mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
        data: request.imageBase64,
      },
    });
  }

  content.push({ type: 'text', text: request.userPrompt });
  return content;
}

function anthropicProvider(apiKey: string, timeoutMs: number): VisionProvider {
  return {
    label: ANTHROPIC_MODEL,

    async analyse(request: VisionRequest): Promise<VisionResult> {
      const client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 1 });

      const response = await client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: request.maxTokens,
        system: request.systemPrompt,
        output_config: {
          effort: request.effort ?? ANTHROPIC_EFFORT,
          format: { type: 'json_schema', schema: request.schema },
        },
        messages: [{ role: 'user', content: anthropicContent(request) }],
      });

      return {
        // Checked before the content is read: a refusal returns HTTP 200
        // with no usable output.
        refused: response.stop_reason === 'refusal',
        truncated: response.stop_reason === 'max_tokens',
        text: response.content
          .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
          .map((block) => block.text)
          .join(''),
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Google Gemini
// ---------------------------------------------------------------------------

/**
 * Set from the key's own model listing rather than from documentation.
 *
 * Google retires names quickly and without warning - a live key here
 * answered 404 for `gemini-2.5-flash` with "no longer available to new
 * users" - so this is the one that was actually observed to work, and it is
 * worth re-checking when analysis starts failing with 404.
 */
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
}

/** Finish reasons that mean the model declined, not that it failed. */
const GEMINI_REFUSALS = new Set(['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII']);

/**
 * Statuses worth one more attempt.
 *
 * A preview model behind a load balancer fails this way occasionally, and the
 * second attempt usually works. The Anthropic client has done this all along
 * (`maxRetries: 1`); this path had nothing, so a momentary blip reached the
 * user as a flat "the analysis service had a problem".
 *
 * 429 is deliberately absent. A quota that is spent is not transient, and
 * retrying it immediately would only spend the next second's quota too.
 */
const GEMINI_RETRYABLE = new Set([500, 502, 503, 504]);

const GEMINI_RETRY_DELAY_MS = 1_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Google's reply, whether or not it is the JSON we expected.
 *
 * Read as text first and parsed second, because an error from a gateway
 * rather than from the model arrives as an HTML page. Calling `.json()` on
 * that throws a bare `SyntaxError`, which loses the status and reaches the
 * caller as an unexplained failure - the status is the one piece that says
 * whether retrying is worth anything.
 */
async function readGeminiBody(
  response: Response,
): Promise<{ parsed: GeminiResponse | null; text: string }> {
  const text = await response.text();
  try {
    return { parsed: JSON.parse(text) as GeminiResponse, text };
  } catch {
    return { parsed: null, text };
  }
}

function geminiError(status: number, parsed: GeminiResponse | null, text: string): Error {
  const message = parsed?.error?.message ??
    // A short excerpt, so an HTML gateway page is recognisable in a log
    // without pasting a whole page into it.
    `Gemini returned ${status}: ${text.slice(0, 200).replace(/\s+/g, ' ').trim()}`;

  const error = new Error(message);
  Object.assign(error, {
    status,
    // Google answers 429 both for "too fast, slow down" and for "your daily
    // allowance is gone until tomorrow". Telling a user to try again in a
    // minute when the truth is twenty-one hours sends them round a loop that
    // cannot end, so the two are separated here.
    quotaExhausted: status === 429 && /quota/i.test(message),
  });
  return error;
}

/**
 * The answer's shape, written into the prompt.
 *
 * Gemini's `responseSchema` takes an OpenAPI subset that this app's schema
 * does not fit: converted and sent, a live call came back "Request contains
 * an invalid argument" with nothing to say which part it disliked. Asking
 * for JSON and describing the shape in words costs one round of validation
 * risk and removes a whole class of opaque 400s.
 *
 * Nothing is lost by it. `validateAnalysis` already checks every field and
 * every range on the way back, and always did - a schema cannot stop a
 * model returning 50,000 calories for an apple, so the schema was never
 * what made the answer safe.
 *
 * The schema itself is used as the description, so the two cannot drift.
 */
function shapeInstruction(schema: Record<string, unknown>): string {
  return [
    'Answer with JSON only - no prose, no code fence.',
    'It must match this JSON Schema exactly:',
    JSON.stringify(schema),
  ].join('\n');
}

/** The photo first when there is one, then the instruction. */
function geminiParts(request: VisionRequest): unknown[] {
  const parts: unknown[] = [];

  if (request.imageBase64 && request.mimeType) {
    parts.push({
      inlineData: { mimeType: request.mimeType, data: request.imageBase64 },
    });
  }

  parts.push({ text: request.userPrompt });
  return parts;
}

function geminiProvider(apiKey: string, timeoutMs: number): VisionProvider {
  return {
    label: GEMINI_MODEL,

    async analyse(request: VisionRequest): Promise<VisionResult> {
      const body = JSON.stringify({
        systemInstruction: {
          parts: [{ text: `${request.systemPrompt}\n\n${shapeInstruction(request.schema)}` }],
        },
        contents: [{ role: 'user', parts: geminiParts(request) }],
        generationConfig: {
          maxOutputTokens: request.maxTokens,
          responseMimeType: 'application/json',
        },
      });

      // One shared deadline rather than one per attempt: the app is waiting,
      // and two full-length attempts would outlast it and turn a retry into
      // a worse failure than the one it was meant to fix.
      const deadline = Date.now() + timeoutMs;
      let pending: Error | null = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;

        const response = await fetch(
          `${GEMINI_ENDPOINT}/${GEMINI_MODEL}:generateContent`,
          {
            method: 'POST',
            headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(remaining),
            body,
          },
        );

        const { parsed, text } = await readGeminiBody(response);

        if (!response.ok) {
          // Thrown so the caller's existing provider-error path handles it,
          // carrying the status the way the Anthropic SDK does.
          const error = geminiError(response.status, parsed, text);
          const last = attempt === 1;
          if (last || !GEMINI_RETRYABLE.has(response.status)) throw error;

          pending = error;
          const pause = Math.min(GEMINI_RETRY_DELAY_MS, Math.max(0, deadline - Date.now()));
          if (pause === 0) break;
          await delay(pause);
          continue;
        }

        if (parsed === null) {
          // HTTP 200 carrying something that is not JSON. Nothing to retry
          // against, and the caller needs a message it can log.
          throw geminiError(response.status, null, text);
        }

        const candidate = parsed.candidates?.[0];
        const finish = candidate?.finishReason;

        return {
          refused: finish !== undefined && GEMINI_REFUSALS.has(finish),
          truncated: finish === 'MAX_TOKENS',
          text: (candidate?.content?.parts ?? [])
            .map((part) => part.text ?? '')
            .join(''),
          inputTokens: parsed.usageMetadata?.promptTokenCount ?? null,
          outputTokens: parsed.usageMetadata?.candidatesTokenCount ?? null,
        };
      }

      throw pending ?? new Error('Gemini did not answer within the time allowed');
    },
  };
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

/**
 * The configured provider, or null when neither key is set.
 *
 * Null is what makes the function answer 503 `not_configured` rather than
 * failing in a way that looks like a server fault.
 */
export function selectVisionProvider(timeoutMs: number): VisionProvider | null {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (anthropicKey) return anthropicProvider(anthropicKey, timeoutMs);

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (geminiKey) return geminiProvider(geminiKey, timeoutMs);

  return null;
}
