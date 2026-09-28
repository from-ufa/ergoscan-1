import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RENT_CHART_CUT_HOURS,
  RENT_CHART_FUTURE_DAYS,
  RENT_CHART_FUTURE_HOURS,
  RENT_SERIES_DAY_MS,
  RENT_SERIES_HOUR_MS,
  RENT_SERIES_WEEK_MS,
  binRentEvents,
  fillRentWeekGaps,
  mergeRentSeries,
  clipRentAhead,
  collectRentHourPast,
  mixRentExtent,
  parseRentSeries,
  rentChartCut,
  rentPadExtent,
  rentWindowExtent,
  rentNanoToErg,
  rentWall,
  rentYearSpan,
  rollupRentSeries,
} from "./rent-series.js";

test("parse keeps finite weeks and digit nano", () => {
  const rows = parseRentSeries([
    { t: 1_700_000_000_000, boxes: 3, rentNano: "1500000000" },
    { t: "bad", boxes: 1, rentNano: "1" },
    { t: 1_700_000_000_000 + RENT_SERIES_WEEK_MS, boxes: 2, rentNano: "nope" },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.rentNano, "1500000000");
  assert.equal(rows[1]!.rentNano, "0");
  assert.equal(rentNanoToErg("1500000000"), 1.5);
});

test("merge adds the same week; fill zeros the hole", () => {
  const a = { t: 1_700_000_000_000, boxes: 2, rentNano: "1000" };
  const b = { t: 1_700_000_000_000 + 2 * RENT_SERIES_WEEK_MS, boxes: 1, rentNano: "400" };
  const merged = mergeRentSeries([a], [{ ...a, boxes: 3, rentNano: "500" }, b]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0]!.boxes, 5);
  assert.equal(merged[0]!.rentNano, "1500");
  const filled = fillRentWeekGaps(merged);
  assert.equal(filled.length, 3);
  assert.equal(filled[1]!.boxes, 0);
  assert.equal(filled[1]!.rentNano, "0");
});

test("bin events onto UTC week walls", () => {
  const t0 = 1_689_811_200_000;
  const rows = binRentEvents([
    { t: t0 + 1, rentNano: "100" },
    { t: t0 + 1000, rentNano: "50" },
    { t: t0 + RENT_SERIES_WEEK_MS, rentNano: "7" },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.t, t0);
  assert.equal(rows[0]!.boxes, 2);
  assert.equal(rows[0]!.rentNano, "150");
  assert.equal(rows[1]!.boxes, 1);
});

test("rollup days into a UTC month and name the year span", () => {
  const a = Date.UTC(2025, 11, 20);
  const b = Date.UTC(2026, 0, 4);
  const rows = rollupRentSeries(
    [
      { t: a, boxes: 2, rentNano: "100" },
      { t: a + RENT_SERIES_WEEK_MS, boxes: 3, rentNano: "50" },
      { t: b, boxes: 1, rentNano: "10" },
    ],
    "month"
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.t, Date.UTC(2025, 11, 1));
  assert.equal(rows[0]!.boxes, 5);
  assert.equal(rows[0]!.rentNano, "150");
  assert.equal(rows[1]!.t, Date.UTC(2026, 0, 1));
  const span = rentYearSpan(rows);
  assert.deepEqual(span, { lo: 2025, hi: 2026 });
  assert.equal(rentWall(b, "month"), Date.UTC(2026, 0, 1));
});

test("rent chart cut keeps a recent window, not the whole tape", () => {
  const now = Date.UTC(2026, 8, 14);
  const tMin = Date.UTC(2023, 8, 1);
  const day = rentChartCut("day", tMin, now, now);
  assert.ok(day.start > tMin);
  assert.equal(day.end, now + RENT_CHART_FUTURE_DAYS * RENT_SERIES_DAY_MS);
  const short = rentChartCut("day", now - 3 * RENT_SERIES_DAY_MS, now, now);
  assert.equal(short.start, now - 3 * RENT_SERIES_DAY_MS);
  const hour = rentChartCut("hour", now - 7 * RENT_SERIES_DAY_MS, now, now);
  assert.equal(hour.end, now + RENT_CHART_FUTURE_HOURS * RENT_SERIES_HOUR_MS);
  assert.ok(now - hour.start <= RENT_CHART_CUT_HOURS * RENT_SERIES_HOUR_MS + RENT_SERIES_HOUR_MS);
});

test("ahead is 10 days or 24 hours and stays off the collected stroke", () => {
  const now = Date.UTC(2026, 8, 14) + 12 * 60 * 60 * 1000;
  const today = Date.UTC(2026, 8, 14);
  const raw = [
    { t: today, boxes: 3 },
    { t: today + RENT_SERIES_DAY_MS, boxes: 4 },
    { t: today + 11 * RENT_SERIES_DAY_MS, boxes: 9 },
  ];
  const ahead = clipRentAhead(raw, now);
  assert.equal(ahead.length, 2);
  assert.equal(ahead[0]!.boxes, 3);
  assert.equal(ahead[1]!.boxes, 4);
  const near = clipRentAhead(raw, now, { hours: RENT_CHART_FUTURE_HOURS });
  assert.equal(near.length, 1);
  assert.equal(near[0]!.t, today + RENT_SERIES_DAY_MS);
});

test("hour past uses hourly bins, or holds closed days until hourly exists", () => {
  const today = Date.UTC(2026, 8, 14);
  const now = today + 12 * RENT_SERIES_HOUR_MS;
  const yday = today - RENT_SERIES_DAY_MS;
  const daily = [
    { t: yday, boxes: 10, rentNano: "10" },
    { t: today, boxes: 3, rentNano: "3" },
  ];
  const held = collectRentHourPast(undefined, daily, now);
  assert.ok(held.length >= 24);
  assert.equal(held.every((p) => p.t < today), true);
  assert.equal(held[held.length - 1]!.boxes, 10);
  const hourly = [
    { t: now - 2 * RENT_SERIES_HOUR_MS, boxes: 4, rentNano: "4" },
    { t: now - RENT_SERIES_HOUR_MS, boxes: 5, rentNano: "5" },
  ];
  const real = collectRentHourPast(hourly, daily, now);
  assert.equal(real[real.length - 1]!.boxes, 5);
});

test("window extent follows the visible tape, not a far spike", () => {
  const rows = [
    { t: 1, v: 90_000 },
    { t: 10, v: 1_600 },
    { t: 11, v: 1_800 },
    { t: 12, v: 1_700 },
  ];
  const ext = rentWindowExtent(rows, 10, 12, (p) => p.v);
  assert.deepEqual(ext, { min: 1_600, max: 1_800 });
  assert.equal(rentWindowExtent(rows, 100, 200, (p) => p.v), null);
});

test("pad extent stays on the floor unless the visible band sits high", () => {
  const low = rentPadExtent({ min: 0.2, max: 10 });
  assert.equal(low.min, 0);
  assert.ok(low.max > 10);
  const high = rentPadExtent({ min: 80, max: 100 });
  assert.ok(high.min > 0);
  assert.ok(high.max > 100);
  const mixed = mixRentExtent({ min: 0, max: 10 }, { min: 10, max: 20 }, 0.5);
  assert.deepEqual(mixed, { min: 5, max: 15 });
});
