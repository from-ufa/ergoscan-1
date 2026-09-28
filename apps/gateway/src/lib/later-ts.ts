/** Same epoch fold as web `laterEpochMs`. Seconds vs ms. */
export function laterTs(
  ...vals: Array<number | null | undefined>
): number | null {
  let max: number | null = null;
  for (const v of vals) {
    if (v == null || !Number.isFinite(v) || v <= 0) continue;
    const ms = v > 1e12 ? v : v > 1e10 ? v : v * 1000;
    if (max == null || ms > max) max = ms;
  }
  return max;
}
