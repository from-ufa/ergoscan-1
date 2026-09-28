/**
 * Bins of miner storage-rent collections + due-soon forecast.
 * Writer fills snapshot_kv.rent_history. GET does not scan boxes.
 */

export const RENT_SERIES_HOUR_MS = 60 * 60 * 1000;
export const RENT_SERIES_DAY_MS = 24 * RENT_SERIES_HOUR_MS;
export const RENT_SERIES_WEEK_MS = 7 * RENT_SERIES_DAY_MS;
export const RENT_FORECAST_DAYS = 30;
export const RENT_DAY_WINDOW = 90;
/** Hourly collected kept on the wire — last week, not the whole tape. */
export const RENT_HOUR_WINDOW = 7 * 24;

/**
 * Visible cut on /rent — AdaStat-like point count (home txs ≈ 14 strokes).
 * Full history stays on the series; the chart pans inside this window.
 */
export const RENT_CHART_CUT_DAYS = 16;
export const RENT_CHART_CUT_HOURS = 36;
export const RENT_CHART_CUT_WEEKS = 14;
export const RENT_CHART_CUT_MONTHS = 12;
/** Due peek after now. Same inks as collected, dashed. Not stitched to collected. */
export const RENT_CHART_FUTURE_DAYS = 10;
export const RENT_CHART_FUTURE_HOURS = 24;

/** Chart chips on /rent. Week/month rollups stay for the indexer snap only. */
export type RentChartRange = "day" | "hour";
export type RentBinRange = RentChartRange | "week" | "month";

export type RentSeriesPoint = {
  t: number;
  boxes: number;
  rentNano: string;
};

function nanoDigits(raw: unknown): string {
  const s = String(raw ?? "0").trim();
  return /^\d+$/.test(s) ? s : "0";
}

function addNano(a: string, b: string): string {
  try {
    return (BigInt(nanoDigits(a)) + BigInt(nanoDigits(b))).toString();
  } catch {
    return nanoDigits(a);
  }
}

export function rentNanoToErg(nano: string): number {
  try {
    return Number(BigInt(nanoDigits(nano))) / 1e9;
  } catch {
    return 0;
  }
}

export function parseRentSeries(raw: unknown): RentSeriesPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: RentSeriesPoint[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { t?: unknown; boxes?: unknown; rentNano?: unknown };
    const t = typeof rec.t === "number" ? rec.t : Number(rec.t);
    const boxes = typeof rec.boxes === "number" ? rec.boxes : Number(rec.boxes);
    if (!Number.isFinite(t) || t <= 0) continue;
    if (!Number.isFinite(boxes) || boxes < 0) continue;
    out.push({ t: Math.trunc(t), boxes: Math.trunc(boxes), rentNano: nanoDigits(rec.rentNano) });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

export function mergeRentSeries(
  prev: readonly RentSeriesPoint[],
  delta: readonly RentSeriesPoint[]
): RentSeriesPoint[] {
  const map = new Map<number, RentSeriesPoint>();
  for (const p of prev) map.set(p.t, { ...p });
  for (const d of delta) {
    const cur = map.get(d.t);
    if (!cur) map.set(d.t, { ...d });
    else {
      map.set(d.t, {
        t: d.t,
        boxes: cur.boxes + d.boxes,
        rentNano: addNano(cur.rentNano, d.rentNano),
      });
    }
  }
  return [...map.values()].sort((a, b) => a.t - b.t);
}

export function rentMonthWall(t: number): number {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

export function rentWall(t: number, range: RentBinRange): number {
  if (range === "month") return rentMonthWall(t);
  const ms =
    range === "hour"
      ? RENT_SERIES_HOUR_MS
      : range === "day"
        ? RENT_SERIES_DAY_MS
        : RENT_SERIES_WEEK_MS;
  return Math.floor(t / ms) * ms;
}

export function rentStepMs(range: RentBinRange, t: number): number {
  if (range !== "month") {
    if (range === "hour") return RENT_SERIES_HOUR_MS;
    return range === "day" ? RENT_SERIES_DAY_MS : RENT_SERIES_WEEK_MS;
  }
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

export function rollupRentSeries(
  points: readonly RentSeriesPoint[],
  range: RentBinRange
): RentSeriesPoint[] {
  if (range === "day" || range === "hour") {
    return mergeRentSeries(
      [],
      points.map((p) => ({ ...p, t: rentWall(p.t, range) }))
    );
  }
  const map = new Map<number, RentSeriesPoint>();
  for (const p of points) {
    const t = rentWall(p.t, range);
    const cur = map.get(t);
    if (!cur) map.set(t, { t, boxes: p.boxes, rentNano: p.rentNano });
    else {
      map.set(t, {
        t,
        boxes: cur.boxes + p.boxes,
        rentNano: addNano(cur.rentNano, p.rentNano),
      });
    }
  }
  return [...map.values()].sort((a, b) => a.t - b.t);
}

/** Zero-fill missing UTC weeks so a quiet stretch is a flat, not a slope. */
export function fillRentWeekGaps(
  points: readonly RentSeriesPoint[],
  weekMs = RENT_SERIES_WEEK_MS
): RentSeriesPoint[] {
  return fillRentRangeGaps(points, "week", weekMs);
}

export function fillRentRangeGaps(
  points: readonly RentSeriesPoint[],
  range: RentBinRange,
  weekMs = RENT_SERIES_WEEK_MS
): RentSeriesPoint[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const first = rentWall(sorted[0]!.t, range);
  const last = rentWall(sorted[sorted.length - 1]!.t, range);
  const byT = new Map(sorted.map((p) => [rentWall(p.t, range), p]));
  const out: RentSeriesPoint[] = [];
  for (let t = first; t <= last; ) {
    const hit = byT.get(t);
    out.push(hit ?? { t, boxes: 0, rentNano: "0" });
    t += range === "week" && weekMs !== RENT_SERIES_WEEK_MS ? weekMs : rentStepMs(range, t);
  }
  return out;
}

export function sliceRentSeries(
  points: readonly RentSeriesPoint[],
  from: number,
  to: number
): RentSeriesPoint[] {
  return points.filter((p) => p.t >= from && p.t <= to);
}

export function binRentEvents(
  events: ReadonlyArray<{ t: number; rentNano: string }>,
  weekMs = RENT_SERIES_WEEK_MS
): RentSeriesPoint[] {
  if (weekMs <= 0) return [];
  const map = new Map<number, RentSeriesPoint>();
  for (const ev of events) {
    if (!Number.isFinite(ev.t) || ev.t <= 0) continue;
    const t = Math.floor(ev.t / weekMs) * weekMs;
    const cur = map.get(t);
    if (!cur) map.set(t, { t, boxes: 1, rentNano: nanoDigits(ev.rentNano) });
    else {
      map.set(t, {
        t,
        boxes: cur.boxes + 1,
        rentNano: addNano(cur.rentNano, ev.rentNano),
      });
    }
  }
  return [...map.values()].sort((a, b) => a.t - b.t);
}

export function rentChartCutMs(range: RentBinRange): number {
  if (range === "hour") return RENT_CHART_CUT_HOURS * RENT_SERIES_HOUR_MS;
  if (range === "day") return RENT_CHART_CUT_DAYS * RENT_SERIES_DAY_MS;
  if (range === "week") return RENT_CHART_CUT_WEEKS * RENT_SERIES_WEEK_MS;
  return RENT_CHART_CUT_MONTHS * 30 * RENT_SERIES_DAY_MS;
}

export function rentChartFutureMs(range: RentChartRange): number {
  return range === "hour"
    ? RENT_CHART_FUTURE_HOURS * RENT_SERIES_HOUR_MS
    : RENT_CHART_FUTURE_DAYS * RENT_SERIES_DAY_MS;
}

/** Latest visible [start, end]. Day ends now+10d; hour ends now+24h. */
export function rentChartCut(
  range: RentChartRange,
  tMin: number,
  tMax: number,
  now: number
): { start: number; end: number } {
  const clock = Number.isFinite(now) ? now : tMax;
  const future = clock + rentChartFutureMs(range);
  if (!Number.isFinite(tMin) || !Number.isFinite(clock)) {
    return { start: tMin, end: future };
  }
  const cut = rentChartCutMs(range);
  const start = Number.isFinite(tMin) ? Math.max(tMin, clock - cut) : clock - cut;
  return { start, end: future };
}

export function clipRentAhead<T extends { t: number }>(
  points: readonly T[],
  now: number,
  span: { days?: number; hours?: number } | number = RENT_CHART_FUTURE_DAYS
): T[] {
  if (!Number.isFinite(now)) return [];
  const hours = typeof span === "number" ? undefined : span.hours;
  const days = typeof span === "number" ? span : span.days;
  if (hours != null) {
    if (hours <= 0) return [];
    const lo = Math.floor(now / RENT_SERIES_HOUR_MS) * RENT_SERIES_HOUR_MS;
    const hi = now + hours * RENT_SERIES_HOUR_MS;
    return points.filter((p) => Number.isFinite(p.t) && p.t >= lo && p.t <= hi);
  }
  const n = days ?? RENT_CHART_FUTURE_DAYS;
  if (n <= 0) return [];
  const lo = Math.floor(now / RENT_SERIES_DAY_MS) * RENT_SERIES_DAY_MS;
  const hi = now + n * RENT_SERIES_DAY_MS;
  return points.filter((p) => Number.isFinite(p.t) && p.t >= lo && p.t <= hi);
}

export function keepRecentRentHours(
  points: readonly RentSeriesPoint[],
  now = Date.now(),
  hours = RENT_HOUR_WINDOW
): RentSeriesPoint[] {
  if (!Number.isFinite(now) || hours <= 0) return [];
  const lo = now - hours * RENT_SERIES_HOUR_MS;
  return points.filter((p) => p.t >= lo);
}

/** Min/max of `value` for points inside the visible [start, end] window. */
export function rentWindowExtent<T extends { t: number }>(
  points: readonly T[],
  start: number,
  end: number,
  value: (p: T) => number
): { min: number; max: number } | null {
  if (!points.length || !Number.isFinite(start) || !Number.isFinite(end)) return null;
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.t) || p.t < lo || p.t > hi) continue;
    const v = value(p);
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

/**
 * Y frame for the visible rent window.
 * Quiet stretch (touches the floor) stays pinned at 0.
 * A high band lifts off 0 so a far-zero does not flatten the stroke.
 */
export function rentPadExtent(
  extent: { min: number; max: number } | null
): { min: number; max: number } {
  if (!extent || !Number.isFinite(extent.min) || !Number.isFinite(extent.max)) {
    return { min: 0, max: 1 };
  }
  let lo = Math.min(extent.min, extent.max);
  let hi = Math.max(extent.min, extent.max);
  if (lo < 0) lo = 0;
  if (hi < 0) hi = 0;
  const span = hi - lo;
  if (span <= 0) {
    const pad = Math.max(Math.abs(hi) * 0.2, 0.05);
    return { min: 0, max: hi + pad };
  }
  const pad = span * 0.22;
  if (lo <= hi * 0.12) return { min: 0, max: hi + pad };
  return { min: Math.max(0, lo - pad), max: hi + pad };
}

export function mixRentExtent(
  from: { min: number; max: number },
  to: { min: number; max: number },
  t: number
): { min: number; max: number } {
  const k = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 1;
  return {
    min: from.min + (to.min - from.min) * k,
    max: from.max + (to.max - from.max) * k,
  };
}

/**
 * Hour tape for the chart. Prefer real hourly bins.
 * If the snap has none yet, hold each closed UTC day across its 24 hours
 * so Hours is not empty against a daily-only payload.
 */
export function collectRentHourPast(
  hourly: readonly RentSeriesPoint[] | undefined,
  daily: readonly RentSeriesPoint[],
  now: number
): RentSeriesPoint[] {
  if (!Number.isFinite(now)) return [];
  const lo = rentWall(now - RENT_HOUR_WINDOW * RENT_SERIES_HOUR_MS, "hour");
  const hi = rentWall(now, "hour");
  if (hourly && hourly.length >= 2) {
    return fillRentRangeGaps(rollupRentSeries(hourly, "hour"), "hour").filter(
      (p) => p.t >= lo && p.t <= hi
    );
  }
  const byDay = new Map(rollupRentSeries(daily, "day").map((p) => [p.t, p]));
  const today = rentWall(now, "day");
  const out: RentSeriesPoint[] = [];
  for (let t = lo; t <= hi; t += RENT_SERIES_HOUR_MS) {
    if (t >= today) break;
    const src = byDay.get(rentWall(t, "day"));
    out.push(src ? { t, boxes: src.boxes, rentNano: src.rentNano } : { t, boxes: 0, rentNano: "0" });
  }
  return out;
}

export function rentYearSpan(points: readonly { t: number }[]): { lo: number; hi: number } | null {
  if (!points.length) return null;
  const lo = new Date(points[0]!.t).getUTCFullYear();
  const hi = new Date(points[points.length - 1]!.t).getUTCFullYear();
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return { lo, hi };
}
