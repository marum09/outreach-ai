import { NextResponse } from "next/server";
import { generateOutreach, mockMode } from "@/lib/ai";
import { GenerateInput, Goal, Tone } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const GOALS: Goal[] = ["book_call", "get_reply", "free_demo", "send_case_study"];
const TONES: Tone[] = ["friendly", "direct", "consultative", "bold"];

/** Hard caps — free-tier quotas are small, so never let one request run away. */
const LIMITS = {
  short: 200,
  medium: 400,
  long: 1200,
} as const;

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, max);
}

export async function POST(req: Request) {
  let raw: any;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const input: GenerateInput = {
    yourCompany: clean(raw?.yourCompany, LIMITS.short),
    yourOffer: clean(raw?.yourOffer, LIMITS.medium),
    yourName: clean(raw?.yourName, 60),
    industry: clean(raw?.industry, LIMITS.short),
    industrySingular: clean(raw?.industrySingular, LIMITS.short),
    painPoint: clean(raw?.painPoint, LIMITS.medium),
    proofPoint: clean(raw?.proofPoint, LIMITS.medium),
    prospectName: clean(raw?.prospectName, 80),
    prospectRole: clean(raw?.prospectRole, LIMITS.short),
    prospectCompany: clean(raw?.prospectCompany, LIMITS.short),
    personalNote: clean(raw?.personalNote, LIMITS.medium),
    goal: GOALS.includes(raw?.goal) ? raw.goal : "book_call",
    tone: TONES.includes(raw?.tone) ? raw.tone : "friendly",
  };

  // Minimum viable brief: without an offer and a pain point the output is
  // generic, and generic output is what makes people churn.
  if (input.yourOffer.length < 10 || input.painPoint.length < 10) {
    return NextResponse.json(
      {
        error:
          "Tell me what you sell and the pain your prospect feels — at least a sentence each. Generic briefs produce generic emails.",
      },
      { status: 422 }
    );
  }

  try {
    const result = await generateOutreach(input);
    // Surfaced so the UI can warn when it is showing the built-in writer
    // instead of a real model. Read at runtime, never baked into the bundle.
    return NextResponse.json({ ok: true, result, mock: mockMode() });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Something went wrong generating your sequence." },
      { status: 500 }
    );
  }
}
