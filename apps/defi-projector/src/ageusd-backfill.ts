import type { Db } from "./db.js";
import { getState, setState } from "./db.js";
import { detectAgeUsdBank } from "./ageusd-detect.js";
import { persistAgeUsdBank } from "./ageusd-project.js";
import { AGEUSD_FROM_HEIGHT } from "./ageusd-pair.js";

const DONE = "ageusd_history_v1";
const CURSOR = "ageusd_history_height";
const STEP = 8_000;

/**
 * Mint/redeem for the SigmaUSD bank. Own height key, not scan_height_ageusd:
 * that cursor is tied to the Spectrum walker and must not move backward.
 */
export async function backfillAgeUsdHistory(db: Db): Promise<void> {
  if (await getState(db, DONE)) return;
  const tip = await indexerTip(db);
  if (!(tip > AGEUSD_FROM_HEIGHT)) return;
  let cursor = Number((await getState(db, CURSOR)) || 0);
  if (!(cursor > 0)) cursor = AGEUSD_FROM_HEIGHT;
  console.log(JSON.stringify({ type: "ageusd_backfill_start", from: cursor, tip }));
  let n = 0;
  while (cursor <= tip) {
    const to = Math.min(tip, cursor + STEP - 1);
    const saved = await fillRange(db, cursor, to);
    if (!saved.ok) {
      console.warn(JSON.stringify({ type: "ageusd_backfill_retry", from: cursor, to }));
      return;
    }
    n += saved.n;
    cursor = to + 1;
    await setState(db, CURSOR, String(cursor));
    if ((cursor - AGEUSD_FROM_HEIGHT) % (STEP * 10) < STEP) {
      console.log(JSON.stringify({ type: "ageusd_backfill", at: to, tip, n }));
    }
  }
  await setState(db, DONE, String(Date.now()));
  console.log(JSON.stringify({ type: "ageusd_backfill_done", n, tip }));
}

async function indexerTip(db: Db): Promise<number> {
  const tipRow = await db.query<{ h: string }>(
    `SELECT value::text AS h FROM indexer_state WHERE key = 'last_height'`
  );
  return Number(tipRow.rows[0]?.h || 0);
}

async function fillRange(
  db: Db,
  from: number,
  to: number,
  depth = 0
): Promise<{ ok: boolean; n: number }> {
  const det = await detectAgeUsdBank(db, from, to);
  if (!det.ok) {
    if (to - from <= 400 || depth > 8) {
      console.warn(JSON.stringify({ type: "ageusd_backfill_skip", from, to }));
      return { ok: true, n: 0 };
    }
    const mid = Math.floor((from + to) / 2);
    const left = await fillRange(db, from, mid, depth + 1);
    if (!left.ok) return left;
    const right = await fillRange(db, mid + 1, to, depth + 1);
    return { ok: right.ok, n: left.n + right.n };
  }
  if (!det.swaps.length) return { ok: true, n: 0 };
  const saved = await persistAgeUsdBank(db, det.swaps);
  return { ok: saved.ok, n: saved.ok ? saved.n : 0 };
}
