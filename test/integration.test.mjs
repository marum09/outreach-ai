/**
 * Integration test for /api/generate.
 *
 * This does NOT re-implement any product logic. It boots a fake
 * Groq-shaped HTTP server, points the app's real Groq adapter at it via
 * GROQ_BASE_URL, and asserts on what the real request handler returns.
 *
 * Run with:  npm test
 */
import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const FAKE_PORT = 4010;

/** What the fake model will reply with on the next request. */
let nextCompletion = "";
let nextStatus = 200;
let lastRequestBody = null;

const fakeGroq = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    lastRequestBody = body ? JSON.parse(body) : null;
    res.writeHead(nextStatus, { "Content-Type": "application/json" });
    if (nextStatus !== 200) {
      res.end(JSON.stringify({ error: { message: "rate limit exceeded" } }));
      return;
    }
    res.end(
      JSON.stringify({ choices: [{ message: { content: nextCompletion } }] })
    );
  });
});

const GOOD_MODEL_OUTPUT = JSON.stringify({
  emails: [
    { subject: "400 leads", preheader: "one thing worth a look", body: "Sarah, saw the Plano office.\n\nWorth a look?\n\nAli", sendAfterDays: 0 },
    { subject: "re: 400 leads", preheader: "the result", body: "Sarah, a Dallas agent revived 11 dead leads.\n\nWant the details?\n\nAli", sendAfterDays: 3 },
    { subject: "closing the loop", preheader: "no reply needed", body: "Sarah, closing the loop.\n\nAli", sendAfterDays: 7 },
  ],
  linkedin: {
    connectionRequest: "Hi Sarah — I work with brokers on dead leads. Would be good to connect.",
    followUp: "Thanks for connecting, Sarah.",
  },
  icebreakers: ["Quick one on your 400 leads.", "Saw the Plano office."],
});

async function post(payload) {
  const res = await fetch(`${APP}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: res.status, json: await res.json() };
}

const VALID = {
  yourCompany: "Acme Leads",
  yourOffer: "We run automated follow-up systems for real estate agents.",
  yourName: "Ali Khan",
  industry: "real estate agents",
  painPoint: "They have 400 leads in their CRM and no time to follow up.",
  proofPoint: "A Dallas agent revived 11 dead leads in 30 days.",
  prospectName: "Sarah Miller",
  prospectRole: "Broker",
  prospectCompany: "Miller Realty",
  personalNote: "they just opened a second office in Plano",
  goal: "book_call",
  tone: "direct",
};

before(async () => {
  await new Promise((r) => fakeGroq.listen(FAKE_PORT, "127.0.0.1", r));

  const res = await fetch(`${APP}/`, { method: "GET" }).catch(() => null);
  if (!res) {
    throw new Error(
      `Cannot reach the app at ${APP}. Start it first:\n` +
        `  GROQ_API_KEY=test GROQ_BASE_URL=http://127.0.0.1:${FAKE_PORT}/v1 npm run start`
    );
  }

  // MOCK_AI=1 short-circuits the API before it ever reaches a provider, which
  // would make most of these tests fail with "expected Groq, got sample".
  // Fail once with the reason instead.
  const probe = await post(VALID);
  if (probe.json?.mock) {
    throw new Error(
      "The app is running with MOCK_AI=1, so it never calls a provider.\n" +
        "Restart it with a provider key and GROQ_BASE_URL pointed at this test:\n" +
        `  GROQ_API_KEY=test GROQ_BASE_URL=http://127.0.0.1:${FAKE_PORT}/v1 npm run start`
    );
  }
});

after(() => fakeGroq.close());

describe("/api/generate", () => {
  it("returns a parsed sequence when the model replies with clean JSON", async () => {
    nextStatus = 200;
    nextCompletion = GOOD_MODEL_OUTPUT;

    const { status, json } = await post(VALID);

    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.result.emails.length, 3);
    assert.match(json.result.provider, /Groq/);
    assert.equal(json.result.emails[0].subject, "400 leads");
    assert.equal(json.result.linkedin.connectionRequest.length > 10, true);
  });

  it("sends the real prompt to the provider, with the configured model", async () => {
    nextStatus = 200;
    nextCompletion = GOOD_MODEL_OUTPUT;
    await post(VALID);

    assert.ok(lastRequestBody, "fake server received no request");
    // Keep in sync with MODEL_BY_PROVIDER.groq in lib/types.ts.
    assert.equal(lastRequestBody.model, "openai/gpt-oss-120b");
    assert.equal(lastRequestBody.response_format.type, "json_object");
    assert.equal(lastRequestBody.messages.length, 2);
    // The prospect's details must actually reach the model.
    assert.match(lastRequestBody.messages[1].content, /Miller Realty/);
    assert.match(lastRequestBody.messages[1].content, /Plano/);
    // And the anti-hallucination rule must be in the system prompt.
    assert.match(lastRequestBody.messages[0].content, /Never invent statistics/);
  });

  it("unwraps JSON when the model wraps it in markdown fences", async () => {
    nextStatus = 200;
    nextCompletion = "Here you go:\n```json\n" + GOOD_MODEL_OUTPUT + "\n```\nHope that helps!";

    const { status, json } = await post(VALID);

    assert.equal(status, 200, "fenced JSON should still parse");
    assert.equal(json.result.emails.length, 3);
  });

  it("degrades to the built-in writer when the model returns garbage", async () => {
    nextStatus = 200;
    nextCompletion = "I cannot help with that request.";

    const { status, json } = await post(VALID);

    assert.equal(status, 200, "user should still get output, not an error");
    assert.match(json.result.provider, /sample/);
    assert.ok(json.result.emails.length >= 1);
  });

  it("degrades to the built-in writer when the provider is rate limited", async () => {
    nextStatus = 429;

    const { status, json } = await post(VALID);

    assert.equal(status, 200);
    assert.match(json.result.provider, /sample/);
    assert.match(json.result.provider, /429/);
  });

  it("rejects a brief that is too vague, with a 422", async () => {
    nextStatus = 200;
    nextCompletion = GOOD_MODEL_OUTPUT;

    const { status, json } = await post({ ...VALID, yourOffer: "stuff", painPoint: "things" });

    assert.equal(status, 422);
    assert.ok(json.error.length > 20);
  });

  it("rejects a body that is not JSON, with a 400", async () => {
    const res = await fetch(`${APP}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json at all",
    });
    assert.equal(res.status, 400);
  });

  it("drops email entries the model returned without a usable body", async () => {
    nextStatus = 200;
    nextCompletion = JSON.stringify({
      emails: [
        { subject: "ok", body: "Sarah, worth a look?\n\nAli", sendAfterDays: 0 },
        { subject: "empty", body: "", sendAfterDays: 3 },
        { subject: "no body at all", sendAfterDays: 7 },
      ],
      linkedin: { connectionRequest: "Hi Sarah.", followUp: "Thanks." },
      icebreakers: [],
    });

    const { status, json } = await post(VALID);

    assert.equal(status, 200);
    assert.equal(json.result.emails.length, 1, "only the entry with a real body survives");
    assert.deepEqual(json.result.icebreakers, []);
  });

  it("clips a runaway LinkedIn request to the 300 character limit", async () => {
    nextStatus = 200;
    nextCompletion = JSON.stringify({
      emails: [{ subject: "ok", body: "Sarah, worth a look?\n\nAli", sendAfterDays: 0 }],
      linkedin: { connectionRequest: "x".repeat(900), followUp: "Thanks." },
      icebreakers: [],
    });

    const { status, json } = await post(VALID);

    assert.equal(status, 200);
    assert.ok(json.result.linkedin.connectionRequest.length <= 300);
  });
});
