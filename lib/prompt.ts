import { GenerateInput, OutreachResult, GOAL_LABEL, TONE_LABEL } from "./types";

/**
 * Builds the system + user prompt.
 *
 * The whole product lives in this file. A generic "AI writer" gives generic
 * output; this prompt is what makes the output good enough that someone pays
 * $25/month instead of pasting the same thing into ChatGPT.
 */
export function buildPrompt(input: GenerateInput) {
  const system = `You are an elite B2B cold outreach copywriter. You write short, specific, reply-generating cold emails and LinkedIn messages.

Your rules — these are non-negotiable:
1. Every email body is under 80 words. Most are 40-60. Long cold emails get deleted.
2. The FIRST line must be about the prospect, never about the sender. No "I hope this finds you well", no "My name is".
3. Exactly ONE call to action per email. A soft, low-friction one (interest-based, not time-based). Prefer "Worth a look?" over "Do you have 15 minutes Tuesday at 2pm?".
4. Never use these words: leverage, synergy, unlock, elevate, supercharge, game-changer, revolutionize, "I'm reaching out", "quick question", "hope you're doing well", "cutting-edge", "seamless".
5. No exclamation marks in the body. One question mark maximum per email.
6. Sound like a human typed it on their phone. Lowercase-friendly, plain punctuation, no marketing formatting, no bullet points.
7. Use real specifics from the brief. Vague emails lose. If a specific number or detail is given, use it.
8. Never invent statistics, client names, revenue figures, results, listings, neighbourhoods, or "recent posts" that are not in the brief. If the brief mentions no specific listing or post, do not refer to one at all. Making up proof is the fastest way to lose a customer's reputation.
9. The three emails must be genuinely different angles — not the same email rewritten. Angle 1 = the pain. Angle 2 = proof or a specific observation. Angle 3 = a graceful, short breakup.
10. LinkedIn connection request must be under 300 characters (LinkedIn's hard limit). Do not pitch in it.
11. Write in the same language as the brief. Do not translate.
12. End every email body with the sender's name from the brief, on its own line. An unsigned cold email reads like a blast.`;

  const user = `BRIEF
Sender name: ${input.yourName || "(not given)"}
Sender company: ${input.yourCompany || "(not given)"}
What they sell: ${input.yourOffer || "(not given)"}
Target industry: ${input.industry || "(not given)"}
Main pain the target feels: ${input.painPoint || "(not given)"}
Proof point available: ${input.proofPoint || "none given — do NOT invent one"}

PROSPECT
Name: ${input.prospectName || "(not given)"}
Role: ${input.prospectRole || "(not given)"}
Company: ${input.prospectCompany || "(not given)"}
Personal detail / observation: ${input.personalNote || "none given — do NOT invent one, open on the role or industry instead"}

GOAL: ${GOAL_LABEL[input.goal]}
TONE: ${TONE_LABEL[input.tone]}

Write a 3-email cold sequence plus a LinkedIn pair.

Respond with ONLY valid JSON, no markdown fences, in exactly this shape:
{
  "emails": [
    {"subject": "under 45 characters, lowercase-friendly, no clickbait", "preheader": "under 60 characters, previews next to subject", "body": "under 80 words, one CTA", "sendAfterDays": 0},
    {"subject": "...", "preheader": "...", "body": "...", "sendAfterDays": 3},
    {"subject": "...", "preheader": "...", "body": "...", "sendAfterDays": 7}
  ],
  "linkedin": {
    "connectionRequest": "under 300 characters, no pitch",
    "followUp": "under 60 words, sent after they accept"
  },
  "icebreakers": ["three alternative opening lines, each under 90 characters"]
}`;

  return { system, user };
}

/** Providers frequently wrap JSON in ```json fences despite being told not to. */
export function extractJson(raw: string): any {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* fall through */
    }
  }

  // Last resort: grab the outermost braces.
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      /* fall through */
    }
  }

  throw new Error("Model did not return parseable JSON");
}

/** Defensive: never let a sloppy model response crash the request. */
export function normaliseResult(parsed: any, provider: string): OutreachResult {
  const emails = Array.isArray(parsed?.emails) ? parsed.emails : [];

  const cleanEmails = emails
    .slice(0, 3)
    .filter((e: any) => e && typeof e.body === "string" && e.body.trim().length > 10)
    .map((e: any, i: number) => ({
      subject: String(e.subject ?? `Following up`).slice(0, 90),
      preheader: String(e.preheader ?? "").slice(0, 120),
      body: String(e.body).trim(),
      sendAfterDays: Number.isFinite(e.sendAfterDays) ? e.sendAfterDays : i * 3,
    }));

  if (cleanEmails.length === 0) {
    throw new Error("Model returned no usable email bodies");
  }

  const linkedin = parsed?.linkedin ?? {};
  const icebreakers = Array.isArray(parsed?.icebreakers)
    ? parsed.icebreakers.filter((s: any) => typeof s === "string" && s.trim()).slice(0, 5)
    : [];

  return {
    emails: cleanEmails,
    linkedin: {
      connectionRequest: String(
        linkedin.connectionRequest ?? "Hi — noticed your work and wanted to connect."
      ).slice(0, 300),
      followUp: String(
        linkedin.followUp ?? "Thanks for connecting."
      ).trim(),
    },
    icebreakers: icebreakers.map((s: string) => s.trim()),
    provider,
  };
}
