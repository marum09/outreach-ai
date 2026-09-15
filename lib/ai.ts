import { buildPrompt, extractJson, normaliseResult } from "./prompt";
import { generateFallback } from "./fallback";
import { GenerateInput, OutreachResult, MODEL_BY_PROVIDER } from "./types";

/**
 * Demo/development mode: skip the network entirely and use the built-in writer.
 *
 * This deliberately reads a server-only variable at runtime. An earlier version
 * used NEXT_PUBLIC_MOCK_AI, which Next.js inlines into the client bundle at
 * build time — so a build made once with the flag set stayed in mock mode
 * forever, no matter what the runtime environment said.
 */
export function mockMode(): boolean {
  return process.env.MOCK_AI === "1";
}

/**
 * Calls free-tier AI providers in order until one answers.
 *
 * Every provider here has a $0 tier and needs no credit card, which is the
 * whole point: this product can run for months before it costs anything.
 *
 * Order matters — Groq is first because it does not train on submitted data,
 * which is what a B2B customer actually cares about.
 */
type Provider = {
  name: string;
  key: string | undefined;
  call: (key: string, input: GenerateInput) => Promise<string>;
};

export async function generateOutreach(input: GenerateInput): Promise<OutreachResult> {
  if (mockMode()) {
    const sample = generateFallback(input);
    return { ...sample, provider: "sample (mock mode)" };
  }

  const providers: Provider[] = [
    {
      name: `Groq / ${MODEL_BY_PROVIDER.groq}`,
      key: process.env.GROQ_API_KEY,
      call: callGroq,
    },
    {
      name: `Google / ${MODEL_BY_PROVIDER.gemini}`,
      key: process.env.GEMINI_API_KEY,
      call: callGemini,
    },
    {
      name: `Mistral / ${MODEL_BY_PROVIDER.mistral}`,
      key: process.env.MISTRAL_API_KEY,
      call: callMistral,
    },
    {
      name: `OpenRouter / ${MODEL_BY_PROVIDER.openrouter}`,
      key: process.env.OPENROUTER_API_KEY,
      call: callOpenRouter,
    },
  ].filter((p) => Boolean(p.key));

  if (providers.length === 0) {
    return { ...generateFallback(input), provider: "sample (no API key configured)" };
  }

  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const raw = await provider.call(provider.key!, input);
      const parsed = extractJson(raw);
      return normaliseResult(parsed, provider.name);
    } catch (err: any) {
      errors.push(`${provider.name}: ${err?.message ?? String(err)}`);
    }
  }

  // All providers failed (usually free-tier quota). Still return something useful.
  return {
    ...generateFallback(input),
    provider: `sample (all providers failed: ${errors.join(" | ")})`,
  };
}

/* ------------------------------------------------------------------ */
/*  Provider adapters. All are OpenAI-compatible except Gemini.        */
/* ------------------------------------------------------------------ */

async function chat(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  pick: (json: any) => string
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${detail.slice(0, 180)}`);
    }

    const json = await res.json();
    const text = pick(json);
    if (!text || !text.trim()) throw new Error("empty completion");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGroq(key: string, input: GenerateInput): Promise<string> {
  const { system, user } = buildPrompt(input);
  // Overridable so the call can be pointed at a proxy, a self-hosted Groq-compatible
  // gateway, or a local stub during testing. Defaults to the real endpoint.
  const base = process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";
  // Model names get retired by providers; this lets you swap without redeploying.
  const model = process.env.GROQ_MODEL ?? MODEL_BY_PROVIDER.groq;
  return chat(
    `${base.replace(/\/$/, "")}/chat/completions`,
    { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    {
      model,
      temperature: 0.8,
      // The full sequence (3 emails + LinkedIn + openers) regularly needs more
      // than 1400 output tokens. A truncated completion is invalid JSON, which
      // Groq rejects with json_validate_failed.
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    (j) => j?.choices?.[0]?.message?.content ?? ""
  );
}

async function callOpenRouter(key: string, input: GenerateInput): Promise<string> {
  const { system, user } = buildPrompt(input);
  return chat(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://outreachai.app",
      "X-Title": "OutreachAI",
    },
    {
      model: MODEL_BY_PROVIDER.openrouter,
      temperature: 0.8,
      max_tokens: 4000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    (j) => j?.choices?.[0]?.message?.content ?? ""
  );
}

async function callMistral(key: string, input: GenerateInput): Promise<string> {
  const { system, user } = buildPrompt(input);
  return chat(
    "https://api.mistral.ai/v1/chat/completions",
    { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    {
      model: MODEL_BY_PROVIDER.mistral,
      temperature: 0.8,
      // The full sequence (3 emails + LinkedIn + openers) regularly needs more
      // than 1400 output tokens. A truncated completion is invalid JSON, which
      // Groq rejects with json_validate_failed.
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    (j) => j?.choices?.[0]?.message?.content ?? ""
  );
}

async function callGemini(key: string, input: GenerateInput): Promise<string> {
  const { system, user } = buildPrompt(input);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_BY_PROVIDER.gemini}:generateContent?key=${encodeURIComponent(key)}`;

  return chat(
    url,
    { "Content-Type": "application/json" },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    },
    (j) => j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? ""
  );
}
