/**
 * Historical address_tx for spenders. Live tip already writes output + spend.
 * Older heights were outputs only — spend-without-change never landed.
 *
 * Walk boxes by spent_height (boxes_spent_height_idx). No seq-scan, no
 * COUNT(*), no LEFT JOIN to find holes — INSERT ON CONFLICT, tx_count
 * bumps only on xmax=0 (upsertAddressTxMany).
 *
 * Starts after token catalog seed_phase=done. Stops at tip-32 so reorg
 * unwind stays on the live writer.
 */
import type pg from "pg";
import { upsertAddressTxMany } from "./batchSql.js";

const HEIGHT_KEY = "address_tx_spend_height";
const DONE_KEY = "address_tx_spend_done";
/** Same cap as index.ts MAX_ADDRESS_TX_LEN (emission tree is 318). */
const MAX_ADDRESS_TX_LEN = 2000;
/** Match index.ts TIP_UNWIND_CAP — do not write the live reorg window. */
const TIP_UNWIND = 32;
const LAG_SKIP = 8;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

const ENABLED =
  process.env.ADDRESS_TX_SPEND_BF !== "0" &&
  process.env.ADDRESS_TX_SPEND_BF !== "false";
const SPAN = Math.max(50, Math.min(2000, envInt("ADDRESS_TX_SPEND_SPAN", 500)));
/** Fat windows are 7–10s. 8s cancelled them. 60s does not make a 7s insert faster. */
const TIMEOUT_MS = Math.max(4000, Math.min(30_000, envInt("ADDRESS_TX_SPEND_TIMEOUT_MS", 20_000)));

type Queryable = { query: pg.Pool["query"] };

let running = false;

async function getState(db: Queryable, key: string): Promise<string | null> {
  const r = await db.query<{ value: string }>(
    `SELECT value FROM indexer_state WHERE key = $1`,
    [key]
  );
  return r.rows[0]?.value ?? null;
}

async function setState(db: Queryable, key: string, value: string): Promise<void> {
  await db.query(
    `INSERT INTO indexer_state (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value]
  );
}

async function seedPhase(db: Queryable): Promise<string | null> {
  const r = await db.query<{ seed_phase: string }>(
    `SELECT seed_phase FROM token_catalog_stats WHERE id IS TRUE`
  );
  return r.rows[0]?.seed_phase ?? null;
}

export async function maybeBackfillAddressTxSpends(pool: pg.Pool): Promise<void> {
  if (!ENABLED || running) return;
  running = true;
  const client = await pool.connect();
  const t0 = Date.now();
  try {
    if ((await getState(client, DONE_KEY))) return;
    if ((await seedPhase(client)) !== "done") return;

    const lastH = Number((await getState(client, "last_height")) || 0);
    const tipSeen = Number((await getState(client, "tip_seen")) || lastH);
    if (!lastH) return;
    if (tipSeen - lastH > LAG_SKIP) return;

    const stopAt = lastH - TIP_UNWIND;
    if (stopAt < 1) {
      await setState(client, DONE_KEY, String(Date.now()));
      console.log("[indexer] address_tx spend bf skip (tip window only)");
      return;
    }

    const prev = Number((await getState(client, HEIGHT_KEY)) || 0);
    const lo = prev + 1;
    if (lo > stopAt) {
      await setState(client, DONE_KEY, String(Date.now()));
      console.log(`[indexer] address_tx spend bf done at ${prev}`);
      return;
    }
    const hi = Math.min(lo + SPAN - 1, stopAt);

    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = ${TIMEOUT_MS}`);
    const rows = await client.query<{
      address: string;
      spent_tx_id: string;
      spent_height: string;
    }>(
      `SELECT address, spent_tx_id, spent_height::text
       FROM boxes
       WHERE spent_height >= $1 AND spent_height <= $2
         AND spent_tx_id IS NOT NULL
         AND address IS NOT NULL
         AND length(address) <= $3`,
      [lo, hi, MAX_ADDRESS_TX_LEN]
    );
    const batch = [];
    for (const row of rows.rows) {
      const height = Number(row.spent_height);
      if (!Number.isFinite(height) || height < 1) continue;
      batch.push({
        address: row.address,
        txId: row.spent_tx_id,
        height,
      });
    }
    await upsertAddressTxMany(client, batch);
    await setState(client, HEIGHT_KEY, String(hi));
    await client.query("COMMIT");
    const ms = Date.now() - t0;
    if (ms > 400 || batch.length > 0) {
      console.log(
        `[indexer] address_tx spend bf ${lo}→${hi} rows=${rows.rows.length} ${ms}ms`
      );
    }
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* */
    }
    console.warn("[indexer] address_tx spend bf", String(e));
  } finally {
    client.release();
    running = false;
  }
}
