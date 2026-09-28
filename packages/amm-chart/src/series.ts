import type { Candle, ChartModel, Fill, LinePoint, Quote, Slot, Tick } from "./types";

export function toMs(t: number): number {
  if (!Number.isFinite(t) || t <= 0) return 0;
  return t > 1e12 ? t : t * 1000;
}

export function bucketStart(ms: number, intervalMs: number): number {
  return Math.floor(ms / intervalMs) * intervalMs;
}

export function quotePx(erg: number, fx: number, quote: Quote): number {
  if (quote === "erg") return erg;
  return erg * fx;
}

/** Pool-mid ticks → sorted line. USD is one FX × priceErg (ignore tick.usd). */
export function ticksToLine(ticks: Tick[], fx: number, quote: Quote): LinePoint[] {
  const f = fx > 0 && Number.isFinite(fx) ? fx : 1;
  return ticks
    .map((p) => ({ t: toMs(p.t), v: quotePx(p.erg, f, quote) }))
    .filter((p) => p.t > 0 && Number.isFinite(p.v) && p.v > 0)
    .sort((a, b) => a.t - b.t);
}

/** Evenly sample to ~30 points. */
export function downsampleLine(points: LinePoint[], max = 31): LinePoint[] {
  if (max < 2 || points.length <= max) return points;
  const last = points.length - 1;
  const out: LinePoint[] = [];
  let prev = -1;
  for (let i = 0; i < max; i++) {
    const idx = i === max - 1 ? last : Math.round((i * last) / (max - 1));
    if (idx === prev) continue;
    out.push(points[idx]!);
    prev = idx;
  }
  return out;
}

export function lineChange(points: LinePoint[]): number | null {
  if (points.length < 2) return null;
  const first = points[0]!.v;
  const last = points[points.length - 1]!.v;
  if (!(first > 0) || !Number.isFinite(last)) return null;
  return (last - first) / first;
}

function isBuy(side?: string): boolean {
  const s = (side ?? "").toLowerCase();
  return s === "buy" || s === "add" || s === "bought";
}

function isSell(side?: string): boolean {
  const s = (side ?? "").toLowerCase();
  return s === "sell" || s === "remove" || s === "sold";
}

/** Drop LP noise, nulls, and 1000× outliers vs pool mid. */
export function filterFills(
  fills: Fill[],
  markErgAt: (ms: number) => number | null,
  tokenId?: string | null
): Fill[] {
  const id = (tokenId ?? "").toLowerCase();
  const out: Fill[] = [];
  for (const f of fills) {
    if (!(f.tokenAmount > 0) || !(f.baseAmount > 0)) continue;
    if (!(f.priceErg > 0) || !Number.isFinite(f.priceErg)) continue;
    const pool = (f.poolId ?? "").toLowerCase();
    if (id && pool && pool === id) continue;
    const ms = toMs(f.t);
    if (!ms) continue;
    const mark = markErgAt(ms);
    if (mark != null && mark > 0) {
      const r = f.priceErg / mark;
      if (r < 0.4 || r > 2.5) continue;
    }
    out.push(f);
  }
  return out;
}

/** Last tick.erg at or before `ms`. Ticks must be sorted ascending. */
export function markErgLookup(ticks: Tick[]): (ms: number) => number | null {
  const rows = ticks
    .map((p) => ({ ms: toMs(p.t), erg: p.erg }))
    .filter((p) => p.ms > 0 && p.erg > 0)
    .sort((a, b) => a.ms - b.ms);
  return (ms: number) => {
    if (!rows.length) return null;
    let lo = 0;
    let hi = rows.length - 1;
    if (ms < rows[0]!.ms) return rows[0]!.erg;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const t = rows[mid]!.ms;
      if (t === ms) return rows[mid]!.erg;
      if (t < ms) lo = mid + 1;
      else hi = mid - 1;
    }
    return rows[Math.max(0, hi)]!.erg;
  };
}

export function modelKey(model: ChartModel): string {
  const slots = model.slots;
  if (!slots.length) return "0";
  return `${model.quote}:${model.intervalMs}:${slots[0]!.t}:${slots[slots.length - 1]!.t}:${slots.length}:${model.printCount}`;
}

export function lastMark(model: ChartModel): number | null {
  for (let i = model.slots.length - 1; i >= 0; i--) {
    const m = model.slots[i]!.mark;
    if (m != null && m > 0) return m;
  }
  return null;
}

export function markChange(model: ChartModel): number | null {
  let first: number | null = null;
  let last: number | null = null;
  for (const s of model.slots) {
    if (s.mark != null && s.mark > 0) {
      if (first == null) first = s.mark;
      last = s.mark;
    }
  }
  if (first == null || last == null || first <= 0) return null;
  return (last - first) / first;
}

type OhlcAcc = { o: number; h: number; l: number; c: number };
type VolAcc = { volume: number; prints: number; buyVol: number; sellVol: number };

/**
 * Continuous OHLC from pool-mid ticks (Dexscreener-style slots).
 * Empty buckets carry the last close as a doji so the pane is a real candle row.
 * Fill volume is attached to the same buckets — it does not create the bodies.
 */
export function buildChartModel(opts: {
  ticks: Tick[];
  fills: Fill[];
  intervalMs: number;
  fx: number;
  quote: Quote;
  tokenId?: string | null;
}): ChartModel {
  const intervalMs = opts.intervalMs;
  const fx = opts.fx > 0 && Number.isFinite(opts.fx) ? opts.fx : 1;
  const quote = opts.quote;
  const empty: ChartModel = {
    intervalMs,
    quote,
    fx,
    slots: [],
    printCount: 0,
  };
  if (!(intervalMs > 0)) return empty;

  const ticks = [...opts.ticks]
    .map((p) => ({
      ms: toMs(p.t),
      erg: p.erg,
      tvl: p.tvlErg != null && p.tvlErg > 0 ? p.tvlErg : null,
    }))
    .filter((p) => p.ms > 0 && Number.isFinite(p.erg) && p.erg > 0)
    .sort((a, b) => a.ms - b.ms);

  if (!ticks.length) return empty;

  const lookup = markErgLookup(opts.ticks);
  const fills = filterFills(opts.fills, lookup, opts.tokenId);

  const t0 = bucketStart(ticks[0]!.ms, intervalMs);
  const t1 = bucketStart(ticks[ticks.length - 1]!.ms, intervalMs);

  const ohlc = new Map<number, OhlcAcc>();
  const lastTvl = new Map<number, number>();
  for (const p of ticks) {
    const b = bucketStart(p.ms, intervalMs);
    const px = quotePx(p.erg, fx, quote);
    if (!(px > 0)) continue;
    const prev = ohlc.get(b);
    if (!prev) ohlc.set(b, { o: px, h: px, l: px, c: px });
    else {
      prev.h = Math.max(prev.h, px);
      prev.l = Math.min(prev.l, px);
      prev.c = px;
    }
    if (p.tvl != null) lastTvl.set(b, p.tvl);
  }

  const vols = new Map<number, VolAcc>();
  for (const f of fills) {
    const ms = toMs(f.t);
    if (ms < t0 || ms >= t1 + intervalMs) continue;
    const b = bucketStart(ms, intervalMs);
    const vol = f.baseAmount > 0 ? f.baseAmount : 0;
    const buy = isBuy(f.side);
    const sell = isSell(f.side);
    const prev = vols.get(b);
    if (!prev) {
      vols.set(b, {
        volume: vol,
        prints: 1,
        buyVol: buy ? vol : 0,
        sellVol: sell ? vol : 0,
      });
    } else {
      prev.volume += vol;
      prev.prints += 1;
      if (buy) prev.buyVol += vol;
      if (sell) prev.sellVol += vol;
    }
  }

  const slots: Slot[] = [];
  let prevClose: number | null = null;
  let carryTvl: number | null = null;
  let printCount = 0;
  for (let t = t0; t <= t1; t += intervalMs) {
    const tvl = lastTvl.get(t);
    if (tvl != null) carryTvl = tvl;
    const acc = ohlc.get(t);
    const v = vols.get(t);
    if (v) printCount += v.prints;
    let candle: Candle | null = null;
    if (acc) {
      candle = {
        open: acc.o,
        high: acc.h,
        low: acc.l,
        close: acc.c,
        volume: v?.volume ?? 0,
        prints: v?.prints ?? 0,
        buyVol: v?.buyVol ?? 0,
        sellVol: v?.sellVol ?? 0,
      };
    } else if (prevClose != null) {
      candle = {
        open: prevClose,
        high: prevClose,
        low: prevClose,
        close: prevClose,
        volume: v?.volume ?? 0,
        prints: v?.prints ?? 0,
        buyVol: v?.buyVol ?? 0,
        sellVol: v?.sellVol ?? 0,
      };
    }
    if (!candle) continue;
    prevClose = candle.close;
    slots.push({
      t,
      mark: candle.close,
      tvl: carryTvl,
      candle,
    });
  }

  return { intervalMs, quote, fx, slots, printCount };
}
