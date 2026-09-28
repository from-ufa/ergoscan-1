/**
 * Same Postgres as the indexer and the DeFi projector.
 * History walk hits public.address_tx + boxes — yield to tip, match DeFi's bite.
 */

export const BATCH_MIN = 8;

export function requireGenesisFromEnv(raw: string | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v !== "0" && v !== "false";
}

export function historyAllowed(minHeight: number, requireGenesis: boolean): boolean {
  return !requireGenesis || minHeight <= 0;
}

export function indexerTooFarBehind(indexerLag: number | null, pauseAt: number): boolean {
  if (indexerLag == null || !Number.isFinite(indexerLag)) return false;
  return indexerLag > pauseAt;
}

/** Prefer live last_height; snapshot lag is a fallback if state is missing. */
export function liveIndexerLag(
  tip: number,
  lastHeight: number | null,
  snapLag: number | null
): number | null {
  if (lastHeight != null && Number.isFinite(lastHeight)) {
    return Math.max(0, tip - lastHeight);
  }
  if (snapLag != null && Number.isFinite(snapLag)) return snapLag;
  return null;
}

/** Skip heights the index has not written yet. Do not use this during genesis_hold. */
export function clampCursorToFloor(cursor: number, floor: number): number {
  const minCursor = Math.max(0, floor - 1);
  return cursor < minCursor ? minCursor : cursor;
}

/** Shrink when the indexer is already 1+ behind so tip stays 0–2. */
export function batchForLag(batch: number, indexerLag: number | null): number {
  const n = Math.max(BATCH_MIN, batch);
  if (indexerLag != null && indexerLag >= 1) return Math.min(n, 16);
  return n;
}

export function nextBatch(prev: number, max: number, timedOut: boolean): number {
  const cap = Math.max(BATCH_MIN, max);
  const cur = Math.min(cap, Math.max(BATCH_MIN, prev));
  if (timedOut) return Math.max(BATCH_MIN, Math.floor(cur / 2));
  return Math.min(cap, cur + Math.max(4, Math.floor(cap / 8)));
}

export type RosenDetectWindow = { from: number; to: number };

export type RosenTickPlan = {
  mode: "genesis_hold" | "tip_hold" | "history" | "tip";
  detect: RosenDetectWindow | null;
  advanceCursor: boolean;
  nextCursor: number;
};

export function shouldApplyLateSpends(mode: RosenTickPlan["mode"]): boolean {
  return mode === "tip";
}

export function shouldRefreshKpis(
  mode: RosenTickPlan["mode"],
  lastAt: number,
  now: number,
  intervalMs: number
): boolean {
  if (mode === "genesis_hold" || mode === "tip_hold") return false;
  return now - lastAt >= intervalMs;
}

export function tickSleepMs(
  base: number,
  mode: RosenTickPlan["mode"],
  timedOut: boolean
): number {
  if (mode === "genesis_hold") return Math.max(base, 30_000);
  if (mode === "tip_hold" || timedOut) return base * 2;
  return base;
}

export function planRosenTick(opts: {
  minHeight: number;
  requireGenesis: boolean;
  indexerLag: number | null;
  pauseAt: number;
  cursor: number;
  safeTip: number;
  batch: number;
  trail: number;
  floor: number;
}): RosenTickPlan {
  if (!historyAllowed(opts.minHeight, opts.requireGenesis)) {
    return {
      mode: "genesis_hold",
      detect: null,
      advanceCursor: false,
      nextCursor: opts.cursor,
    };
  }

  const cursor = clampCursorToFloor(opts.cursor, opts.floor);

  if (indexerTooFarBehind(opts.indexerLag, opts.pauseAt)) {
    return {
      mode: "tip_hold",
      detect: null,
      advanceCursor: false,
      nextCursor: cursor,
    };
  }

  if (cursor >= opts.safeTip) {
    return { mode: "tip", detect: null, advanceCursor: false, nextCursor: cursor };
  }

  const batch = Math.max(BATCH_MIN, opts.batch);
  const to = Math.min(opts.safeTip, cursor + batch);
  const from = cursor + 1;
  const history = cursor + batch < opts.safeTip;
  const trailFrom = history ? from : Math.max(from - opts.trail, opts.floor);
  return {
    mode: history ? "history" : "tip",
    detect: from <= to ? { from: trailFrom, to } : null,
    advanceCursor: from <= to,
    nextCursor: to,
  };
}
