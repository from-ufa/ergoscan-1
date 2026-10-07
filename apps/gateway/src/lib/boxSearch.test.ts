import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTemplateOnlySearch } from "./boxSearch.js";

const HASH = "ab".repeat(32);

test("template hash alone is served", () => {
  assert.deepEqual(parseTemplateOnlySearch({ ergoTreeTemplateHash: HASH.toUpperCase() }), {
    ok: true,
    hash: HASH,
  });
  assert.deepEqual(
    parseTemplateOnlySearch({ ergoTreeTemplateHash: HASH, registers: {}, constants: {}, assets: [] }),
    { ok: true, hash: HASH }
  );
});

test("register, constant, and token predicates stay closed", () => {
  for (const body of [
    { ergoTreeTemplateHash: HASH, registers: { R4: "0e00" } },
    { ergoTreeTemplateHash: HASH, constants: { "0": "05" } },
    { ergoTreeTemplateHash: HASH, assets: ["cd".repeat(32)] },
  ]) {
    const got = parseTemplateOnlySearch(body);
    assert.equal(got.ok, false);
    if (!got.ok) assert.equal(got.status, 501);
  }
});

test("a missing or short hash is a bad request", () => {
  for (const body of [null, [], {}, { ergoTreeTemplateHash: "abcd" }, { ergoTreeTemplateHash: 1 }]) {
    const got = parseTemplateOnlySearch(body);
    assert.equal(got.ok, false);
    if (!got.ok) assert.equal(got.status, 400);
  }
});
