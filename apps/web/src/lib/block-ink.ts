import { CATEGORY_COLORS, SHAPE_COLORS } from "@ergoscan/shared";

const FALLBACK = "#5B8CFF";

export function inkForCategory(category: string, fallback = FALLBACK): string {
  const key = (category || "unknown").trim();
  return (
    (CATEGORY_COLORS as Record<string, string>)[key] ||
    SHAPE_COLORS[key] ||
    fallback
  );
}

/** Majority category in a block. Coinbase does not win if any other tx exists. */
export function majorityTxInk(
  txs: readonly { category?: string | null; color?: string | null }[],
  fallback = FALLBACK
): string {
  const rows = txs.filter((t) => (t.category || "") !== "coinbase");
  const vote = rows.length ? rows : txs;
  if (!vote.length) return fallback;
  const counts = new Map<string, number>();
  for (const t of vote) {
    const cat = (t.category || "unknown").trim() || "unknown";
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  let best = "unknown";
  let n = -1;
  for (const [cat, c] of counts) {
    if (c > n || (c === n && cat < best)) {
      best = cat;
      n = c;
    }
  }
  const sample = vote.find((t) => (t.category || "unknown") === best);
  return inkForCategory(best, sample?.color || fallback);
}

export function majorityColorInk(colors: readonly string[], fallback = FALLBACK): string {
  const counts = new Map<string, number>();
  for (const raw of colors) {
    const c = raw.trim();
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best = fallback;
  let n = -1;
  for (const [c, v] of counts) {
    if (v > n) {
      best = c;
      n = v;
    }
  }
  return best;
}
