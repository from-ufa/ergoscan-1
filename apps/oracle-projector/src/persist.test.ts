import assert from "node:assert/strict";
import { test } from "node:test";
import { operatorSnapGc, overlayMarketQuote, shouldWriteTick, tickIdsToDrop } from "./persist.js";

test("ticks need a finite quote", () => {
  assert.equal(shouldWriteTick(0.22), true);
  assert.equal(shouldWriteTick(null), false);
  assert.equal(shouldWriteTick(0), false);
});

test("keep newest 4000, drop the tail", () => {
  const ids = Array.from({ length: 5 }, (_, i) => `b${i}`);
  assert.deepEqual(tickIdsToDrop(ids, 3), ["b3", "b4"]);
  assert.deepEqual(tickIdsToDrop(ids, 8), []);
});

test("holders and lookback keep unspent silent seats — never replace-delete", () => {
  assert.equal(operatorSnapGc("holders"), "stale-live");
  assert.equal(operatorSnapGc("lookback"), "stale-live");
});

test("gold overlay is implied XAU/ERG, USD feeds use CG", () => {
  const market = {
    ergUsd: 0.5,
    xauUsd: 2500,
    xauPerErg: 0.0002,
    circulating: 80_000_000,
    volume24h: 1,
  };
  assert.equal(overlayMarketQuote("erg-usd", market), 0.5);
  assert.equal(overlayMarketQuote("ergusd", market), 0.5);
  assert.equal(overlayMarketQuote("xau-erg", market), 0.0002);
});
