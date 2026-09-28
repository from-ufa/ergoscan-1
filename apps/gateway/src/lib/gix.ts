/**
 * Our sequential gix — not official explorer globalIndex.
 * Counters live in indexer_state; GET never MAX(gix) / COUNT(*).
 */

export const GIX_STREAM_WINDOW = 10_000;
export const GIX_STREAM_TIMEOUT_MS = 4_000;

export type GixWindow =
  | { ok: true; min: number; max: number }
  | { ok: false; error: string; reason: string };

export function gixMaxFromNext(nextRaw: string | null | undefined): number | null {
  if (nextRaw == null || nextRaw === "") return null;
  const n = Number(nextRaw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n) - 1;
}

export function parseGixWindow(minRaw: unknown, maxRaw: unknown): GixWindow {
  const minS = String(Array.isArray(minRaw) ? minRaw[0] : minRaw ?? "").trim();
  const maxS = String(Array.isArray(maxRaw) ? maxRaw[0] : maxRaw ?? "").trim();
  if (!minS || !maxS) {
    return { ok: false, error: "bad_request", reason: "minGix and maxGix required" };
  }
  const min = Number(minS);
  const max = Number(maxS);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { ok: false, error: "bad_request", reason: "minGix and maxGix must be numbers" };
  }
  const a = Math.trunc(min);
  const b = Math.trunc(max);
  if (a < 0 || b < 0 || b < a) {
    return { ok: false, error: "bad_request", reason: "bad gix range" };
  }
  if (b - a + 1 > GIX_STREAM_WINDOW) {
    return { ok: false, error: "bad_request", reason: "window too large" };
  }
  return { ok: true, min: a, max: b };
}
