import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RENT_POOL_VISIBLE,
  formatRentSharePct,
  hasRentMinerRows,
  mergeRentMinerPools,
  nameRentMinerPools,
  pickRentMinerPeriod,
  rentMinerPeriodsReady,
  rentShareOf,
} from "./rent-miner-pools";

const TOTAL = "50668704265557";

const LIVE: { address: string; name: string; boxCount: number; rentNano: string; share: number }[] = [
  { address: "88a", name: "2miners", boxCount: 359401, rentNano: "18928422968864", share: 0.37357 },
  { address: "88b", name: "Hero Miners", boxCount: 298928, rentNano: "16723781234567", share: 0.3301 },
  { address: "88c", name: "Wooly Pooly", boxCount: 48052, rentNano: "2575600000000", share: 0.0508 },
  { address: "88d", name: "Nano Pool", boxCount: 40029, rentNano: "2172900000000", share: 0.0429 },
  { address: "88e", name: "88…XmraxkXv", boxCount: 34304, rentNano: "1885600000000", share: 0.0372 },
  { address: "88f", name: "Hero Miners", boxCount: 23612, rentNano: "1481200000000", share: 0.0292 },
  { address: "88g", name: "DX Pool", boxCount: 27810, rentNano: "1271000000000", share: 0.0251 },
  { address: "88h", name: "Kryptex", boxCount: 27622, rentNano: "1066900000000", share: 0.021 },
  { address: "88i", name: "2miners", boxCount: 13995, rentNano: "661100000000", share: 0.013 },
];

test("live snap lead is 2miners; Hero Miners and 2miners merge by name", () => {
  const rows = mergeRentMinerPools(LIVE, { boxes: 0, rentNano: "0" }, TOTAL);
  assert.equal(rows[0]?.name, "2miners");
  assert.equal(rows[0]?.addresses.length, 2);
  assert.equal(rows[0]?.address, "88a");
  const hero = rows.find((r) => r.name === "Hero Miners");
  assert.ok(hero);
  assert.equal(hero.addresses.length, 2);
  assert.equal(hero.address, "88b");
  assert.equal(hero.rentNano, (16723781234567n + 1481200000000n).toString());
  assert.equal(
    rows.find((r) => r.name === "2miners")?.rentNano,
    (18928422968864n + 661100000000n).toString()
  );
  assert.equal(rows.filter((r) => r.kind === "uncovered").length, 0);
});

test("uncovered is a gray last row, not a named pool", () => {
  const rows = mergeRentMinerPools(
    LIVE.slice(0, 1),
    { boxes: 12, rentNano: "1000000000" },
    TOTAL
  );
  const last = rows[rows.length - 1];
  assert.equal(last?.kind, "uncovered");
  assert.equal(last?.id, "uncovered");
  assert.equal(last?.address, null);
  assert.equal(last?.ink.startsWith("rgba"), true);
});

test("hasRentMinerRows is false when the snap is empty", () => {
  assert.equal(hasRentMinerRows(null), false);
  assert.equal(hasRentMinerRows({ pools: [], uncoveredBoxes: 0, uncoveredRentNano: "0" }), false);
  assert.equal(hasRentMinerRows({ pools: LIVE, uncoveredBoxes: 0, uncoveredRentNano: "0" }), true);
});

test("collector list viewport is five rows", () => {
  assert.equal(RENT_POOL_VISIBLE, 5);
});

test("share and pct match the writer precision", () => {
  assert.equal(rentShareOf("18928422968864", TOTAL), 0.37357);
  assert.equal(formatRentSharePct(0.37357), "37%");
  assert.equal(formatRentSharePct(0.0508), "5%");
});

const DAY = {
  coveredBoxes: 10,
  coveredRentNano: "8000000000",
  uncoveredBoxes: 0,
  uncoveredRentNano: "0",
  rentNano: "8000000000",
  pools: [
    { address: "88a", name: "2miners", boxCount: 8, rentNano: "5000000000", share: 0 },
    { address: "88b", name: "Hero Miners", boxCount: 2, rentNano: "3000000000", share: 0 },
  ],
};

test("day/month pick the window total, not all-time collected", () => {
  const all = {
    coveredBoxes: 1,
    coveredRentNano: TOTAL,
    uncoveredBoxes: 0,
    uncoveredRentNano: "0",
    pools: LIVE,
  };
  const day = pickRentMinerPeriod(
    { rentNano: TOTAL, miners: all, minersDay: DAY, minersMonth: DAY },
    "day"
  );
  assert.equal(day.period, "day");
  assert.equal(day.totalRentNano, "8000000000");
  const rows = mergeRentMinerPools(
    day.miners.pools,
    { boxes: 0, rentNano: "0" },
    day.totalRentNano
  );
  assert.equal(rows[0]?.name, "2miners");
  assert.equal(rows[0]?.share, 0.625);
  assert.equal(pickRentMinerPeriod({ rentNano: TOTAL, miners: all }, "all").totalRentNano, TOTAL);
});

test("SegBar waits until day or month is on the wire", () => {
  assert.equal(rentMinerPeriodsReady({}), false);
  assert.equal(rentMinerPeriodsReady({ minersDay: DAY }), true);
});

test("address book names a known 2miners reward script", () => {
  const named = nameRentMinerPools([
    {
      address:
        "88dhgzEuTXaRiLRSYpvTCXWoN3A86gnWs3Z8BWkJGkGMXsR3WzUUyqbB47YAzhhsB6HJdJ4tC5AFYfSc",
      name: "88…C5AFYfSc",
      boxCount: 1,
      rentNano: "1",
      share: 1,
    },
  ]);
  assert.equal(named[0]?.name, "2miners");
});
