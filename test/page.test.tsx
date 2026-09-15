/**
 * Regression test for the paywall bug found in the wild:
 * the free-generation counter was initialised to FREE_GENERATIONS (3)
 * instead of 0, so a brand-new visitor — who had generated nothing — was
 * shown the paywall overlay on the very first render.
 *
 * renderToString executes the component's first render (useEffect does not
 * run server-side), which is exactly the state a new visitor sees before
 * localStorage corrects anything.
 *
 * Run with: npm run test:unit
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { renderToString } from "react-dom/server";
import Home from "../app/page";

describe("first render for a brand-new visitor", () => {
  // React's SSR injects <!-- --> comment markers between text interpolations
  // ("3<!-- --> of <!-- -->3 ..."), so strip them before asserting on copy.
  const html = renderToString(<Home />).replace(/<!-- -->/g, "");

  it("does NOT show the paywall", () => {
    assert.ok(
      !html.includes("You&#x27;ve used your free generations") &&
        !html.includes("You've used your free generations"),
      "paywall appeared on first visit — the counter bug is back"
    );
  });

  it("shows the generate button, enabled state available", () => {
    assert.ok(html.includes("Generate sequence"));
  });

  it("shows all three free generations remaining", () => {
    assert.ok(html.includes("3 of 3 free generations left"));
  });
});
