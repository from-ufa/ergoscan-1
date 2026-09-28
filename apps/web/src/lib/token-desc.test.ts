import assert from "node:assert/strict";
import { test } from "node:test";
import { tokenDescLines } from "./token-desc.js";

test("tokenDescLines paints EIP-4 JSON as key: value rows", () => {
  const raw =
    '{"title":"rosen bridge wrapped BTC","originNetwork":"Bitcoin","originToken":"BTC","isNativeToken":true}';
  assert.deepEqual(tokenDescLines(raw), [
    { key: "title", value: "rosen bridge wrapped BTC" },
    { key: "originNetwork", value: "Bitcoin" },
    { key: "originToken", value: "BTC" },
    { key: "isNativeToken", value: "true" },
  ]);
});

test("tokenDescLines keeps plain text and emoji", () => {
  assert.deepEqual(tokenDescLines("  hello world  "), [{ value: "hello world" }]);
  assert.deepEqual(tokenDescLines("a cigarette 🚬"), [{ value: "a cigarette 🚬" }]);
});

test("tokenDescLines ignores a stray control byte in front of JSON", () => {
  const body =
    '{"title":"rosen bridge wrapped HOSKY","originNetwork":"Cardano","isNativeToken":false}';
  assert.deepEqual(tokenDescLines(`\u0001${body}`), [
    { key: "title", value: "rosen bridge wrapped HOSKY" },
    { key: "originNetwork", value: "Cardano" },
    { key: "isNativeToken", value: "false" },
  ]);
});

test("tokenDescLines unwraps a JSON string that is itself an object", () => {
  const inner = '{"title":"wrapped","originToken":"BTC"}';
  assert.deepEqual(tokenDescLines(JSON.stringify(inner)), [
    { key: "title", value: "wrapped" },
    { key: "originToken", value: "BTC" },
  ]);
});

test("tokenDescLines leaves broken JSON as the original blob", () => {
  const raw = '{"title":"oops"';
  assert.deepEqual(tokenDescLines(raw), [{ value: raw }]);
});
