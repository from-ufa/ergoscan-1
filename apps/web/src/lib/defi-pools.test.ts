import assert from "node:assert/strict";
import { test } from "node:test";
import { isErgBase, isLivePool, lithosPoolsOnly, poolsWithMinTvl, sortDefiPools, sortDefiPoolsByTvl, sortPoolBoard, spectrumListedPools, defiVenueCaption, type PoolBoardRow } from "./defi-pools";

test("sortDefiPools puts the newest live fill first", () => {
  const out = sortDefiPools([
    { poolId: "a", tokenId: "aa", symbol: "A", tvlErg: 9, lastTs: 10, vol24h: 1 },
    { poolId: "b", tokenId: "bb", symbol: "B", tvlErg: 0, lastTs: 30, vol24h: 0 },
    { poolId: "c", tokenId: "cc", symbol: "C", tvlErg: 0, lastTs: 0, vol24h: 4 },
  ]);
  assert.deepEqual(
    out.map((p) => p.symbol),
    ["B", "A", "C"]
  );
});

test("isLivePool needs a fill or 24h volume", () => {
  assert.equal(isLivePool({ lastTs: 0, vol24h: 0 }), false);
  assert.equal(isLivePool({ lastTs: 1, vol24h: 0 }), true);
  assert.equal(isLivePool({ lastTs: 0, vol24h: 2 }), true);
});

test("ERG base is the zero id or ERG ticker", () => {
  assert.equal(isErgBase(null, null), true);
  assert.equal(isErgBase("0".repeat(64), "ERG"), true);
  assert.equal(isErgBase("ab".repeat(32), "SigUSD"), false);
});

test("LithosDex venue caption is not ErgoDex", () => {
  const copy: Record<string, string> = {
    "defi.venue.lithos": "LithosDex",
    "defi.venue.spectrum": "ErgoDex",
    "defi.venue.spectrumN2n": "ErgoDex N2N",
  };
  const t = (k: string) => copy[k] ?? k;
  assert.equal(defiVenueCaption("lithos_dex", t), "LithosDex");
  assert.equal(defiVenueCaption("spectrum_cfmm", t), "ErgoDex");
  assert.equal(defiVenueCaption(null, t), "ErgoDex");
});

test("lithosPoolsOnly drops Spectrum rows", () => {
  const rows = [
    { poolId: "a", tokenId: "aa", symbol: "LIT", tvlErg: 10, venue: "lithos_dex" },
    { poolId: "b", tokenId: "bb", symbol: "SPF", tvlErg: 99, venue: "spectrum_cfmm" },
    { poolId: "c", tokenId: "cc", symbol: "X", tvlErg: 1 },
  ];
  assert.deepEqual(
    lithosPoolsOnly(rows).map((p) => p.symbol),
    ["LIT"]
  );
});

test("sortDefiPoolsByTvl puts deepest first", () => {
  const out = sortDefiPoolsByTvl([
    { poolId: "a", tokenId: "aa", symbol: "A", tvlErg: 9 },
    { poolId: "b", tokenId: "bb", symbol: "B", tvlErg: 0 },
    { poolId: "c", tokenId: "cc", symbol: "C", tvlErg: 40 },
  ]);
  assert.deepEqual(
    out.map((p) => p.symbol),
    ["C", "A", "B"]
  );
});

test("poolsWithMinTvl drops dust under the ERG floor", () => {
  const rows = [
    { poolId: "a", tokenId: "aa", symbol: "A", tvlErg: 99 },
    { poolId: "b", tokenId: "bb", symbol: "B", tvlErg: 100 },
    { poolId: "c", tokenId: "cc", symbol: "C", tvlErg: 0 },
  ];
  assert.deepEqual(
    poolsWithMinTvl(rows, 100).map((p) => p.symbol),
    ["B"]
  );
});

test("spectrumListedPools falls back to fill-gated when no TVL ≥ floor", () => {
  const cold = [
    { poolId: "a", tokenId: "aa", symbol: "A", tvlErg: 0, lastTs: 20, vol24h: 1 },
    { poolId: "b", tokenId: "bb", symbol: "B", tvlErg: 0, lastTs: 0, vol24h: 0 },
    { poolId: "c", tokenId: "cc", symbol: "C", tvlErg: 0, lastTs: 40, vol24h: 2 },
  ];
  assert.deepEqual(
    spectrumListedPools(cold, 100).map((p) => p.symbol),
    ["C", "A"]
  );
  const hot = [
    { poolId: "a", tokenId: "aa", symbol: "A", tvlErg: 40, lastTs: 99 },
    { poolId: "b", tokenId: "bb", symbol: "B", tvlErg: 120, lastTs: 1 },
  ];
  assert.deepEqual(
    spectrumListedPools(hot, 100).map((p) => p.symbol),
    ["B"]
  );
});

function board(partial: Partial<PoolBoardRow> & Pick<PoolBoardRow, "poolId" | "symbol">): PoolBoardRow {
  return {
    tokenId: partial.poolId,
    tvlErg: 0,
    volErg: null,
    priceErg: null,
    trades: null,
    firstTs: null,
    traders: null,
    ...partial,
  };
}

test("pool board defaults to TVL and keeps missing volume at the bottom", () => {
  const rows = [
    board({ poolId: "a", symbol: "A", tvlErg: 10, volErg: null, trades: 2 }),
    board({ poolId: "b", symbol: "B", tvlErg: 50, volErg: 3, trades: 1 }),
    board({ poolId: "c", symbol: "C", tvlErg: 0, volErg: 9, trades: 4 }),
  ];
  assert.deepEqual(sortPoolBoard(rows, "tvl", "desc").map((p) => p.symbol), ["B", "A", "C"]);
  assert.deepEqual(sortPoolBoard(rows, "vol", "desc").map((p) => p.symbol), ["C", "B", "A"]);
  assert.deepEqual(sortPoolBoard(rows, "trades", "asc").map((p) => p.symbol), ["B", "A", "C"]);
});
