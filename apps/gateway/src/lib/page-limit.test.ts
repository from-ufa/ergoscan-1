import assert from "node:assert/strict";
import { test } from "node:test";
import { pageLimit } from "./page-limit.js";

test("pageLimit keeps explicit 0 and clamps the rest", () => {
  assert.equal(pageLimit(undefined, 25), 25);
  assert.equal(pageLimit("", 25), 25);
  assert.equal(pageLimit("0", 25), 0);
  assert.equal(pageLimit(0, 25), 0);
  assert.equal(pageLimit("25", 25), 25);
  assert.equal(pageLimit("100", 25), 100);
  assert.equal(pageLimit("101", 25), 100);
  assert.equal(pageLimit("foo", 25), 25);
  assert.equal(pageLimit(-1, 25), 25);
});
