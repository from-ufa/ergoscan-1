import type { Quote } from "./types";

export function fmtPx(n: number, quote: Quote): string {
  if (!Number.isFinite(n)) return "—";
  if (quote === "erg") {
    const digits = Math.abs(n) >= 1 ? 4 : 6;
    return `${n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: digits,
    })} Σ`;
  }
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  })}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Axis label: `21.01` or `21.01, 16:00` or `16:05`. Always 24-hour. */
export function fmtAxisTime(ms: number, intervalMs: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  const day = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
  if (intervalMs >= 20 * 3600_000) return day;
  if (intervalMs >= 3 * 3600_000) return `${day}, ${pad2(d.getHours())}:00`;
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Orbit-like density: fat rounded candles, ~24 on a phone. */
export function visibleBars(width: number): number {
  const plot = Math.max(160, width - 80);
  return Math.max(20, Math.min(32, Math.round(plot / 13)));
}

export function axisLabelIndexes(n: number): number[] {
  if (n <= 0) return [];
  if (n <= 3) return [...Array(n).keys()];
  const raw = [0.08, 0.5, 0.92].map((p) => Math.round(p * (n - 1)));
  const uniq: number[] = [];
  for (const i of raw) {
    if (!uniq.includes(i)) uniq.push(i);
  }
  return uniq;
}
