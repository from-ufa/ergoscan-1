/**
 * One-shot: fill missing `blocks` heights + replace isolated fork losers.
 * Does not start the indexer loop. Does not move last_height.
 *
 *   STITCH_IMPORT=1 DATABASE_URL=... ERGO_NODE_URL=... ENRICH_TOKENS=0 \
 *     npx tsx apps/indexer/src/stitchBlockGaps.ts
 */
import { createPool } from "./db.js";
import { indexHeight, unwindIndexedHeight } from "./index.js";

type Pool = ReturnType<typeof createPool>;

async function gapRanges(pool: Pool): Promise<{ from: number; to: number; n: number }[]> {
  const r = await pool.query<{ gap_from: string; gap_to: string; missing: string }>(
    `SELECT height+1 AS gap_from, nxt-1 AS gap_to, nxt-height-1 AS missing
     FROM (
       SELECT height, lead(height) OVER (ORDER BY height) AS nxt FROM blocks
     ) s
     WHERE nxt IS NOT NULL AND nxt <> height + 1
     ORDER BY gap_from`
  );
  return r.rows.map((row) => ({
    from: Number(row.gap_from),
    to: Number(row.gap_to),
    n: Number(row.missing),
  }));
}

async function loserHeights(pool: Pool): Promise<number[]> {
  const r = await pool.query<{ loser: string }>(
    `SELECT p.height::text AS loser
     FROM blocks b
     JOIN blocks p ON p.height = b.height - 1
     WHERE b.parent_id IS DISTINCT FROM p.id
     ORDER BY p.height`
  );
  return r.rows.map((row) => Number(row.loser));
}

async function counts(pool: Pool): Promise<{ gaps: number; missing: number; forks: number }> {
  const g = await pool.query<{ windows: string; missing: string }>(
    `SELECT COUNT(*)::text AS windows,
            COALESCE(SUM(nxt-height-1),0)::text AS missing
     FROM (
       SELECT height, lead(height) OVER (ORDER BY height) AS nxt FROM blocks
     ) s WHERE nxt IS NOT NULL AND nxt <> height + 1`
  );
  const f = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
     FROM blocks b
     JOIN blocks p ON p.height = b.height - 1
     WHERE b.parent_id IS DISTINCT FROM p.id`
  );
  return {
    gaps: Number(g.rows[0]?.windows || 0),
    missing: Number(g.rows[0]?.missing || 0),
    forks: Number(f.rows[0]?.n || 0),
  };
}

async function lastHeight(pool: Pool): Promise<string> {
  const r = await pool.query<{ value: string }>(
    `SELECT value FROM indexer_state WHERE key = 'last_height'`
  );
  return r.rows[0]?.value ?? "";
}

async function main() {
  const pool = createPool();
  await pool.query("SELECT 1");
  const beforeLast = await lastHeight(pool);
  const before = await counts(pool);
  console.log(
    `[stitch] start missing=${before.missing} windows=${before.gaps} forks=${before.forks} last_height=${beforeLast}`
  );

  const ranges = await gapRanges(pool);
  let filled = 0;
  let fillFail = 0;
  for (const g of ranges) {
    for (let h = g.to; h >= g.from; h--) {
      const t0 = Date.now();
      try {
        await indexHeight(pool, h);
        filled++;
        console.log(`[stitch] fill ${h} ${Date.now() - t0}ms`);
      } catch (e) {
        fillFail++;
        console.warn(`[stitch] fill ${h} FAIL`, String(e));
      }
    }
  }

  const losers = await loserHeights(pool);
  let rewrote = 0;
  let rewriteFail = 0;
  for (const h of losers) {
    const t0 = Date.now();
    try {
      await unwindIndexedHeight(pool, h, { keepLastHeight: true });
      await indexHeight(pool, h);
      rewrote++;
      console.log(`[stitch] rewrite loser ${h} ${Date.now() - t0}ms`);
    } catch (e) {
      rewriteFail++;
      console.warn(`[stitch] rewrite ${h} FAIL`, String(e));
    }
  }

  const afterLast = await lastHeight(pool);
  const after = await counts(pool);
  console.log(
    `[stitch] done filled=${filled} fillFail=${fillFail} rewrote=${rewrote} rewriteFail=${rewriteFail}`
  );
  console.log(
    `[stitch] after missing=${after.missing} windows=${after.gaps} forks=${after.forks} last_height=${afterLast} (was ${beforeLast})`
  );
  if (afterLast !== beforeLast) {
    console.error("[stitch] last_height moved — unexpected");
    process.exit(2);
  }
  if (after.missing > 0 || after.forks > 0 || fillFail || rewriteFail) {
    process.exit(1);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
