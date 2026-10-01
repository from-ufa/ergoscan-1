import assert from "node:assert/strict";
import { test } from "node:test";
import { heightFromQuery } from "./resolve.js";

test("heights copied from the site resolve", () => {
  assert.equal(heightFromQuery("1885000"), 1885000);
  assert.equal(heightFromQuery("#1885000"), 1885000);
  assert.equal(heightFromQuery("# 1885000"), 1885000);
  assert.equal(heightFromQuery("#1\u00a0885\u00a0000"), 1885000);
  assert.equal(heightFromQuery("1,885,000"), 1885000);
  assert.equal(heightFromQuery(" 1 885 000 "), 1885000);
});

test("other strings are not heights", () => {
  assert.equal(heightFromQuery("0"), null);
  assert.equal(heightFromQuery("#"), null);
  assert.equal(heightFromQuery("SigUSD"), null);
  assert.equal(heightFromQuery("9efFUTmfpea6whc8iL8FNJN295Ddc2HDVeQpQjygqsbQS578By4"), null);
  assert.equal(heightFromQuery("12345678901"), null);
  assert.equal(heightFromQuery("1885000abc"), null);
  assert.equal(heightFromQuery("-5"), null);
  assert.equal(heightFromQuery("1.5"), null);
  assert.equal(heightFromQuery("0.5"), null);
  assert.equal(heightFromQuery("12 34"), null);
});
