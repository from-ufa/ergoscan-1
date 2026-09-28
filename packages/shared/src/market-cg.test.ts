import assert from "node:assert/strict";
import { test } from "node:test";
import {
  impliedXauPerErg,
  mergeMarketSnap,
  parseCgMarkets,
  parseMarketSnap,
  pickErgUsd,
} from "./market-cg.js";

test("implied oz gold per ERG from two USD spots", () => {
  assert.equal(impliedXauPerErg(0.5, 2500), 0.0002);
  assert.equal(impliedXauPerErg(null, 2500), null);
  assert.equal(impliedXauPerErg(0.5, 0), null);
});

test("CG markets rows picked by id, not order", () => {
  const parsed = parseCgMarkets([
    { id: "pax-gold", current_price: 3800 },
    {
      id: "ergo",
      current_price: 0.62,
      market_cap_rank: 400,
      total_volume: 12_000_000,
      price_change_percentage_24h: -1.5,
    },
  ]);
  assert.equal(parsed.ergUsd, 0.62);
  assert.equal(parsed.xauUsd, 3800);
  assert.equal(parsed.rank, 400);
  assert.equal(parsed.volume24h, 12_000_000);
  assert.equal(parsed.change24h, -1.5);
});

test("market snap keeps last oracle fields when CG patch is partial", () => {
  const prev = parseMarketSnap({
    ergUsd: 0.5,
    oracleErgUsd: 0.48,
    oracleErgUsdBoxId: "aa".repeat(32),
    oracleErgUsdHeight: 10,
  });
  const merged = mergeMarketSnap(prev, { ergUsd: 0.55, xauUsd: 2750 });
  assert.equal(merged.ergUsd, 0.55);
  assert.equal(merged.oracleErgUsd, 0.48);
  assert.ok(merged.xauPerErg != null && merged.xauPerErg > 0);
});

test("pages pick writer price, then tick, env wins only in band", () => {
  assert.equal(pickErgUsd({ env: 0.7, market: 0.5, tick: 0.4 }), 0.7);
  assert.equal(pickErgUsd({ market: 0.51, tick: 0.4 }), 0.51);
  assert.equal(pickErgUsd({ tick: 0.44 }), 0.44);
  assert.equal(pickErgUsd({ env: 99, market: null, tick: null }), 0);
});
