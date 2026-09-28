/**
 * Historical gix writer. Not the tip indexer.
 * Same SQL as maybeBackfillGix. No node.
 * Tip unit must set GIX_BACKFILL=0 so this is the only walker.
 */
import { createPool } from "./db.js";
import { gixBackfillEnabled, maybeBackfillGix } from "./gix.js";

function envInt(name: string, fallback: number, lo: number, hi: number): number {
  const raw = process.env[name];
  const n =
    raw == null || raw === "" ? fallback : Math.trunc(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

const POLL_MS = envInt("GIX_BACKFILL_POLL_MS", 50, 20, 2_000);
const POLL_DONE_MS = envInt("GIX_BACKFILL_POLL_DONE_MS", 2_000, 500, 30_000);

if (!process.env.DATABASE_URL) {
  console.error("[gix] DATABASE_URL missing");
  process.exit(1);
}
if (!gixBackfillEnabled()) {
  console.error("[gix] GIX_BACKFILL=0 — this unit must be 1");
  process.exit(1);
}

const pool = createPool();
console.log(
  `[gix] writer start poll=${POLL_MS}ms done_poll=${POLL_DONE_MS}ms heights=${process.env.GIX_BACKFILL_HEIGHTS || "8"}`
);

for (;;) {
  const tick = await maybeBackfillGix(pool);
  if (tick.skipped === "env") {
    console.error("[gix] slot flipped off — exit");
    process.exit(1);
  }
  const idleFollow = tick.done && (tick.empty || tick.scanned === 0);
  const wait = idleFollow ? POLL_DONE_MS : POLL_MS;
  await new Promise((r) => setTimeout(r, wait));
}
