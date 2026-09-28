import assert from "node:assert/strict";
import { test } from "node:test";
import { fillVolumeGaps, volRangeById, volumeWindowTotals } from "./defi-volume";

test("7d uses 12h walls, 30d and 90d use a day", () => {
  assert.equal(volRangeById("7d").binMs, 12 * 60 * 60_000);
  assert.equal(volRangeById("30d").binMs, 24 * 60 * 60_000);
  assert.equal(volRangeById("90d").days, 90);
});

test("fillVolumeGaps paints the closed window and drops the open bin", () => {
  const bin = 24 * 60 * 60_000;
  const now = Date.UTC(2026, 8, 16, 18, 0, 0);
  const day = Math.floor(now / bin) * bin;
  const rows = [{ t: day - bin, volErg: 10, swaps: 2 }];
  const out = fillVolumeGaps(rows, 3, bin, now);
  assert.equal(out.length, 3);
  assert.ok(out.every((p) => p.t < day));
  assert.equal(out.at(-1)?.volErg, 10);
  assert.equal(out[0]?.volErg, 0);
});

test("empty rows still paint closed 12h walls for 7d", () => {
  const bin = 12 * 60 * 60_000;
  const now = Date.UTC(2026, 8, 16, 18, 0, 0);
  const out = fillVolumeGaps([], 7, bin, now);
  assert.equal(out.length, 14);
  assert.ok(out.every((p) => p.volErg === 0 && p.swaps === 0));
});

test("window totals ignore empty walls", () => {
  const tot = volumeWindowTotals([
    { t: 1, volErg: 4, swaps: 1 },
    { t: 2, volErg: 0, swaps: 0 },
    { t: 3, volErg: 6, swaps: 3 },
  ]);
  assert.equal(tot.volErg, 10);
  assert.equal(tot.swaps, 4);
});
