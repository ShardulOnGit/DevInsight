/**
 * @file shared/groq.ts
 * @description Groq API HTTP client — universal, works in both runtimes.
 *
 * Node.js 18+ has global fetch. Vite bundles for the browser which also has
 * global fetch. No polyfill, no node-fetch dependency needed.
 *
 * The API key is passed as a parameter so this function is runtime-agnostic:
 *   - Frontend: passes import.meta.env.VITE_GROK_API_KEY
 *   - Lambda:   passes key fetched from AWS Secrets Manager
 *
 * RULE: Do NOT hardcode keys or API URLs in calling code.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Default system prompt establishing the DevInsight Guardian persona. */
const GUARDIAN_SYSTEM_PROMPT = `You are DevInsight Guardian, an AI Engineering Manager. 
You are writing to a software developer who respects directness and data.
Write in the voice of a senior engineering manager who genuinely cares about their team.
Be specific, human, and direct. Reference exact numbers. Acknowledge patterns across days.
Sound like a 1:1 conversation, not an analytics report.
Always respond with valid JSON only. No markdown fences, no text outside JSON.`;

export interface GroqOptions {
  /** Defaults to 'llama3-8b-8192' */
  model?: string;
  /** Defaults to 0.65 */
  temperature?: number;
  /** Defaults to 1200 */
  maxTokens?: number;
  /** Override the system prompt if needed */
  systemPrompt?: string;
}

/**
 * Calls the Groq API with structured JSON response mode.
 *
 * @param prompt  - User-turn prompt
 * @param apiKey  - Groq API key (gsk_...)
 * @param options - Optional model/temperature overrides
 * @returns       - Raw JSON string from the model (parse in caller)
 * @throws        - Error with descriptive message on API failure
 */
export async function callGroq(
  prompt: string,
  apiKey: string,
  options: GroqOptions = {},
): Promise<string> {
  const {
    model = 'llama3-8b-8192',
    temperature = 0.65,
    maxTokens = 1200,
    systemPrompt = GUARDIAN_SYSTEM_PROMPT,
  } = options;

  if (!apiKey || apiKey === 'YOUR_GROK_API_KEY_HERE') {
    throw new Error(
      'Groq API key is not configured. Set VITE_GROK_API_KEY in .env (frontend) or devinsight/groq-api-key in AWS Secrets Manager (Lambda).',
    );
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Groq API error (HTTP ${response.status}): ${errorBody}`,
    );
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Groq API returned an empty response. Check model availability.');
  }

  return text;
}
