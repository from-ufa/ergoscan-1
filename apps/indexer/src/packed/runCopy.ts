import { statfsSync } from "node:fs";
import { createPool } from "../db.js";
import { copyPackedRange } from "./copy.js";
import { ensurePackedSecondaryIndexes } from "./schema.js";
import {
  PACKED_CHUNK,
  PACKED_TIP_MARGIN,
  PACKED_WAL_FLOOR_GB,
  packedCopyCeiling,
  packedCopyEnabled,
} from "./flags.js";

function freeGb(path: string): number {
  const s = statfsSync(path);
  return (Number(s.bavail) * Number(s.bsize)) / 1e9;
}

async function indexedTip(pool: { query: (sql: string) => Promise<{ rows: { h: string }[] }> }): Promise<number> {
  const tipR = await pool.query(`SELECT COALESCE(MAX(height), 0)::text AS h FROM blocks`);
  return Number(tipR.rows[0]?.h || 0);
}

/**
 * One-shot historical copy. Not started by the live indexer.
 * Requires PACKED_COPY=1 and PACKED_WRITE=1. Stops when `/` is under the WAL floor.
 * Writes only through tip − 32. The live indexer owns the open unwind window.
 * Secondary indexes are built once the copy has reached that ceiling.
 */
export async function runPackedCopy(): Promise<void> {
  if (!packedCopyEnabled()) {
    console.log("[packed] copy off (need PACKED_COPY=1 and PACKED_WRITE=1)");
    return;
  }
  const pool = createPool();
  try {
    const doneR = await pool.query<{ v: string | null }>(
      `SELECT value AS v FROM indexer_state WHERE key = 'packed_copy_done'`
    );
    if (doneR.rows[0]?.v === "1") {
      console.log("[packed] history copy already finished, exiting");
      return;
    }
    const curR = await pool.query<{ v: string | null }>(
      `SELECT value AS v FROM indexer_state WHERE key = 'packed_copy_next'`
    );
    let lo = Number(curR.rows[0]?.v || 1);
    if (!Number.isFinite(lo) || lo < 1) lo = 1;
    let tip = await indexedTip(pool);
    let ceiling = packedCopyCeiling(tip);
    while (lo <= ceiling) {
      const free = freeGb("/");
      if (free < PACKED_WAL_FLOOR_GB) {
        console.warn(`[packed] stop: / has ${free.toFixed(1)}G free`);
        return;
      }
      tip = await indexedTip(pool);
      ceiling = packedCopyCeiling(tip);
      if (lo > ceiling) break;
      const hi = Math.min(ceiling + 1, lo + PACKED_CHUNK);
      const t0 = Date.now();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await copyPackedRange(client, lo, hi);
        await client.query(
          `INSERT INTO indexer_state (key, value, updated_at)
           VALUES ('packed_copy_next', $1, now())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [String(hi)]
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
      console.log(`[packed] ${lo}..${hi - 1} tip=${tip} ${Date.now() - t0}ms`);
      lo = hi;
    }
    tip = await indexedTip(pool);
    ceiling = packedCopyCeiling(tip);
    console.log(
      `[packed] copy stopped at ${Math.max(0, lo - 1)}, live tip ${tip}, indexer owns the last ${PACKED_TIP_MARGIN}`
    );
    if (lo > ceiling) {
      await ensurePackedSecondaryIndexes(pool);
      await pool.query(
        `INSERT INTO indexer_state (key, value, updated_at)
         VALUES ('packed_copy_done', '1', now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`
      );
      console.log(
        "[packed] history copy finished. packed_copy_done=1. Do not start lumen-packed-copy again. PACKED_WRITE stays on for the tip."
      );
    }
  } finally {
    await pool.end();
  }
}
