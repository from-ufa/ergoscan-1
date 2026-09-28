export const VOL_RANGES = [
  { id: "7d", days: 7, binMs: 12 * 60 * 60_000 },
  { id: "30d", days: 30, binMs: 24 * 60 * 60_000 },
  { id: "90d", days: 90, binMs: 24 * 60 * 60_000 },
] as const;

export type VolRangeId = (typeof VOL_RANGES)[number]["id"];

export type DefiVolPoint = {
  t: number;
  volErg: number;
  swaps: number;
};

export function volRangeById(id: string): (typeof VOL_RANGES)[number] {
  return VOL_RANGES.find((r) => r.id === id) ?? VOL_RANGES[0]!;
}

/** Closed UTC walls only — the open bin stays off so the last stroke does not cliff. */
export function fillVolumeGaps(
  rows: DefiVolPoint[],
  days: number,
  binMs: number,
  now = Date.now()
): DefiVolPoint[] {
  if (!(days > 0) || !(binMs > 0)) return [];
  const lastClosed = Math.floor(now / binMs) * binMs;
  const first = lastClosed - days * 24 * 60 * 60_000;
  const map = new Map<number, DefiVolPoint>();
  for (const p of rows) {
    if (!Number.isFinite(p.t)) continue;
    const t = Math.floor(p.t / binMs) * binMs;
    if (t < first || t >= lastClosed) continue;
    const prev = map.get(t);
    if (!prev) map.set(t, { t, volErg: p.volErg, swaps: p.swaps });
    else {
      prev.volErg += p.volErg;
      prev.swaps += p.swaps;
    }
  }
  const out: DefiVolPoint[] = [];
  for (let t = first; t < lastClosed; t += binMs) {
    out.push(map.get(t) ?? { t, volErg: 0, swaps: 0 });
  }
  return out;
}

export function volumeWindowTotals(rows: DefiVolPoint[]): { volErg: number; swaps: number } {
  let volErg = 0;
  let swaps = 0;
  for (const p of rows) {
    if (p.volErg > 0) volErg += p.volErg;
    if (p.swaps > 0) swaps += p.swaps;
  }
  return { volErg, swaps };
}
