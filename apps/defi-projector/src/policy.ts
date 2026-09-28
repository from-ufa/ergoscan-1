/**
 * DeFi projector: tip-follow by default. History walk is opt-in
 * (DEFI_HISTORY=1) so we never clamp a low cursor back to tip-2000.
 */

export const DEFI_FROM_HEIGHT_DEFAULT = 452_000;
export const HISTORY_NEAR_TIP = 500;
/** Floor after detect timeout. 1 height so a dense window can still move. */
export const BATCH_MIN = 1;

export function historyFromEnv(raw: string | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "1" || v === "true";
}

export function fromHeightFromEnv(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFI_FROM_HEIGHT_DEFAULT;
}

/** Milestone-1 safety: a stale/low cursor must not skip months. Off in history. */
export function clampCursorIfNeeded(
  cursor: number,
  tip: number,
  rewindBlocks: number,
  history: boolean
): { cursor: number; clamped: boolean } {
  if (history) return { cursor, clamped: false };
  if (!(tip - cursor > 50_000)) return { cursor, clamped: false };
  const rewindTo = Math.max(cursor, tip - Math.max(0, rewindBlocks));
  return { cursor: rewindTo, clamped: rewindTo !== cursor };
}

export const N2T_CURSOR_KEY = "scan_height";
export const T2T_CURSOR_KEY = "scan_height_t2t";
export const AGEUSD_CURSOR_KEY = "scan_height_ageusd";
export const LITHOS_CURSOR_KEY = "scan_height_lithos";

/** First pool birth, or null if the registry has no height yet. */
export function lithosBornHeight(
  reg: ReadonlyArray<{ existedFrom: number | null }>
): number | null {
  let min: number | null = null;
  for (const r of reg) {
    const n = r.existedFrom;
    if (n != null && Number.isFinite(n) && n > 0 && (min == null || n < min)) {
      min = n;
    }
  }
  return min;
}

/**
 * Tip mode starts at birth when the pool is inside the rewind window.
 * History walks from birth (or DEFI_FROM_HEIGHT). Stored cursor wins.
 */
export function initLithosCursor(
  stored: number,
  tip: number,
  rewindBlocks: number,
  history: boolean,
  born: number | null,
  fromHeight: number
): number {
  const floor = born != null && born > 0 ? born : fromHeight;
  const cursor = initCursor(stored, tip, rewindBlocks, history, floor);
  if (stored > 0) return cursor;
  if (history) return cursor;
  if (born != null && born > 0 && born > cursor) return Math.max(0, born - 1);
  return cursor;
}

export function ageusdUnifiedFromEnv(raw: string | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "1" || v === "true";
}

/**
 * One tip walker from the slower live cursor. 0 / missing is ignored.
 * Never picks a higher height than the live set — no jump, no clamp.
 */
export function mergeTipCursors(...xs: number[]): number {
  const live = xs
    .filter((x) => Number.isFinite(x) && x > 0)
    .map((x) => Math.floor(x));
  if (!live.length) return 0;
  return Math.min(...live);
}

/** PG cursor keys never move backward. In-memory walk may sit behind a key. */
export function persistCursorValue(previous: number, next: number): number {
  const prev = Number.isFinite(previous) && previous > 0 ? Math.floor(previous) : 0;
  const nxt = Number.isFinite(next) && next > 0 ? Math.floor(next) : 0;
  if (!prev) return nxt;
  if (!nxt) return prev;
  return Math.max(prev, nxt);
}

export function initCursor(
  stored: number,
  tip: number,
  rewindBlocks: number,
  history: boolean,
  fromHeight: number
): number {
  if (history) {
    const floor = Math.max(0, fromHeight - 1);
    if (!Number.isFinite(stored) || stored <= 0) return floor;
    return stored < floor ? floor : stored;
  }
  if (!Number.isFinite(stored) || stored <= 0) {
    return Math.max(0, tip - Math.max(0, rewindBlocks));
  }
  return stored;
}

export function liveIndexerLag(
  tip: number,
  lastHeight: number | null
): number | null {
  if (lastHeight == null || !Number.isFinite(lastHeight)) return null;
  return Math.max(0, tip - lastHeight);
}

export function indexerTooFarBehind(
  indexerLag: number | null,
  pauseAt: number
): boolean {
  if (indexerLag == null || !Number.isFinite(indexerLag)) return false;
  return indexerLag > pauseAt;
}

export type DefiMode = "tip_hold" | "history" | "tip";

export function planDefiTick(opts: {
  cursor: number;
  safeTip: number;
  batch: number;
  trail: number;
  floor: number;
  indexerLag: number | null;
  pauseAt: number;
}): {
  mode: DefiMode;
  from: number;
  to: number;
  nextCursor: number;
} | { mode: DefiMode; from: null; to: null; nextCursor: number } {
  const floor = Math.max(0, opts.floor);
  let cursor = opts.cursor;
  if (cursor < floor - 1) cursor = Math.max(0, floor - 1);

  if (indexerTooFarBehind(opts.indexerLag, opts.pauseAt)) {
    return { mode: "tip_hold", from: null, to: null, nextCursor: cursor };
  }
  if (cursor >= opts.safeTip) {
    return { mode: "tip", from: null, to: null, nextCursor: cursor };
  }

  const batch = Math.max(BATCH_MIN, opts.batch);
  const to = Math.min(opts.safeTip, cursor + batch);
  const from = cursor + 1;
  const catchingUp = to < opts.safeTip;
  const trailFrom = catchingUp ? from : Math.max(from - opts.trail, floor);
  return {
    mode: catchingUp ? "history" : "tip",
    from: trailFrom,
    to,
    nextCursor: to,
  };
}

/** Same idea as Rosen: timeout halves the bite; success grows back toward max. */
export function nextBatch(prev: number, max: number, timedOut: boolean): number {
  const cap = Math.max(BATCH_MIN, max);
  const cur = Math.min(cap, Math.max(BATCH_MIN, prev));
  if (timedOut) return Math.max(BATCH_MIN, Math.floor(cur / 2));
  return Math.min(cap, cur + Math.max(4, Math.floor(cap / 8)));
}

export function shouldMaterializeRanks(opts: {
  now: number;
  lastRanksAt: number;
  ranksMs: number;
  historyRanksMs: number;
  scanLag: number;
  nearTip: number;
}): boolean {
  const catchingUp = opts.scanLag > opts.nearTip;
  const interval = catchingUp ? opts.historyRanksMs : opts.ranksMs;
  return opts.now - opts.lastRanksAt >= interval;
}
