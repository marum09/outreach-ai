"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FREE_GENERATIONS,
  GOAL_LABEL,
  GenerateInput,
  Goal,
  OutreachResult,
  TONE_LABEL,
  Tone,
} from "@/lib/types";

/* ---------------------------------------------------------------- */
/*  Copy. Change these to your niche before you launch.             */
/* ---------------------------------------------------------------- */
const HEADCOUNT_COPY = {
  name: "RealtyReach",
  heroLine1: "Cold emails for",
  heroLine2: "real estate agents",
  heroBody:
    "Paste one lead's details. Get a 3-email follow-up sequence plus the LinkedIn message — written for real estate, not for everyone.",
};

/* Swap the CHECKOUT_URL for your Paddle or Polar checkout link once approved. */
const CHECKOUT_URL = "#replace-with-your-paddle-or-polar-checkout-link";
const PRICE = "$49";
const PRICE_NOTE = "lifetime · launch price";

/* ---------------------------------------------------------------- */

const STORAGE_KEY = "outreachai.generations";

const GOALS: Goal[] = ["book_call", "get_reply", "free_demo", "send_case_study"];
const TONES: Tone[] = ["friendly", "direct", "consultative", "bold"];

const DEFAULTS: GenerateInput = {
  yourCompany: "",
  yourOffer: "",
  yourName: "",
  industry: "US real estate agents and brokers",
  industrySingular: "real estate agent",
  painPoint: "",
  proofPoint: "",
  prospectName: "",
  prospectRole: "",
  prospectCompany: "",
  personalNote: "",
  goal: "book_call",
  tone: "friendly",
};

function countWords(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export default function Home() {
  const [form, setForm] = useState<GenerateInput>(DEFAULTS);
  const [result, setResult] = useState<OutreachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("email-0");
  // Start at zero spent. Starting this at FREE_GENERATIONS (the old bug) made
  // `locked` true on the very first render, so brand-new visitors landed
  // straight on the paywall before generating anything.
  const [used, setUsed] = useState<number>(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [mock, setMock] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) setUsed(Number(raw) || 0);
    } catch {
      /* private mode — leave the default */
    }

    // Pre-fill from URL params — the Chrome extension opens the app as
    // /?name=...&role=...&company=... after reading a LinkedIn profile.
    const q = new URLSearchParams(window.location.search);
    const prefill = {
      prospectName: q.get("name") ?? "",
      prospectRole: q.get("role") ?? "",
      prospectCompany: q.get("company") ?? "",
      personalNote: q.get("note") ?? "",
    };
    if (Object.values(prefill).some(Boolean)) {
      setForm((f) => ({ ...f, ...prefill }));
    }
  }, []);

  const locked = used >= FREE_GENERATIONS;

  const set = (key: keyof GenerateInput) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (loading || locked) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);

      setResult(json.result);
      setMock(Boolean(json.mock));
      setTab("email-0");

      const next = used + 1;
      setUsed(next);
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* non-fatal */
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function copy(id: string, text: string) {
    const value = text.trim();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        throw new Error("no clipboard");
      }
    } catch {
      // Sandboxed iframes block the async clipboard — fall back to execCommand.
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* nothing more we can do */
      }
      document.body.removeChild(ta);
    }
    setCopied(id);
    setTimeout(() => setCopied(null), 1600);
  }

  const tabs = useMemo(() => {
    if (!result) return [];
    const list = result.emails.map((_, i) => ({
      id: `email-${i}`,
      label: `Email ${i + 1}`,
    }));
    list.push({ id: "linkedin", label: "LinkedIn" });
    if (result.icebreakers?.length) list.push({ id: "icebreakers", label: "Openers" });
    return list;
  }, [result]);

  // True only when the server runs with MOCK_AI=1 (demo mode). A quota fallback
  // still shows real provider diagnostics in the "Generated by" line below.
  const mockMode = mock;

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <div className="logo">
            <span className="logo-dot" />
            {HEADCOUNT_COPY.name}
          </div>
          <div className="pill">
            {Math.max(FREE_GENERATIONS - used, 0)} of {FREE_GENERATIONS} free generations left
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="hero">
          <h1>
            {HEADCOUNT_COPY.heroLine1} <em>{HEADCOUNT_COPY.heroLine2}</em>
          </h1>
          <p>{HEADCOUNT_COPY.heroBody}</p>
          <div className="hero-sub">
            Under 80 words per email · one soft CTA · zero banned buzzwords
          </div>
        </section>

        {mockMode && (
          <div className="notice">
            <b>Sample output.</b> No AI key is configured yet, so this is the built-in fallback
            writer. Add a free <b>GROQ_API_KEY</b> in <code>.env.local</code> to switch to the real
            model — no credit card needed.
          </div>
        )}

        <div className="grid">
          {/* ---------------- form ---------------- */}
          <form className="card" onSubmit={generate}>
            <h2>Your offer</h2>
            <p className="hint">Filled once. This is what makes the emails specific.</p>

            <div className="row">
              <div className="field">
                <label htmlFor="yourName">Your name</label>
                <input id="yourName" value={form.yourName} onChange={set("yourName")} placeholder="Ali Khan" />
              </div>
              <div className="field">
                <label htmlFor="yourCompany">Company</label>
                <input
                  id="yourCompany"
                  value={form.yourCompany}
                  onChange={set("yourCompany")}
                  placeholder="Acme"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="yourOffer">What you sell *</label>
              <textarea
                id="yourOffer"
                value={form.yourOffer}
                onChange={set("yourOffer")}
                placeholder="We run follow-up systems for real estate agents so old leads stop going cold."
              />
            </div>

            <div className="row">
              <div className="field">
                <label htmlFor="industry">Who you sell to</label>
                <input
                  id="industry"
                  value={form.industry}
                  onChange={set("industry")}
                  placeholder="real estate agents"
                />
              </div>
              <div className="field">
                <label htmlFor="industrySingular">Singular form</label>
                <input
                  id="industrySingular"
                  value={form.industrySingular}
                  onChange={set("industrySingular")}
                  placeholder="real estate agent"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="painPoint">Their main pain *</label>
              <textarea
                id="painPoint"
                value={form.painPoint}
                onChange={set("painPoint")}
                placeholder="They have 400 leads in their CRM and no time to follow up, so deals die."
              />
            </div>

            <div className="field">
              <label htmlFor="proofPoint">Proof point (optional)</label>
              <textarea
                id="proofPoint"
                value={form.proofPoint}
                onChange={set("proofPoint")}
                placeholder="Only add a real result. If you leave this blank the AI will not invent one."
              />
            </div>

            <div className="section-label">This prospect</div>

            <div className="row">
              <div className="field">
                <label htmlFor="prospectName">Name</label>
                <input
                  id="prospectName"
                  value={form.prospectName}
                  onChange={set("prospectName")}
                  placeholder="Sarah Miller"
                />
              </div>
              <div className="field">
                <label htmlFor="prospectCompany">Company</label>
                <input
                  id="prospectCompany"
                  value={form.prospectCompany}
                  onChange={set("prospectCompany")}
                  placeholder="Miller Realty"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="prospectRole">Role</label>
              <input
                id="prospectRole"
                value={form.prospectRole}
                onChange={set("prospectRole")}
                placeholder="Broker / Owner"
              />
            </div>

            <div className="field">
              <label htmlFor="personalNote">Something you noticed about them</label>
              <textarea
                id="personalNote"
                value={form.personalNote}
                onChange={set("personalNote")}
                placeholder="They just opened a second office in Plano."
              />
            </div>

            <div className="section-label">Goal</div>
            <div className="seg">
              {GOALS.map((g) => (
                <button
                  type="button"
                  key={g}
                  aria-pressed={form.goal === g}
                  onClick={() => setForm((f) => ({ ...f, goal: g }))}
                >
                  {GOAL_LABEL[g]}
                </button>
              ))}
            </div>

            <div className="section-label">Tone</div>
            <div className="seg">
              {TONES.map((t) => (
                <button
                  type="button"
                  key={t}
                  aria-pressed={form.tone === t}
                  onClick={() => setForm((f) => ({ ...f, tone: t }))}
                >
                  {TONE_LABEL[t]}
                </button>
              ))}
            </div>

            <button className="btn" type="submit" disabled={loading || locked}>
              {loading ? (
                <>
                  <span className="spinner" />
                  Writing your sequence…
                </>
              ) : locked ? (
                "Free generations used"
              ) : (
                "Generate sequence"
              )}
            </button>

            {error && <p className="err">{error}</p>}
          </form>

          {/* ---------------- results ---------------- */}
          <section className="card">
            {!result ? (
              <div className="empty">
                <h3>Your sequence appears here</h3>
                <p>
                  Fill in your offer and one prospect on the left. You get three emails, a LinkedIn
                  pair, and three alternative openers.
                </p>
              </div>
            ) : (
              <>
                <div className="tabs" role="tablist">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={tab === t.id}
                      onClick={() => setTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {tabs.map((t) => (
                  <div key={t.id} hidden={tab !== t.id}>
                    {t.id.startsWith("email-") && (
                      <EmailView
                        email={result.emails[Number(t.id.split("-")[1])]}
                        index={Number(t.id.split("-")[1])}
                        onCopy={copy}
                        copied={copied === t.id}
                      />
                    )}
                    {t.id === "linkedin" && (
                      <LinkedinView data={result.linkedin} onCopy={copy} copied={copied} />
                    )}
                    {t.id === "icebreakers" && (
                      <IcebreakerView lines={result.icebreakers} onCopy={copy} copied={copied} />
                    )}
                  </div>
                ))}

                <p className="meta" style={{ marginTop: 16 }}>
                  Generated by <b>{result.provider}</b>
                </p>
              </>
            )}
          </section>
        </div>
      </main>

      <footer>
        <div className="wrap">
          {HEADCOUNT_COPY.name} · built for one industry on purpose · {PRICE} {PRICE_NOTE}
        </div>
      </footer>

      {locked && <Paywall onClose={null} />}
    </>
  );
}

/* ---------------------------------------------------------------- */

function EmailView({
  email,
  index,
  onCopy,
  copied,
}: {
  email: OutreachResult["emails"][number];
  index: number;
  onCopy: (id: string, text: string) => void;
  copied: boolean;
}) {
  if (!email) return null;
  const words = countWords(email.body);
  const full = `Subject: ${email.subject}\n\n${email.body}`;

  return (
    <div>
      <div className="result-head">
        <div className="meta">
          Send <b>day {email.sendAfterDays === 0 ? 1 : email.sendAfterDays + 1}</b>
          {index > 0 && <> · {email.sendAfterDays - (index === 1 ? 0 : 3)} days after the last</>}
        </div>
        <button className="btn btn-ghost" onClick={() => onCopy(`email-${index}`, full)}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      <div className="subject-line">
        Subject: <b>{email.subject}</b>
        {email.preheader && <> · {email.preheader}</>}
      </div>

      <pre className="body">{email.body}</pre>

      <div className="wordcount">
        {words} words {words <= 80 ? "· good length for cold email" : "· trim this, it's long"}
      </div>
    </div>
  );
}

function LinkedinView({
  data,
  onCopy,
  copied,
}: {
  data: OutreachResult["linkedin"];
  onCopy: (id: string, text: string) => void;
  copied: string | null;
}) {
  return (
    <div>
      <div className="result-head">
        <div className="meta">
          Connection request · <b>{data.connectionRequest.length}/300 characters</b>
        </div>
        <button className="btn btn-ghost" onClick={() => onCopy("li-1", data.connectionRequest)}>
          {copied === "li-1" ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="body">{data.connectionRequest}</pre>

      <div className="section-label">After they accept</div>
      <div className="result-head">
        <div className="meta">Follow-up message</div>
        <button className="btn btn-ghost" onClick={() => onCopy("li-2", data.followUp)}>
          {copied === "li-2" ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="body">{data.followUp}</pre>
    </div>
  );
}

function IcebreakerView({
  lines,
  onCopy,
  copied,
}: {
  lines: string[];
  onCopy: (id: string, text: string) => void;
  copied: string | null;
}) {
  return (
    <div>
      <div className="result-head">
        <div className="meta">Alternative opening lines — swap one in if the first feels off</div>
      </div>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            padding: "10px 0",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <span style={{ fontSize: 13.5 }}>{l}</span>
          <button className="btn btn-ghost" onClick={() => onCopy(`ice-${i}`, l)}>
            {copied === `ice-${i}` ? "✓" : "Copy"}
          </button>
        </div>
      ))}
    </div>
  );
}

function Paywall({ onClose }: { onClose: null }) {
  return (
    <div className="paywall" role="dialog" aria-modal="true">
      <div className="paywall-card">
        <h3>You&apos;ve used your free generations</h3>
        <p>Three was the free taste. The full version writes unlimited sequences.</p>

        <div className="price">
          {PRICE} <span>{PRICE_NOTE}</span>
        </div>

        <ul className="features">
          <li>Unlimited sequences</li>
          <li>LinkedIn pair on every prospect</li>
          <li>Saved offer profile — fill it once</li>
          <li>One-time payment, no subscription</li>
        </ul>

        <a className="link-btn" href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer">
          Get lifetime access
        </a>
        <div className="tiny">
          Checkout not connected yet — see README, step 4 (Paddle / Polar, both $0/month).
        </div>
      </div>
    </div>
  );
}
