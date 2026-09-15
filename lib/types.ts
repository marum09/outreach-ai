export type Tone = "friendly" | "direct" | "consultative" | "bold";

export type Goal =
  | "book_call"
  | "get_reply"
  | "free_demo"
  | "send_case_study";

export type GenerateInput = {
  yourCompany: string;
  yourOffer: string;
  yourName: string;
  industry: string;
  /** Singular form of the industry, e.g. "real estate agent". Used by the
   *  built-in writer so it never has to guess plurals. Optional. */
  industrySingular: string;
  painPoint: string;
  proofPoint: string;
  prospectName: string;
  prospectRole: string;
  prospectCompany: string;
  personalNote: string;
  goal: Goal;
  tone: Tone;
};

export type EmailDraft = {
  subject: string;
  preheader: string;
  body: string;
  /** Day to send this email, relative to the first one. */
  sendAfterDays: number;
};

export type OutreachResult = {
  emails: EmailDraft[];
  linkedin: {
    connectionRequest: string;
    followUp: string;
  };
  icebreakers: string[];
  /** Which AI model produced this, or "sample" for the built-in fallback. */
  provider: string;
};

export const GOAL_LABEL: Record<Goal, string> = {
  book_call: "Book a 15-minute call",
  get_reply: "Just get a reply",
  free_demo: "Offer a free demo / audit",
  send_case_study: "Share a case study",
};

export const TONE_LABEL: Record<Tone, string> = {
  friendly: "Friendly & casual",
  direct: "Direct & to the point",
  consultative: "Consultative & curious",
  bold: "Bold & punchy",
};

/** Free-tier friendly defaults. Keep these cheap. */
export const MODEL_BY_PROVIDER = {
  // Verified live against the /models endpoint on 2026-09-13. The old
  // "llama-3.3-70b-versatile" was retired by Groq; gpt-oss-120b is the
  // strongest free text model currently on the account.
  groq: "openai/gpt-oss-120b",
  gemini: "gemini-2.5-flash",
  mistral: "mistral-large-latest",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
} as const;

export const FREE_GENERATIONS = 3;
