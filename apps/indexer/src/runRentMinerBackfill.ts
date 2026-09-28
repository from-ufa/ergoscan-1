/**
 * One-shot: fill miner_address on rent_collected heights, write snapshot_kv.rent_miners.
 * Does not start the indexer loop. Does not touch defi.*.
 */
import pg from "pg";
import { backfillRentMinersAll } from "./rentMinerBackfill.js";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 2 });
const t0 = Date.now();
const out = await backfillRentMinersAll(pool, {
  maxChunks: Number(process.env.RENT_MINER_FILL_MAX_CHUNKS || 2000),
  pauseMs: Number(process.env.RENT_MINER_FILL_PAUSE_MS || 25),
});
const snap = out.snap;
console.log(
  JSON.stringify({
    type: "rent_miner_fill_done",
    chunks: out.chunks,
    filled: out.filled,
    ms: Date.now() - t0,
    coveredBoxes: snap?.coveredBoxes ?? null,
    uncoveredBoxes: snap?.uncoveredBoxes ?? null,
    pools: snap?.pools.slice(0, 8).map((p) => ({
      name: p.name,
      boxes: p.boxCount,
      erg: Number(p.rentNano) / 1e9,
      share: p.share,
    })),
  })
);
await pool.end();
