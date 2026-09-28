import { fmtAxisTime, fmtPx, visibleBars } from "./format";
import type { ChartModel, Scrub, Slot } from "./types";

export const UP = "#22d35a";
export const DOWN = "#ff4d4f";
export const EDGE = 10;
export const AXIS = 58;
export const PAD = { top: 16, bottom: 28 };

const FONT = "ui-sans-serif, system-ui, -apple-system, sans-serif";

export function plotWidth(w: number): number {
  return Math.max(40, w - EDGE - AXIS);
}

/** Pan until the full visible window is filled; no pan when history is shorter. */
export function maxOffset(slotCount: number, visible: number): number {
  return Math.max(0, slotCount - visible);
}

export function windowLeft(
  slotCount: number,
  offset: number,
  visible: number
): number {
  const off = Math.max(0, Math.min(offset, maxOffset(slotCount, visible)));
  const right = slotCount - 1 - off;
  return right - visible + 1;
}

export function slotAt(
  slots: Slot[],
  leftF: number,
  i: number
): Slot | null {
  const idx = Math.floor(leftF) + i;
  if (idx < 0 || idx >= slots.length) return null;
  return slots[idx]!;
}

/** @deprecated kept for callers; prefer windowLeft + slotAt */
export function sliceView(
  slots: Slot[],
  offset: number,
  visible: number
): { view: Slot[]; start: number; frac: number } {
  const leftF = windowLeft(slots.length, offset, visible);
  const start = Math.floor(leftF);
  const view: Slot[] = [];
  for (let i = 0; i < visible; i++) {
    const s = slotAt(slots, leftF, i);
    if (s) view.push(s);
  }
  return { view, start: Math.max(0, start), frac: leftF - start };
}

export function hitIndex(
  clientX: number,
  rectLeft: number,
  width: number,
  visible: number
): number | null {
  const x = clientX - rectLeft;
  const slot = plotWidth(width) / visible;
  const i = Math.floor((x - EDGE) / slot);
  if (i < 0 || i >= visible) return null;
  return i;
}

function roundBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const hh = Math.max(h, 1);
  const rr = Math.min(r, w / 2, hh / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, hh, rr);
  else ctx.rect(x, y, w, hh);
  ctx.fill();
}

function yDomain(slots: Array<Slot | null>): { lo: number; hi: number } {
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of slots) {
    const c = s?.candle;
    if (!c) continue;
    if (c.low < lo) lo = c.low;
    if (c.high > hi) hi = c.high;
    if (c.open < lo) lo = c.open;
    if (c.open > hi) hi = c.open;
    if (c.close < lo) lo = c.close;
    if (c.close > hi) hi = c.close;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 0, hi: 1 };
  if (hi <= lo) {
    const pad = Math.abs(hi) * 0.006 || 1e-9;
    return { lo: lo - pad, hi: hi + pad };
  }
  const span = hi - lo;
  const pad = Math.max(span * 0.12, Math.abs(hi) * 0.002);
  return { lo: lo - pad, hi: hi + pad };
}

export function paintAmmChart(opts: {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  model: ChartModel;
  offset: number;
  visible?: number;
  shiftPx?: number;
  hover?: number | null;
  alpha?: number;
}): Scrub | null {
  const { ctx, w, h, model } = opts;
  const alpha = opts.alpha ?? 1;
  if (alpha <= 0.01 || !model.slots.length) return null;

  const visible = opts.visible ?? visibleBars(w);
  const leftF = windowLeft(model.slots.length, opts.offset, visible);
  const cols: Array<Slot | null> = [];
  for (let i = 0; i < visible; i++) cols.push(slotAt(model.slots, leftF, i));

  const plotW = plotWidth(w);
  const priceH = h - PAD.top - PAD.bottom;
  const volTop = PAD.top + priceH;
  const slotW = plotW / visible;
  const bodyW = Math.max(7, Math.min(15, slotW * 0.68));
  const frac = leftF - Math.floor(leftF);
  const shiftPx = opts.shiftPx ?? frac * slotW;
  const { lo, hi } = yDomain(cols);
  const span = hi - lo || 1;
  const yAt = (p: number) => PAD.top + ((hi - p) / span) * priceH;
  const xAt = (i: number) => EDGE + (i + 0.5) * slotW - shiftPx;

  ctx.save();
  ctx.globalAlpha = alpha;

  const grid = [hi - (hi - lo) * 0.06, (hi + lo) / 2, lo + (hi - lo) * 0.06];
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (const g of grid) {
    const y = yAt(g);
    ctx.beginPath();
    ctx.moveTo(EDGE, y);
    ctx.lineTo(EDGE + plotW, y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(235,235,240,0.38)";
  ctx.font = `500 11px ${FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const g of grid) ctx.fillText(fmtPx(g, model.quote), w - 8, yAt(g));

  let last: Slot | null = null;
  for (let i = visible - 1; i >= 0; i--) {
    if (cols[i]?.candle) {
      last = cols[i]!;
      break;
    }
  }
  if (last?.candle) {
    const yLast = yAt(last.candle.close);
    ctx.strokeStyle = "rgba(235,235,240,0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(EDGE, yLast);
    ctx.lineTo(EDGE + plotW, yLast);
    ctx.stroke();
  }

  let volMax = 0;
  for (const s of cols) {
    const v = s?.candle?.volume ?? 0;
    if (v > volMax) volMax = v;
  }
  const volH = priceH * 0.16;
  if (volMax > 0) {
    for (let i = 0; i < visible; i++) {
      const c = cols[i]?.candle;
      if (!c || c.volume <= 0) continue;
      const vh = Math.max(2, (c.volume / volMax) * volH);
      const up = c.close >= c.open;
      ctx.fillStyle = up ? "rgba(34,211,90,0.28)" : "rgba(255,77,79,0.28)";
      roundBody(
        ctx,
        xAt(i) - bodyW / 2,
        volTop - vh,
        bodyW,
        vh,
        2
      );
    }
  }

  for (let i = 0; i < visible; i++) {
    const c = cols[i]?.candle;
    if (!c) continue;
    const cx = xAt(i);
    const up = c.close >= c.open;
    const color = up ? UP : DOWN;
    const yHigh = Math.max(PAD.top, Math.min(volTop, yAt(c.high)));
    const yLow = Math.max(PAD.top, Math.min(volTop, yAt(c.low)));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.15;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, yHigh);
    ctx.lineTo(cx, yLow);
    ctx.stroke();
    const yO = yAt(c.open);
    const yC = yAt(c.close);
    let top = Math.min(yO, yC);
    let bh = Math.max(6, Math.abs(yC - yO));
    if (top + bh > volTop) top = volTop - bh;
    if (top < PAD.top) top = PAD.top;
    ctx.fillStyle = color;
    roundBody(ctx, cx - bodyW / 2, top, bodyW, bh, 3);
  }

  const hover = opts.hover;
  if (hover != null && hover >= 0 && hover < visible && cols[hover]) {
    const hx = xAt(hover);
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(hx, PAD.top);
    ctx.lineTo(hx, volTop - 4);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const labeled: number[] = [];
  for (let i = 0; i < visible; i++) if (cols[i]) labeled.push(i);
  const labelAt =
    labeled.length <= 3
      ? labeled
      : [0, 0.5, 1].map((p) => labeled[Math.round(p * (labeled.length - 1))]!);
  ctx.font = `500 10px ${FONT}`;
  ctx.fillStyle = "rgba(235,235,240,0.34)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const seen = new Set<string>();
  for (const i of labelAt) {
    const s = cols[i];
    if (!s) continue;
    const text = fmtAxisTime(s.t, model.intervalMs);
    if (seen.has(text)) continue;
    seen.add(text);
    const cx = xAt(i);
    if (cx < 22 || cx > EDGE + plotW - 10) continue;
    ctx.fillText(text, cx, h - 12);
  }

  const hoverSlot =
    hover != null && hover >= 0 && hover < visible ? cols[hover] : null;
  const markSlot = hoverSlot ?? last;
  const price =
    (hoverSlot?.candle?.close ?? last?.candle?.close ?? last?.mark) ?? null;
  if (price != null && price > 0) {
    const pillUp = markSlot?.candle
      ? markSlot.candle.close >= markSlot.candle.open
      : true;
    const pill = fmtPx(price, model.quote);
    ctx.font = `700 12.5px ${FONT}`;
    const tw = ctx.measureText(pill).width;
    const pw = tw + 18;
    const ph = 24;
    const px = w - pw - 4;
    const py = Math.max(4, Math.min(yAt(price) - ph / 2, volTop - ph - 4));
    ctx.fillStyle = pillUp ? UP : DOWN;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(px, py, pw, ph, 12);
    else ctx.rect(px, py, pw, ph);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pill, px + pw / 2, py + ph / 2 + 0.5);
  }

  ctx.restore();

  if (price == null || !markSlot) return null;
  return {
    price,
    time: markSlot.t,
    volume: markSlot.candle?.volume ?? 0,
    prints: markSlot.candle?.prints ?? 0,
  };
}

export function scrubFromHit(
  model: ChartModel,
  offset: number,
  visible: number,
  localIndex: number | null
): Scrub | null {
  if (localIndex == null) return null;
  const leftF = windowLeft(model.slots.length, offset, visible);
  const s = slotAt(model.slots, leftF, localIndex);
  if (!s) return null;
  const price = s.candle?.close ?? s.mark;
  if (price == null || !(price > 0)) return null;
  return {
    price,
    time: s.t,
    volume: s.candle?.volume ?? 0,
    prints: s.candle?.prints ?? 0,
  };
}

export { visibleBars };
