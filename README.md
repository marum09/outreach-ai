# OutreachAI

Cold email + LinkedIn sequence writer for **one industry**. Paste one prospect's
details, get a 3-email sequence, a LinkedIn pair, and three alternative openers.

Built to cost **$0/month** to run until it makes money. See `zero-budget-plan.md`
in the workspace root for the business reasoning.

---

## What it does

| Input | Output |
|---|---|
| Your offer, industry, the prospect's pain | 3-email sequence (day 1 / 4 / 8) |
| Prospect name, role, company, one personal note | LinkedIn connection request + follow-up |
| Goal + tone | 3 alternative opening lines |

The product's value is in `lib/prompt.ts`, not the UI. That file is what stops
the output reading like generic ChatGPT: under 80 words per email, prospect-first
opening line, one soft CTA, a banned-word list, and an explicit rule against
inventing statistics.

---

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

Without any AI key the app still works — it uses the built-in writer in
`lib/fallback.ts` and shows a banner saying so.

## Turn on the real AI (free, no credit card)

```bash
cp .env.example .env.local
```

Then add **one** key. Groq is recommended: ~1,000 requests/day free and it does
not train on submitted data, which matters when your customer is a business.

| Provider | Where | Free quota |
|---|---|---|
| **Groq** (primary) | https://console.groq.com/keys | ~1,000 req/day |
| Google Gemini | https://aistudio.google.com/apikey | 1,500 req/day (⚠️ Google may train on free-tier data) |
| Mistral | https://console.mistral.ai/api-keys | ~1B tokens/month |
| OpenRouter | https://openrouter.ai/keys | 50 req/day |

All four are wired in `lib/ai.ts` and tried in that order. If one is rate-limited
the next one is used; if all fail, the built-in writer answers instead of the
user getting an error.

> `MOCK_AI=1` forces the built-in writer. It is a **server-side** variable read
> at runtime. Do not prefix it with `NEXT_PUBLIC_` — Next.js inlines those into
> the client bundle at build time, which freezes demo mode into production.

---

## Tests

```bash
npm test                 # unit + integration
npm run test:unit        # text-normalisation helpers + generated copy
npm run test:integration # needs the app running: npm run start
```

The integration test boots a fake Groq-shaped server and points the real adapter
at it via `GROQ_BASE_URL`, so it exercises the actual provider code path —
prompt construction, JSON unwrapping, result normalisation, quota fallback —
without an API key.

```bash
# Terminal 1
GROQ_API_KEY=test GROQ_BASE_URL=http://127.0.0.1:4010/v1 npm run start
# Terminal 2
npm test
```

---

## Deploy free

**Vercel** (easiest):

1. Push this folder to a GitHub repo.
2. Import it at vercel.com — framework auto-detected as Next.js.
3. Add `GROQ_API_KEY` under Project → Settings → Environment Variables.
4. Deploy. You get a free `*.vercel.app` URL.

Hobby tier is $0. `next.config.mjs` already sets `images.unoptimized` so there
is no image-optimisation daemon to pay for.

---

## Before you sell it: 5 changes

1. **Pick your niche.** Change `HEADCOUNT_COPY` and `DEFAULTS` in `app/page.tsx`,
   and the `industry` default. One industry, named in the headline. "Cold emails
   for real estate agents" beats "AI email writer".
2. **Rename it.** The current name is a placeholder — check the domain and
   Chrome Web Store are free before you commit.
3. **Connect payments** (step 4 below).
4. **Set the price.** `PRICE` in `app/page.tsx`. Don't go below $19 — every
   generation costs you AI quota.
5. **Raise the free limit if you want.** `FREE_GENERATIONS` in `lib/types.ts`.
   Keep it low; unlimited free users will eat your entire daily quota.

---

## Step 4: payments (all $0/month)

Stripe does not onboard businesses in Pakistan. Use a **Merchant of Record** —
they handle global tax and pay you out.

| Provider | Fee | Monthly | Payout to Pakistan |
|---|---|---|---|
| **Paddle** | 5% + $0.50 | $0 | Payoneer / wire |
| **Polar** | 4% + $0.40 | $0 | Stripe Connect Express (needs a local-currency bank account) |
| **Fungies.io** | 5% + $0.50 | $0 | check at signup |
| **Dodo Payments** | 3% + $0.50 | $0 | check at signup |
| Lemon Squeezy | 5% + $0.50 (+1.5% intl) | $0 | wire (PayPal not available for individuals in PK) |

**Do these two today** — approval takes weeks and applications get rejected:

1. Open a **Payoneer** account (free, Pakistan supported).
2. Apply to **Paddle** and **Polar**. In the application, state plainly what the
   buyer receives immediately after paying, with screenshots. Vague applications
   are the main reason solo founders get rejected.

Then paste the checkout link into `CHECKOUT_URL` in `app/page.tsx`.

**Payout caveat:** Polar uses Stripe Connect, which wants a real bank account in
your country in local currency — Wise/Payoneer multi-currency accounts are often
rejected. Test it during signup. Paddle's Payoneer route is more direct.

---

## Distribution with $0

1. **20 personalised messages a day.** LinkedIn, Facebook groups, niche
   subreddits. Slow, free, and it works.
2. **Chrome extension.** Test it free via "Load unpacked" in your own Chrome.
   Publishing to the Web Store costs a one-time $5 developer fee — do that only
   after your first sale, not before.
   Wrap the app with `chrome.action` opening it in a tab if you want an entry
   there. The most underrated zero-budget channel.
3. **Answer questions in niche communities.** One genuinely useful post can
   outperform a month of cold DMs.
4. **SEO pages.** "cold email examples for real estate agents" and 20
   variations. Compounds over 3–6 months.
5. **Affiliates at 30–40%.** No upfront cost, commission on sale only.
6. **Skip AppSumo for now.** Marketplace deals take 70% of revenue and roughly
   40% of listed products shut down within three years. Revisit at 50+ customers,
   and use the Select plan (30%) not Marketplace.

**Validate before you build more:** send 50 messages. If fewer than 3 people say
they'd pay, change the niche — not the product.

---

## Known limits

- The free counter is `localStorage`, so clearing the browser resets it. Fine
  for a $49 lifetime product; replace with auth + a DB before charging a
  subscription.
- No auth and no saved profiles yet. Both are on the roadmap in the paywall copy.
- One request per generation; there is no queue, so a burst of users can hit the
  free-tier rate limit. The fallback writer absorbs it, but output quality drops.
  Move to a paid key once revenue justifies it.

## Layout

```
app/page.tsx            UI + free-generation counter + paywall
app/api/generate/route.ts   validation, size caps, calls the AI
lib/prompt.ts           the actual product: system prompt + JSON repair
lib/ai.ts               Groq / Gemini / Mistral / OpenRouter + fallback chain
lib/fallback.ts         deterministic $0 writer, used for demos and outages
lib/types.ts            shared types, price constants
test/unit.test.ts       text-normalisation + generated-copy regressions
test/integration.test.mjs   end-to-end against a fake Groq server
```
