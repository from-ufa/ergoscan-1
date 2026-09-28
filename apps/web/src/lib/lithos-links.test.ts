import assert from "node:assert/strict";
import { test } from "node:test";
import { LITHOS_LINKS } from "./lithos-links";

test("Lithos protocol links are the Ergo org, not Plasma LithosDex", () => {
  const hrefs = LITHOS_LINKS.map((l) => l.href);
  assert.ok(hrefs.includes("https://github.com/Lithos-Protocol"));
  assert.ok(hrefs.includes("https://github.com/Lithos-Protocol/LitePaper"));
  assert.ok(hrefs.includes("https://t.me/LITHOS_Protocol"));
  assert.ok(hrefs.includes("https://x.com/LithosProtocol"));
  assert.ok(hrefs.includes("https://lithos.work"));
  assert.equal(
    hrefs.some((h) => /lithos\.to|LithosDex/i.test(h)),
    false
  );
});
