import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HOME_TX_CHART_BIN_MS,
  TX_ACTIVITY_BIN_MS,
  binLinePoints,
  binTxActivity,
  dropOpenActivityBin,
  formatActivityTick,
  formatActivityWindow,
} from "./tx-activity-bin";

const H = 60 * 60 * 1000;
const t0 = Date.UTC(2026, 8, 2, 0, 0, 0);

test("empty and invalid bin size", () => {
  assert.deepEqual(binTxActivity([]), []);
  assert.deepEqual(binTxActivity([{ t: t0, txs: 10, feesErg: 1 }], 0), []);
});

test("six hours collapse to one mean", () => {
  const hours = Array.from({ length: 6 }, (_, i) => ({
    t: t0 + i * H,
    txs: 100 + i * 10,
    feesErg: 1 + i,
    feesKnown: true as const,
  }));
  const [p] = binTxActivity(hours);
  assert.equal(p?.t, t0);
  assert.equal(p?.txs, 125);
  assert.equal(p?.feesErg, 21);
  assert.equal(p?.feesKnown, true);
});

test("seventh hour opens the next 6h bin", () => {
  const hours = Array.from({ length: 7 }, (_, i) => ({
    t: t0 + i * H,
    txs: 10,
    feesErg: 1,
  }));
  const bins = binTxActivity(hours);
  assert.equal(bins.length, 2);
  assert.equal(bins[0]?.t, t0);
  assert.equal(bins[1]?.t, t0 + TX_ACTIVITY_BIN_MS);
  assert.equal(bins[0]?.txs, 10);
  assert.equal(bins[1]?.txs, 10);
});

test("unknown-fee hours are left out of the fee mean", () => {
  const hours = [
    { t: t0, txs: 10, feesErg: 4, feesKnown: true },
    { t: t0 + H, txs: 20, feesErg: 0, feesKnown: false },
    { t: t0 + 2 * H, txs: 30, feesErg: 6, feesKnown: true },
  ];
  const [p] = binTxActivity(hours);
  assert.equal(p?.txs, 20);
  assert.equal(p?.feesErg, 10);
  assert.equal(p?.feesKnown, true);
});

test("all unknown fees become a gap, not zero", () => {
  const hours = [
    { t: t0, txs: 8, feesErg: 0, feesKnown: false },
    { t: t0 + H, txs: 12, feesErg: 0, feesKnown: false },
  ];
  const [p] = binTxActivity(hours);
  assert.equal(p?.txs, 10);
  assert.equal(p?.feesErg, 0);
  assert.equal(p?.feesKnown, false);
});

test("window label is the 6h span in UTC", () => {
  const t = Date.UTC(2026, 8, 2, 6, 0, 0);
  assert.equal(
    formatActivityWindow(t, TX_ACTIVITY_BIN_MS, "en-US"),
    "02.09.2026, 06:00 – 12:00 UTC"
  );
});

test("window that crosses midnight names both days", () => {
  const t = Date.UTC(2026, 8, 2, 18, 0, 0);
  assert.equal(
    formatActivityWindow(t, TX_ACTIVITY_BIN_MS, "en-US"),
    "02.09.2026, 18:00 – 03.09.2026, 00:00 UTC"
  );
});

test("week window is dates only", () => {
  const t = Date.UTC(2026, 8, 7, 0, 0, 0);
  assert.equal(
    formatActivityWindow(t, 7 * 24 * 60 * 60 * 1000, "en-US"),
    "07.09.2026 – 13.09.2026"
  );
});

test("home chart 12h wall collapses a dozen hours", () => {
  const hours = Array.from({ length: 12 }, (_, i) => ({
    t: t0 + i * H,
    txs: 10,
    feesErg: 1,
  }));
  const bins = binTxActivity(hours, HOME_TX_CHART_BIN_MS);
  assert.equal(bins.length, 1);
  assert.equal(bins[0]?.t, t0);
  assert.equal(bins[0]?.feesErg, 12);
});

test("open last wall bin is dropped, closed bin stays", () => {
  const a = { t: t0, txs: 10, feesErg: 1 };
  const b = { t: t0 + TX_ACTIVITY_BIN_MS, txs: 20, feesErg: 2 };
  const c = { t: t0 + 2 * TX_ACTIVITY_BIN_MS, txs: 4, feesErg: 0.2 };
  const nowOpen = t0 + 2 * TX_ACTIVITY_BIN_MS + 60 * 60 * 1000;
  const nowClosed = t0 + 3 * TX_ACTIVITY_BIN_MS;
  assert.equal(dropOpenActivityBin([a, b, c], TX_ACTIVITY_BIN_MS, nowOpen).length, 2);
  assert.equal(dropOpenActivityBin([a, b, c], TX_ACTIVITY_BIN_MS, nowClosed).length, 3);
});

test("axis tick is UTC, not the machine zone", () => {
  const t = Date.UTC(2026, 8, 2, 6, 0, 0);
  assert.equal(formatActivityTick(t, "en-US"), "02.09");
});

test("line spark empty and invalid bin size", () => {
  assert.deepEqual(binLinePoints([]), []);
  assert.deepEqual(binLinePoints([{ t: t0, v: 10 }], 0), []);
});

test("line spark six hours collapse to one mean", () => {
  const hours = Array.from({ length: 6 }, (_, i) => ({
    t: t0 + i * H,
    v: 100 + i * 10,
  }));
  const [p] = binLinePoints(hours);
  assert.equal(p?.t, t0);
  assert.equal(p?.v, 125);
});

test("line spark seventh hour opens the next 6h bin", () => {
  const hours = Array.from({ length: 7 }, (_, i) => ({
    t: t0 + i * H,
    v: 10,
  }));
  const bins = binLinePoints(hours);
  assert.equal(bins.length, 2);
  assert.equal(bins[0]?.t, t0);
  assert.equal(bins[1]?.t, t0 + TX_ACTIVITY_BIN_MS);
});
