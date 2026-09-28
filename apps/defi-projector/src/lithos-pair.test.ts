import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { LIT_TOKEN_ID_MAINNET, classifyLithosBoxDelta, lithosPendingFromRegs, n2tTvlErg, pickLithosPoolAssets } from "@ergoscan/shared";
import { lithosUnspentHuntDue } from "./lithos-registry.js";

test("Lithos swap keeps the provision token still", () => {
  assert.ok(classifyLithosBoxDelta(2_000_000_000, -400, 0));
  assert.equal(classifyLithosBoxDelta(2_000_000_000, -400, 1), null);
  assert.equal(classifyLithosBoxDelta(2_000_000_000, 400, 0), null);
});

test("buy LIT is ERG into the pool", () => {
  const s = classifyLithosBoxDelta(5e9, -12_000, 0);
  assert.equal(s?.ergIn, true);
});

test("3-asset LIT box is a pool candidate", () => {
  const nft = "ab".repeat(32);
  const p = pickLithosPoolAssets([
    { tokenId: nft, amount: 1, emission: 1 },
    { tokenId: LIT_TOKEN_ID_MAINNET, amount: 88_000 },
    { tokenId: "cd".repeat(32), amount: 1e15 },
  ]);
  assert.equal(p?.nft, nft);
});

test("unspent Lithos hunt is on an interval even after the first pool", () => {
  assert.equal(lithosUnspentHuntDue(0, 10_000, 0, 60_000), true);
  assert.equal(lithosUnspentHuntDue(0, 10_000, 1, 60_000), false);
  assert.equal(lithosUnspentHuntDue(0, 70_000, 1, 60_000), true);
  assert.equal(lithosUnspentHuntDue(1, 70_000, 1, 60_000), true);
  assert.equal(lithosUnspentHuntDue(1, 10_000, 1, 60_000), false);
});

test("Lithos pending is subtracted from N2T TVL", () => {
  const pending = lithosPendingFromRegs({ R6: "[1000000000, 0]" });
  assert.ok(pending);
  const t = n2tTvlErg({
    valueNano: 11e9,
    pendingXNano: Number(pending.pendingX),
    pendingY: Number(pending.pendingY),
    quoteRaw: 10e9,
    quoteDecimals: 9,
    priceErg: 1,
  });
  assert.equal(t.ergSide, 10);
  assert.equal(t.tvlErg, 20);
});

test("unspent hunt matches token_id so box_assets_token_idx hits", () => {
  const src = readFileSync(fileURLToPath(new URL("./lithos-registry.ts", import.meta.url)), "utf8");
  assert.match(src, /ba\.token_id = \$1/);
  assert.doesNotMatch(src, /lower\(ba\.token_id\)/);
});

test("detect pairs the new pool box by creation_tx_id, not creation_height", () => {
  const src = readFileSync(fileURLToPath(new URL("./lithos-detect.ts", import.meta.url)), "utf8");
  assert.match(src, /b\.creation_tx_id = s\.tx_id/);
  assert.doesNotMatch(src, /creation_height >= \$2 - 2/);
  assert.doesNotMatch(src, /lower\(ba\.token_id\)/);
});
