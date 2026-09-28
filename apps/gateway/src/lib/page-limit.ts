/** Page size. Explicit 0 skips that list on a sibling-tab request. */
export function pageLimit(raw: unknown, fallback: number, max = 100): number {
  if (raw === 0 || raw === "0") return 0;
  if (raw == null || raw === "") return fallback;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  if (n === 0) return 0;
  return Math.min(max, Math.max(1, Math.floor(n)));
}
