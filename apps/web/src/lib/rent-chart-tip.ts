/** Pick the rent-chart day under the axis pointer — past or due peek. */

const DAY_MS = 86_400_000;

export type RentTipPoint = {
  t: number;
  boxes: number;
  rentErg: number;
};

export function nearestRentTipPoint<T extends { t: number }>(
  pts: readonly T[],
  t: number,
  maxDist = DAY_MS / 2
): T | undefined {
  if (!Number.isFinite(t) || maxDist < 0) return undefined;
  let best: T | undefined;
  let bestD = maxDist + 1;
  for (const p of pts) {
    if (!Number.isFinite(p.t)) continue;
    const d = Math.abs(p.t - t);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return bestD <= maxDist ? best : undefined;
}

/** Axis pointer time. Not the first series' last point (that sticks on collected). */
export function rentTipAxisMs(raw: unknown): number | null {
  const rows = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const axis = Number((row as { axisValue?: unknown }).axisValue);
    if (Number.isFinite(axis)) return axis;
  }
  return null;
}

export function pickRentChartTip(
  past: readonly RentTipPoint[],
  ahead: readonly RentTipPoint[],
  t: number
): { src: RentTipPoint; due: boolean } | null {
  const due = nearestRentTipPoint(ahead, t);
  const collected = nearestRentTipPoint(past, t);
  if (due && collected) {
    const useDue = Math.abs(due.t - t) <= Math.abs(collected.t - t);
    return useDue ? { src: due, due: true } : { src: collected, due: false };
  }
  if (due) return { src: due, due: true };
  if (collected) return { src: collected, due: false };
  return null;
}
