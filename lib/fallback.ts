import { GenerateInput, Goal, OutreachResult } from "./types";

/**
 * Deterministic, zero-cost generator.
 *
 * Two jobs:
 *  1. If every AI provider is unavailable (free quota exhausted, network down,
 *     no key configured) the user still gets usable output instead of an error.
 *  2. With MOCK_AI=1 set on the server it powers local development and demos.
 *
 * The copy follows the same rules the AI prompt enforces: short, prospect-first,
 * one soft CTA, no banned words.
 *
 * IMPORTANT — why this file is longer than it looks:
 * users paste whole sentences into short fields ("They have 400 leads in their
 * CRM and no time to follow up."). Every field is therefore normalised into the
 * specific grammatical shape each sentence slot needs, otherwise you get things
 * like "If They have 400 leads. is the part..." — which is the bug this file
 * originally shipped with.
 */
export function generateFallback(input: GenerateInput): OutreachResult {
  const first = firstName(input.prospectName) ?? "there";
  const sender = input.yourName?.trim() || "—";

  /* Proper nouns keep their capitalisation everywhere. */
  const company = clean(input.prospectCompany);
  const companyLower = company ? deCap(company) : "your team";
  const role = clean(input.prospectRole);
  // "Broker / Owner" -> "broker". Pluralising a slash-separated list reads badly.
  const roleLower = role ? deCap(role.split(/\s*[/,|]\s*/)[0]) : "your team";
  const industry = clean(input.industry);
  const industryLower = industry ? deCap(industry) : "your space";
  const singular = clean(input.industrySingular) || industryLower;

  /* The prospect pain arrives as a sentence; we need it in three shapes. */
  const painSentence = clean(input.painPoint); // "They have 400 leads in their CRM"
  const painLower = deCap(painSentence); // mid-sentence use
  // Split on "and" too: "400 leads in their CRM and no time to follow up" is
  // two ideas, and only the first one fits a subject line or a preposition.
  const painClause = painLower.split(/[,;]|\s+and\s+/)[0].trim();
  const topic = topicPhrase(painClause, industryLower); // "the 400 leads in your CRM"

  const note = clean(input.personalNote);
  const proof = clean(input.proofPoint);
  const offer = offerClause(input.yourOffer);

  // "They just opened a second office" needs "that" after "saw" to read
  // correctly; a bare noun phrase ("the Plano listing") does not.
  const noteAfterSaw = /^(they|you|we|it|he|she|their|the team)\b/i.test(note)
    ? `that ${deCap(note)}`
    : deCap(note);

  const email1 = [
    note ? `${cap(first)}, saw ${noteAfterSaw}.` : `${cap(first)}, quick one.`,
    ``,
    painSentence
      ? `${painSentence}. Most ${pluralize(singular)} I talk to say that's the part they keep meaning to fix.`
      : `Most ${pluralize(singular)} I talk to say the same thing.`,
    ``,
    `${offer}.`,
    ``,
    `Worth a look?`,
    ``,
    sender,
  ].join("\n");

  const email2 = proof
    ? [
        `${cap(first)}, following up on ${topic}.`,
        ``,
        `${proof}.`,
        ``,
        `${cap(companyLower)} looks like a similar shape, which is why I thought it was worth a note.`,
        ``,
        `Want me to send over how it would work for you?`,
        ``,
        sender,
      ].join("\n")
    : [
        `${cap(first)}, one more thought on ${topic}.`,
        ``,
        `The teams that fix this usually start small — one process, one week, measure the difference.`,
        ``,
        `${offer}, starting with that first week.`,
        ``,
        `Want the short version of how it works?`,
        ``,
        sender,
      ].join("\n");

  const email3 = [
    `${cap(first)}, closing the loop so I'm not cluttering your inbox.`,
    ``,
    `If ${topic} isn't a priority at ${companyLower} right now, no worries at all — genuinely.`,
    ``,
    `If it comes back up, this is the thing to look at.`,
    ``,
    sender,
  ].join("\n");

  const connectionRequest = clip(
    note
      ? `Hi ${first} — ${note}. I work with ${pluralize(roleLower)} on ${topic}. No pitch, just thought it'd be useful to connect.`
      : `Hi ${first} — I work with ${pluralize(roleLower)} on ${topic}. No pitch, just thought it'd be useful to connect.`,
    298
  );

  const followUp = [
    `Thanks for connecting, ${first}.`,
    ``,
    `Not going to pitch you here. I write about ${topic} fairly often — happy to share what's working if that's useful.`,
    ``,
    `Otherwise, good to have you in the network.`,
  ].join("\n");

  return {
    emails: [
      {
        subject: subjectFor(input.goal, topic, companyLower),
        preheader: clip(`One thing worth a look at ${companyLower}`, 60),
        body: email1,
        sendAfterDays: 0,
      },
      {
        subject: clip(`re: ${topic}`, 45),
        preheader: proof ? "The result, briefly" : "Starting small",
        body: email2,
        sendAfterDays: 3,
      },
      {
        subject: "closing the loop",
        preheader: "No reply needed",
        body: email3,
        sendAfterDays: 7,
      },
    ],
    linkedin: { connectionRequest, followUp },
    icebreakers: [
      note ? `${cap(first)}, saw ${noteAfterSaw}.` : `${cap(first)}, quick one on ${topic}.`,
      `Quick one on ${topic} at ${companyLower}.`,
      `Noticed a lot of ${pluralize(singular)} hit the same wall with ${topic}.`,
    ].filter((s) => s.length > 4 && s.length <= 120),
    provider: "sample",
  };
}

/* ------------------------------------------------------------------ */
/*  Text normalisation. Users paste whole sentences into short fields. */
/* ------------------------------------------------------------------ */

/** Collapse whitespace and strip trailing sentence punctuation. */
function clean(s?: string): string {
  const v = (s ?? "").replace(/\s+/g, " ").trim();
  return v.replace(/[.!?\s]+$/g, "");
}

/**
 * Lowercase the first letter unless the field is a proper noun or an acronym.
 *   "They have 400 leads" -> "they have 400 leads"
 *   "Miller Realty"       -> "Miller Realty"   (second word capitalised)
 *   "CRM hygiene"         -> "CRM hygiene"     (acronym first word)
 *
 * Exported for unit tests — the single-character branch here is a genuine
 * footgun, so it is pinned by test/unit.test.ts.
 */
export function deCap(v: string): string {
  if (!v) return v;
  const words = v.split(/\s+/);
  const firstWord = words[0] ?? "";
  const secondWord = words[1] ?? "";
  const firstChar = firstWord.charAt(0);

  // Length guard: a one-letter word like "I" or "A" is not an acronym.
  const firstIsAcronym =
    firstWord.length > 1 && firstWord === firstWord.toUpperCase();
  const secondIsProper =
    secondWord.length > 0 && secondWord.charAt(0) === secondWord.charAt(0).toUpperCase();

  if (firstIsAcronym || secondIsProper || firstChar === firstChar.toLowerCase()) return v;

  // Replace exactly one character. Slicing by firstWord.length here would
  // truncate the whole word ("They..." -> "t...").
  return firstChar.toLowerCase() + v.slice(1);
}

/**
 * Naive English pluralisation. Exported for unit tests.
 *   "real estate agent" -> "real estate agents"
 *   "broker"            -> "brokers"
 *   "agency"            -> "agencies"
 *   "already plural"    -> "already plural"   (no double s)
 */
export function pluralize(noun: string): string {
  const w = noun.trim();
  if (!w) return w;
  if (/(s|x|z|ch|sh)$/i.test(w)) return w; // "agencies", "boss" — leave alone
  if (/[^aeiou]y$/i.test(w)) return `${w.slice(0, -1)}ies`;
  if (/s$/i.test(w)) return w;
  return `${w}s`;
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.]+$/, "") + "…";
}

function firstName(full?: string): string | null {
  const n = full?.trim().split(/\s+/)[0];
  return n && n.length > 1 ? n : null;
}

/**
 * The offer field usually arrives as "We run X." or "I help agents do Y."
 * Turn it into a clause that reads correctly as the subject of its own sentence.
 */
function offerClause(raw?: string): string {
  const v = clean(raw);
  if (!v) return "We can help with that";
  if (/^(we|i)\b/i.test(v)) return cap(v);
  return cap(`we ${deCap(v)}`);
}

/**
 * Turn a pain clause into a noun phrase that fits after a preposition.
 *   "they have 400 leads in their CRM"  -> "the 400 leads in your CRM"
 *   "slow reply times"                  -> "slow reply times"
 *
 * The caller passes the FIRST CLAUSE only — a whole run-on sentence never fits
 * into "If ___ isn't a priority right now".
 */
function topicPhrase(firstClauseRaw: string, industry: string): string {
  const firstClause = firstClauseRaw.trim();
  if (!firstClause) return `the usual ${industry} grind`;

  // "they have 400 leads in their CRM" -> "the 400 leads in your CRM"
  const haveMatch = firstClause.match(
    /^(?:they|you|we|their team|the team)\s+(?:have|has|had|keep|are keeping)\s+(.+)$/i
  );
  if (haveMatch) {
    const rest = haveMatch[1].replace(/\btheir\b/gi, "your").trim();
    return clip(`the ${rest}`, 70);
  }

  // Already a noun phrase ("slow reply times", "manual data entry").
  if (!/^(they|you|we|it|their|the team)\b/i.test(firstClause)) {
    return clip(firstClause, 70);
  }

  // Some other full clause — refer to it generically rather than mangling it.
  return "this";
}

/** Short subjects beat long ones; never truncate a raw pain sentence. */
function subjectFor(goal: Goal, painLower: string, companyLower: string): string {
  const short = painLower.split(/[,;]/)[0].trim();
  if (short && short.length <= 45) return short;
  if (short) return clip(short, 45);
  switch (goal) {
    case "free_demo":
      return clip(`free audit for ${companyLower}`, 45);
    case "send_case_study":
      return "a result worth two minutes";
    case "get_reply":
      return clip(`quick one, ${companyLower}`, 45);
    default:
      return clip(`15 minutes for ${companyLower}?`, 45);
  }
}
