import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeHolderCursor, parseHolderCursor } from "./holder-cursor.js";

test("holder cursor round-trips amount|address", () => {
  const raw = encodeHolderCursor("95468683", "9fLYPigGHXkTyyQv");
  assert.equal(raw, "95468683|9fLYPigGHXkTyyQv");
  assert.deepEqual(parseHolderCursor(raw), {
    amount: "95468683",
    address: "9fLYPigGHXkTyyQv",
  });
});

test("holder cursor rejects empty, missing amount, and junk", () => {
  assert.equal(parseHolderCursor(""), null);
  assert.equal(parseHolderCursor("no-pipe"), null);
  assert.equal(parseHolderCursor("|addr"), null);
  assert.equal(parseHolderCursor("1|"), null);
  assert.equal(parseHolderCursor("abc|addr"), null);
  assert.deepEqual(parseHolderCursor("1.50|9abc"), {
    amount: "1.50",
    address: "9abc",
  });
});
