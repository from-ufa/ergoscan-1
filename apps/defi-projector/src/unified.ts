/**
 * One Spectrum tip writer: N2T (ERG↔token) + T2T (token↔token) in the same tick.
 * Optional third detect: AgeUSD bank (flag DEFI_AGEUSD_UNIFIED). Off until history
 * is at tip — then the same window, own cursor key, never rewind Spectrum.
 * LithosDex walks `scan_height_lithos` beside this tick. Miss/timeout never
 * stalls Spectrum; Lithos retries its own window.
 * AgeUSD bank stays denylisted in Spectrum detect. No Spectrum/Lithos HTTP.
 */
import { persistAgeUsdBank } from "./ageusd-project.js";
import { detectAgeUsdBank } from "./ageusd-detect.js";
import type { Db } from "./db.js";
import { detectSwaps, type DetectedSwap, type DetectResult } from "./detect.js";
import { persistSwaps } from "./project.js";
import type { PoolReg } from "./registry.js";
import { detectT2tSwaps } from "./t2t-detect.js";
import { persistT2tSwaps } from "./t2t-project.js";
import type { T2tPoolReg } from "./t2t-registry.js";

export type PairDetect = DetectResult;

export function canAdvanceCursor(
  n2t: PairDetect,
  t2t: PairDetect,
  persistOk: boolean,
  ageusd: PairDetect = { ok: true, swaps: [] }
): boolean {
  return Boolean(n2t?.ok && t2t?.ok && ageusd?.ok && persistOk);
}

/** Lithos cursor moves only when detect and persist both succeed. */
export function canAdvanceLithosCursor(
  detect: PairDetect,
  persistOk: boolean
): boolean {
  return Boolean(detect?.ok && persistOk);
}

export async function detectBoth(
  db: Db,
  fromH: number,
  toH: number,
  n2tReg: PoolReg[],
  t2tReg: T2tPoolReg[],
  withAgeUsd = false
): Promise<{ n2t: PairDetect; t2t: PairDetect; ageusd: PairDetect }> {
  const empty = { ok: true, swaps: [] as DetectedSwap[] };
  const [n2t, t2t, ageusd] = await Promise.all([
    n2tReg.length ? detectSwaps(db, fromH, toH, n2tReg) : Promise.resolve(empty),
    t2tReg.length ? detectT2tSwaps(db, fromH, toH, t2tReg) : Promise.resolve(empty),
    withAgeUsd ? detectAgeUsdBank(db, fromH, toH) : Promise.resolve(empty),
  ]);
  return { n2t, t2t, ageusd };
}

export async function persistBoth(
  db: Db,
  n2t: DetectedSwap[],
  t2t: DetectedSwap[],
  ageusd: DetectedSwap[] = []
): Promise<{ ok: boolean; n2t: number; t2t: number; ageusd: number }> {
  const a = await persistSwaps(db, n2t);
  if (!a.ok) return { ok: false, n2t: 0, t2t: 0, ageusd: 0 };
  const b = await persistT2tSwaps(db, t2t);
  if (!b.ok) return { ok: false, n2t: a.n, t2t: 0, ageusd: 0 };
  let ageN = 0;
  if (ageusd.length) {
    const c = await persistAgeUsdBank(db, ageusd);
    if (!c.ok) return { ok: false, n2t: a.n, t2t: b.n, ageusd: 0 };
    ageN = c.n;
  }
  return { ok: true, n2t: a.n, t2t: b.n, ageusd: ageN };
}
