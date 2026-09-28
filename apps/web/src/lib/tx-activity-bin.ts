import { formatDottedDate, formatDottedDay, formatH24 } from "./format";

/** Home sparks: display bins only. Snapshot stays hourly. */

export type SparkPoint = { t: number; v: number };

export type TxActivityPoint = {
  t: number;
  txs: number;
  feesErg: number;
  feesKnown?: boolean;
};

export const TX_ACTIVITY_BIN_MS = 6 * 60 * 60 * 1000;
/** Home dual-line: AdaStat-like point count. Snapshot / sparks stay 6h. */
export const HOME_TX_CHART_BIN_MS = 12 * 60 * 60 * 1000;
/** Bins are UTC walls; tooltip and axis must use the same zone. */
export const TX_ACTIVITY_TZ = "UTC";

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, n) => s + n, 0) / xs.length;
}

/** Mean value per 6h UTC wall. Snapshot points stay hourly. */
export function binLinePoints(points: SparkPoint[], binMs = TX_ACTIVITY_BIN_MS): SparkPoint[] {
  if (points.length === 0 || binMs <= 0) return [];
  const groups = new Map<number, number[]>();
  for (const p of points) {
    if (!Number.isFinite(p.t) || !Number.isFinite(p.v)) continue;
    const t = Math.floor(p.t / binMs) * binMs;
    const row = groups.get(t);
    if (row) row.push(p.v);
    else groups.set(t, [p.v]);
  }
  return [...groups.keys()]
    .sort((a, b) => a - b)
    .map((t) => ({ t, v: mean(groups.get(t)!) }));
}

function sum(xs: number[]): number {
  return xs.reduce((s, n) => s + n, 0);
}

/** Mean txs/hour (rate). Sum known fees in the wall (ERG collected). */
export function binTxActivity(
  points: TxActivityPoint[],
  binMs = TX_ACTIVITY_BIN_MS
): TxActivityPoint[] {
  if (points.length === 0 || binMs <= 0) return [];
  const groups = new Map<number, TxActivityPoint[]>();
  for (const p of points) {
    if (!Number.isFinite(p.t)) continue;
    const t = Math.floor(p.t / binMs) * binMs;
    const row = groups.get(t);
    if (row) row.push(p);
    else groups.set(t, [p]);
  }
  const keys = [...groups.keys()].sort((a, b) => a - b);
  const out: TxActivityPoint[] = [];
  for (const t of keys) {
    const hours = groups.get(t)!;
    const feeHours = hours.filter((h) => h.feesKnown !== false);
    const feesKnown = feeHours.length > 0;
    out.push({
      t,
      txs: mean(hours.map((h) => h.txs)),
      feesErg: feesKnown ? sum(feeHours.map((h) => h.feesErg)) : 0,
      feesKnown,
    });
  }
  return out;
}

/** Hide the still-open wall bin so the last stroke does not cliff. */
export function dropOpenActivityBin(
  points: TxActivityPoint[],
  binMs = TX_ACTIVITY_BIN_MS,
  now = Date.now()
): TxActivityPoint[] {
  if (points.length < 3 || binMs <= 0) return points;
  const last = points[points.length - 1]!;
  if (now < last.t + binMs) return points.slice(0, -1);
  return points;
}

export function formatActivityWindow(
  t: number,
  windowMs: number,
  _locale?: string,
  timeZone = TX_ACTIVITY_TZ
): string {
  const dayA = formatDottedDate(t, timeZone);
  if (windowMs >= 24 * 60 * 60 * 1000) {
    const last = t + windowMs - 1;
    const dayB = formatDottedDate(last, timeZone);
    return dayA === dayB ? dayA : `${dayA} – ${dayB}`;
  }
  const end = t + windowMs;
  const timeA = formatH24(t, timeZone, false);
  const timeB = formatH24(end, timeZone, false);
  if (dayA === formatDottedDate(end, timeZone)) return `${dayA}, ${timeA} – ${timeB} UTC`;
  const dayB = formatDottedDate(end, timeZone);
  return `${dayA}, ${timeA} – ${dayB}, ${timeB} UTC`;
}

/** Calendar day only — a year on every tick collides on the Home spark. */
export function formatActivityTick(t: number, _locale?: string): string {
  return formatDottedDay(t, TX_ACTIVITY_TZ);
}
