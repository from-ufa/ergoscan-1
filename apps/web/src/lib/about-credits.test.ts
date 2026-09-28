import assert from "node:assert/strict";
import { test } from "node:test";
import { ABOUT_DEV, ABOUT_KUSHTI, ABOUT_SUPPORT } from "./about-credits";

test("development lists Grok AI first, then Tim @sigmanaut", () => {
  assert.equal(ABOUT_DEV[0]?.nameKey, "about.dev.grok");
  assert.equal(ABOUT_DEV[1]?.nameKey, "about.dev.tim");
  assert.equal(ABOUT_DEV[1]?.handle, "sigmanaut");
  assert.equal(ABOUT_DEV[1]?.href, "https://t.me/sigmanaut");
});

test("inspiration thanks Richi @RichiTP", () => {
  assert.equal(ABOUT_SUPPORT[0]?.nameKey, "about.support.richi");
  assert.equal(ABOUT_SUPPORT[0]?.handle, "RichiTP");
  assert.equal(ABOUT_SUPPORT[0]?.href, "https://t.me/RichiTP");
});

test("kushti thanks is a separate Telegram handle, not a credit column", () => {
  assert.equal(ABOUT_KUSHTI.handle, "kushti_ru");
  assert.equal(ABOUT_KUSHTI.href, "https://t.me/kushti_ru");
});
