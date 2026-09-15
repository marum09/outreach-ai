/**
 * Unit tests for the text-normalisation helpers in lib/fallback.ts.
 *
 * These exist because both helpers shipped with real bugs that only showed up
 * in generated copy:
 *   - deCap sliced by firstWord.length instead of 1, turning "They just opened
 *     a second office" into "t just opened a second office".
 *   - naive `${noun}s` pluralisation produced "real estate agentss".
 *
 * Run with:  npm test
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { deCap, pluralize, generateFallback } from "../lib/fallback";
import type { GenerateInput } from "../lib/types";

describe("deCap", () => {
  it("lowercases a leading pronoun without truncating the word", () => {
    // This is the exact regression: it used to return "t just opened a second office".
    assert.equal(deCap("They just opened a second office in Plano"), "they just opened a second office in Plano");
    assert.equal(deCap("They have 400 leads in their CRM"), "they have 400 leads in their CRM");
  });

  it("keeps proper nouns capitalised", () => {
    assert.equal(deCap("Miller Realty"), "Miller Realty");
    assert.equal(deCap("Acme Leads Inc"), "Acme Leads Inc");
  });

  it("keeps a leading acronym capitalised", () => {
    assert.equal(deCap("CRM hygiene"), "CRM hygiene");
    assert.equal(deCap("SEO rankings dropping"), "SEO rankings dropping");
  });

  it("does not treat a single letter as an acronym", () => {
    assert.equal(deCap("I help agents follow up"), "i help agents follow up");
  });

  it("leaves already-lowercase text alone", () => {
    assert.equal(deCap("they just opened an office"), "they just opened an office");
  });

  it("handles empty and whitespace input", () => {
    assert.equal(deCap(""), "");
    assert.equal(deCap("   "), "   ");
  });
});

describe("pluralize", () => {
  it("adds -s to a regular noun", () => {
    assert.equal(pluralize("real estate agent"), "real estate agents");
    assert.equal(pluralize("broker"), "brokers");
    assert.equal(pluralize("dentist"), "dentists");
  });

  it("does not double the s on an already-plural noun", () => {
    // The regression: "real estate agents" used to become "real estate agentss".
    assert.equal(pluralize("real estate agents"), "real estate agents");
    assert.equal(pluralize("brokers"), "brokers");
  });

  it("handles -y endings", () => {
    assert.equal(pluralize("agency"), "agencies");
    assert.equal(pluralize("photography studio"), "photography studios");
  });

  it("leaves sibilant endings alone rather than producing 'bosses' style guesses", () => {
    assert.equal(pluralize("boss"), "boss");
    assert.equal(pluralize("church"), "church");
  });

  it("handles empty input", () => {
    assert.equal(pluralize(""), "");
  });
});

const BRIEF: GenerateInput = {
  yourCompany: "Acme Leads",
  yourOffer: "We run automated follow-up systems for real estate agents.",
  yourName: "Ali Khan",
  industry: "real estate agents",
  industrySingular: "real estate agent",
  painPoint: "They have 400 leads in their CRM and no time to follow up, so deals die quietly.",
  proofPoint: "A Dallas agent revived 11 dead leads in 30 days.",
  prospectName: "Sarah Miller",
  prospectRole: "Broker / Owner",
  prospectCompany: "Miller Realty",
  personalNote: "they just opened a second office in Plano",
  goal: "book_call",
  tone: "direct",
};

describe("generateFallback copy", () => {
  const out = generateFallback(BRIEF);

  it("keeps the topic phrase to the first idea, not the whole run-on pain", () => {
    // Regression: this used to read "If the 400 leads in your CRM and no time
    // to follow up isn't a priority..." — ungrammatical and far too long.
    assert.match(out.emails[2].body, /If the 400 leads in your CRM isn't a priority at Miller Realty/);
    assert.doesNotMatch(out.emails[2].body, /and no time to follow up isn't/);
  });

  it("reads a pasted sentence correctly after 'saw'", () => {
    // Regression: "saw they just opened..." (missing "that") and, worse,
    // "saw t just opened..." from the deCap truncation bug.
    assert.match(out.emails[0].body, /^Sarah, saw that they just opened a second office in Plano\./);
    assert.doesNotMatch(out.emails[0].body, /saw t /);
  });

  it("pluralises a slash-separated role using only its first segment", () => {
    // Regression: "I work with Broker / Owners on ...".
    assert.match(out.linkedin.connectionRequest, /I work with brokers on /);
    assert.doesNotMatch(out.linkedin.connectionRequest, /Broker \/ Owners/);
  });

  it("does not double up sentence punctuation", () => {
    const all = [...out.emails.map((e) => e.body), out.linkedin.followUp].join("\n");
    assert.doesNotMatch(all, /\.\./);
    assert.doesNotMatch(all, /\?\?/);
  });

  it("keeps every LinkedIn connection request inside the 300 character limit", () => {
    assert.ok(out.linkedin.connectionRequest.length <= 300);
  });

  it("keeps each email body under the 80 word budget", () => {
    for (const e of out.emails) {
      assert.ok(e.body.trim().split(/\s+/).length <= 80, `email too long: ${e.subject}`);
    }
  });

  it("returns three emails on a 0 / 3 / 7 day cadence", () => {
    assert.deepEqual(
      out.emails.map((e) => e.sendAfterDays),
      [0, 3, 7]
    );
  });

  it("copes with a nearly empty brief instead of throwing", () => {
    const sparse = generateFallback({ ...BRIEF, painPoint: "", personalNote: "", proofPoint: "", industrySingular: "" });
    assert.equal(sparse.emails.length, 3);
    assert.ok(sparse.emails[0].body.length > 20);
    assert.ok(sparse.linkedin.connectionRequest.length <= 300);
  });
});
