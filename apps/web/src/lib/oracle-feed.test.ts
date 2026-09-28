import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyOracleFeed,
  emptyOracleFeed,
  ticksForChart,
  type OracleFeedPack,
  type OracleTick,
} from "./oracle-feed.js";

function pack(partial: Partial<OracleFeedPack>): OracleFeedPack {
  return { ...emptyOracleFeed("erg-usd"), ...partial };
}

test("chart points come from written ticks, not a live scan", () => {
  const now = Date.now();
  const ticks: OracleTick[] = [
    { t: now - 2 * 86_400_000, height: 1, quote: 0.21, market: 0.22 },
    { t: now - 1 * 86_400_000, height: 2, quote: 0.23, market: null },
    { t: now - 20 * 86_400_000, height: 0, quote: 0.1, market: 0.1 },
  ];
  const week = ticksForChart(ticks, "7d");
  assert.equal(week.length, 2);
  assert.equal(week[0]!.txs, 0.21);
  assert.equal(week[0]!.feesKnown, true);
  assert.equal(week[1]!.feesKnown, false);
  assert.equal(ticksForChart(ticks, "30d").length, 3);
});

test("failed client refetch keeps the SSR snap", () => {
  const prev = pack({
    ready: true,
    quote: 0.24,
    operators: [
      {
        id: "a",
        boxId: "a",
        address: null,
        height: 1,
        tsMs: null,
        quote: null,
        epoch: 1,
        live: true,
        addressErgNano: null,
        feeNano: null,
      },
    ],
  });
  assert.equal(applyOracleFeed(prev, null).quote, 0.24);
  assert.equal(applyOracleFeed(prev, emptyOracleFeed("erg-usd")).quote, 0.24);
});
