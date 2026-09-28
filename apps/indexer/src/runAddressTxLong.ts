/**
 * Historical long-P2S address_tx writer. Not the tip indexer.
 * Same SQL as maybeBackfillLongAddressTx. Same cursors. No node.
 * Tip unit must set ADDRESS_TX_LONG=0 so this is the only walker.
 */
import { createPool } from "./db.js";
import {
  longAddressTxSlotEnabled,
  maybeBackfillLongAddressTx,
} from "./addressTxLong.js";

function envInt(name: string, fallback: number, lo: number, hi: number): number {
  const raw = process.env[name];
  const n =
    raw == null || raw === "" ? fallback : Math.trunc(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

const POLL_MS = envInt("ADDRESS_TX_LONG_POLL_MS", 50, 20, 2_000);
const POLL_DONE_MS = envInt("ADDRESS_TX_LONG_POLL_DONE_MS", 2_000, 500, 30_000);

if (!process.env.DATABASE_URL) {
  console.error("[addr-tx-long] DATABASE_URL missing");
  process.exit(1);
}
if (!longAddressTxSlotEnabled()) {
  console.error("[addr-tx-long] ADDRESS_TX_LONG=0 — this unit must be 1");
  process.exit(1);
}

const pool = createPool();
console.log(
  `[addr-tx-long] writer start poll=${POLL_MS}ms done_poll=${POLL_DONE_MS}ms slices=${process.env.ADDRESS_TX_LONG_SLICES || "2"}`
);

for (;;) {
  const tick = await maybeBackfillLongAddressTx(pool);
  if (tick.skipped === "env") {
    console.error("[addr-tx-long] slot flipped off — exit");
    process.exit(1);
  }
  const idleFollow = tick.done && (tick.empty || tick.scanned === 0);
  const wait = idleFollow ? POLL_DONE_MS : POLL_MS;
  await new Promise((r) => setTimeout(r, wait));
}
