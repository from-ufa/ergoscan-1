/**
 * address_tx for long P2S (length 201–2000). Tip already writes these when
 * the address is known at index time; older boxes were filled later and
 * never got create/spend rows.
 *
 * Historical pass: one INSERT…SELECT per md5-slice on boxes_long_md5_box_idx
 * (ORDER BY md5, box_id). Timeout shrinks the slice (never retry the same
 * fat LIMIT). Min-slice still failing 3× → skip that md5 forward. ON CONFLICT.
 * tx_count only for xmax-new rows. Never seq-scan boxes.address. No node.
 */
import type pg from "pg";
import { ADDRESS_SUMMARY_TX_BUMP_SET, type AddressTxRow } from "./batchSql.js";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

const SLICE = Math.max(64, Math.min(50_000, envInt("ADDRESS_TX_LONG_SLICE", 4_000)));
const MAX_SLICES = Math.max(1, Math.min(20, envInt("ADDRESS_TX_LONG_SLICES", 2)));
const BUDGET_MS = Math.max(4_000, Math.min(40_000, envInt("ADDRESS_TX_LONG_BUDGET_MS", 20_000)));
const TIMEOUT_MS = Math.max(8_000, Math.min(60_000, envInt("ADDRESS_TX_LONG_TIMEOUT_MS", 25_000)));
export const LONG_SLICE_MIN = 64;
const ADDR_MAX = 2000;
const ADDR_MIN = 200;
const CURSOR_MD5 = "address_tx_long_md5";
const CURSOR_BOX = "address_tx_long_box";
const DONE_KEY = "address_tx_long_v1";
const FROM_H_KEY = "address_tx_long_from_height";
const PAUSE_KEY = "address_tx_long_pause";
const INDEX = "boxes_long_md5_box_idx";
/** Session lock so tip + writer never walk the same cursor together. */
const LOCK_KEY = 88177401;

export type LongAddressTxTick = {
  skipped: "env" | "lock" | "index" | "pause" | "inflight" | null;
  empty: boolean;
  done: boolean;
  scanned: number;
  written: number;
  batches: number;
  ms: number;
};

/** Tip unit sets `ADDRESS_TX_LONG=0`. Writer unit keeps default `1`. */
export function longAddressTxSlotEnabled(): boolean {
  const v = (process.env.ADDRESS_TX_LONG ?? "1").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

function idleTick(
  t0: number,
  skipped: LongAddressTxTick["skipped"]
): LongAddressTxTick {
  return {
    skipped,
    empty: false,
    done: false,
    scanned: 0,
    written: 0,
    batches: 0,
    ms: Date.now() - t0,
  };
}

type Queryable = { query: pg.Pool["query"] };

let running = false;
/** In-memory only. Reset when md5 changes. Never persist — do not rewind cursors. */
let adaptSlice = SLICE;
let adaptMd5 = "";
let minTimeouts = 0;

export function shrinkLongSlice(n: number): number {
  const next = Math.floor(n / 4);
  return Math.max(LONG_SLICE_MIN, next);
}

export function growLongSlice(n: number, cap: number): number {
  if (n >= cap) return cap;
  return Math.min(cap, n * 2);
}

export function isPgStatementTimeout(err: unknown): boolean {
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code?: string }).code)
      : "";
  if (code === "57014") return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /statement timeout/i.test(msg);
}

function sliceForMd5(md5: string): number {
  if (md5 !== adaptMd5) {
    adaptMd5 = md5;
    adaptSlice = SLICE;
    minTimeouts = 0;
  }
  return adaptSlice;
}

export function addressTxRowsFromLongBox(row: {
  address: string;
  creation_tx_id: string | null;
  creation_height: string | number | null;
  spent_tx_id: string | null;
  spent_height: string | number | null;
}): AddressTxRow[] {
  const address = row.address;
  if (!address || address.length <= ADDR_MIN || address.length > ADDR_MAX) {
    return [];
  }
  const out: AddressTxRow[] = [];
  const ch = Number(row.creation_height);
  if (row.creation_tx_id && Number.isFinite(ch) && ch > 0) {
    out.push({ address, txId: row.creation_tx_id, height: ch });
  }
  const sh = Number(row.spent_height);
  if (row.spent_tx_id && Number.isFinite(sh) && sh > 0) {
    out.push({ address, txId: row.spent_tx_id, height: sh });
  }
  return out;
}

async function getState(db: Queryable, key: string): Promise<string | null> {
  const r = await db.query<{ value: string }>(
    `SELECT value FROM indexer_state WHERE key = $1`,
    [key]
  );
  return r.rows[0]?.value ?? null;
}

async function setState(db: Queryable, key: string, value: string): Promise<void> {
  await db.query(
    `INSERT INTO indexer_state (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value]
  );
}

export async function longAddressTxIndexReady(db: Queryable): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM pg_index i
         JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relname = $1 AND i.indisvalid AND i.indisready
     ) AS ok`,
    [INDEX]
  );
  return Boolean(r.rows[0]?.ok);
}

async function nextLongMd5(
  client: Queryable,
  md5Cursor: string,
  fromH: number | null
): Promise<string | null> {
  if (fromH != null) {
    const r = await client.query<{ m: string }>(
      `SELECT md5(b.address) AS m
         FROM boxes b
        WHERE b.address IS NOT NULL
          AND length(b.address) > $1
          AND length(b.address) <= $2
          AND b.creation_height >= $3
          AND md5(b.address) > $4
        ORDER BY md5(b.address)
        LIMIT 1`,
      [ADDR_MIN, ADDR_MAX, fromH, md5Cursor]
    );
    return r.rows[0]?.m ?? null;
  }
  const r = await client.query<{ m: string }>(
    `SELECT md5(b.address) AS m
       FROM boxes b
      WHERE b.address IS NOT NULL
        AND length(b.address) > $1
        AND length(b.address) <= $2
        AND md5(b.address) > $3
      ORDER BY md5(b.address)
      LIMIT 1`,
    [ADDR_MIN, ADDR_MAX, md5Cursor]
  );
  return r.rows[0]?.m ?? null;
}

type SliceStat = {
  scanned: number;
  written: number;
  lastBox: string | null;
  timedOut: boolean;
};

/** One md5, box_id > cursor, LIMIT slice. Index order = (md5, box_id). */
async function insertLongSlice(
  client: pg.PoolClient,
  md5: string,
  boxCursor: string,
  fromH: number | null,
  limit: number
): Promise<SliceStat> {
  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL statement_timeout = ${TIMEOUT_MS}`);
    await client.query("SET LOCAL enable_bitmapscan = off");
    await client.query("SET LOCAL enable_seqscan = off");
    const fromSql =
      fromH != null
        ? `AND b.creation_height >= ${Number(fromH)}`
        : "";
    const r = await client.query<{
      scanned: string;
      written: string;
      last_box: string | null;
    }>(
      `WITH ids AS (
         SELECT b.box_id
           FROM boxes b
          WHERE md5(b.address) = $3
            AND b.box_id > $4
            AND b.address IS NOT NULL
            AND length(b.address) > $1
            ${fromSql}
          ORDER BY md5(b.address), b.box_id
          LIMIT $5
       ),
       chunk AS (
         SELECT b.box_id, b.address, b.creation_tx_id, b.creation_height,
                b.spent_tx_id, b.spent_height
           FROM boxes b
           JOIN ids ON ids.box_id = b.box_id
          WHERE length(b.address) > $1
            AND length(b.address) <= $2
       ),
       ins AS (
         INSERT INTO address_tx (address, tx_id, height)
         SELECT x.address, x.tx_id, x.height
           FROM (
             SELECT c.address, c.creation_tx_id AS tx_id, c.creation_height AS height
               FROM chunk c
              WHERE c.creation_tx_id IS NOT NULL AND c.creation_height > 0
                AND length(c.address) > $1 AND length(c.address) <= $2
             UNION ALL
             SELECT c.address, c.spent_tx_id, c.spent_height
               FROM chunk c
              WHERE c.spent_tx_id IS NOT NULL AND c.spent_height > 0
                AND length(c.address) > $1 AND length(c.address) <= $2
           ) x
         ON CONFLICT (address, tx_id) DO NOTHING
         RETURNING address, height
       ),
       bump AS (
         INSERT INTO address_summary (
           address, nanoerg, box_count, token_count, tx_count,
           first_height, last_height, updated_at
         )
         SELECT i.address, 0, 0, 0, count(*)::int,
                min(i.height), max(i.height), now()
           FROM ins i
          GROUP BY i.address
         ON CONFLICT (address) DO UPDATE SET
           ${ADDRESS_SUMMARY_TX_BUMP_SET}
       )
       SELECT (SELECT count(*) FROM chunk)::text AS scanned,
              (SELECT count(*) FROM ins)::text AS written,
              (SELECT box_id FROM chunk ORDER BY box_id DESC LIMIT 1) AS last_box`,
      [ADDR_MIN, ADDR_MAX, md5, boxCursor, limit]
    );
    await client.query("COMMIT");
    const row = r.rows[0];
    return {
      scanned: Number(row?.scanned || 0) || 0,
      written: Number(row?.written || 0) || 0,
      lastBox: row?.last_box ?? null,
      timedOut: false,
    };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    if (isPgStatementTimeout(e)) {
      return { scanned: 0, written: 0, lastBox: null, timedOut: true };
    }
    throw e;
  }
}

/**
 * Set-based md5 slices per tick. After the first pass, only boxes created
 * at/after the tip we marked (tip already writes live rows).
 * One process holds LOCK_KEY for the tick — tip must set ADDRESS_TX_LONG=0.
 */
export async function maybeBackfillLongAddressTx(
  pool: pg.Pool
): Promise<LongAddressTxTick> {
  const t0 = Date.now();
  if (!longAddressTxSlotEnabled()) return idleTick(t0, "env");
  if (running) return idleTick(t0, "inflight");
  running = true;
  const client = await pool.connect();
  let locked = false;
  try {
    const lk = await client.query<{ ok: boolean }>(
      `SELECT pg_try_advisory_lock($1) AS ok`,
      [LOCK_KEY]
    );
    locked = Boolean(lk.rows[0]?.ok);
    if (!locked) return idleTick(t0, "lock");
    if (!(await longAddressTxIndexReady(client))) return idleTick(t0, "index");
    if (await getState(client, PAUSE_KEY)) return idleTick(t0, "pause");
    const done = await getState(client, DONE_KEY);
    let md5Cursor = (await getState(client, CURSOR_MD5)) || "";
    let boxCursor = (await getState(client, CURSOR_BOX)) || "";
    const fromRaw = done ? Number((await getState(client, FROM_H_KEY)) || 0) : null;
    const fromH = fromRaw != null && Number.isFinite(fromRaw) ? fromRaw : null;

    let written = 0;
    let scanned = 0;
    let batches = 0;
    let empty = false;

    while (batches < MAX_SLICES && Date.now() - t0 < BUDGET_MS) {
      if (!md5Cursor) {
        const nxt = await nextLongMd5(client, "", fromH);
        if (!nxt) {
          empty = true;
          break;
        }
        md5Cursor = nxt;
        boxCursor = "";
      }
      const used = sliceForMd5(md5Cursor);
      const stat = await insertLongSlice(
        client,
        md5Cursor,
        boxCursor,
        fromH,
        used
      );
      if (stat.timedOut) {
        const next = shrinkLongSlice(used);
        console.warn(
          `[addr-tx-long] timeout slice=${used}→${next} md5=${md5Cursor.slice(0, 12)}`
        );
        if (next >= used) {
          minTimeouts += 1;
          if (minTimeouts >= 3) {
            const nxt = await nextLongMd5(client, md5Cursor, fromH);
            console.warn(
              `[addr-tx-long] skip md5=${md5Cursor.slice(0, 16)} after ${minTimeouts} min-slice timeouts`
            );
            await setState(client, "address_tx_long_last_skip", md5Cursor);
            if (!nxt) {
              empty = true;
              break;
            }
            md5Cursor = nxt;
            boxCursor = "";
            await setState(client, CURSOR_MD5, md5Cursor);
            await setState(client, CURSOR_BOX, boxCursor);
            adaptMd5 = md5Cursor;
            adaptSlice = SLICE;
            minTimeouts = 0;
          }
        } else {
          adaptSlice = next;
          minTimeouts = 0;
        }
        break;
      }
      batches += 1;
      scanned += stat.scanned;
      written += stat.written;
      adaptSlice = growLongSlice(used, SLICE);
      minTimeouts = 0;
      if (stat.lastBox) {
        boxCursor = stat.lastBox;
        await setState(client, CURSOR_MD5, md5Cursor);
        await setState(client, CURSOR_BOX, boxCursor);
      }
      if (stat.scanned < used) {
        const nxt = await nextLongMd5(client, md5Cursor, fromH);
        if (!nxt) {
          empty = true;
          break;
        }
        md5Cursor = nxt;
        boxCursor = "";
        await setState(client, CURSOR_MD5, md5Cursor);
        await setState(client, CURSOR_BOX, boxCursor);
      }
    }

    let nowDone = Boolean(done);
    if (empty && !done) {
      const tip = await client.query<{ h: string }>(
        `SELECT value AS h FROM indexer_state WHERE key = 'last_height'`
      );
      await setState(client, DONE_KEY, String(Date.now()));
      await setState(client, FROM_H_KEY, tip.rows[0]?.h || "0");
      await setState(client, CURSOR_MD5, "");
      await setState(client, CURSOR_BOX, "");
      nowDone = true;
      console.log("[addr-tx-long] address_tx long pass done");
    } else if (empty && done && (md5Cursor || boxCursor)) {
      await setState(client, CURSOR_MD5, "");
      await setState(client, CURSOR_BOX, "");
    }

    if (written > 0 || scanned > 0) {
      console.log(
        `[addr-tx-long] address_tx long wrote+=${written} scanned=${scanned} batches=${batches} slice=${adaptSlice} ${Date.now() - t0}ms`
      );
    }
    return {
      skipped: null,
      empty,
      done: nowDone,
      scanned,
      written,
      batches,
      ms: Date.now() - t0,
    };
  } catch (e) {
    console.warn("[addr-tx-long]", String(e));
    return idleTick(t0, null);
  } finally {
    if (locked) {
      try {
        await client.query(`SELECT pg_advisory_unlock($1)`, [LOCK_KEY]);
      } catch {
        /* ignore */
      }
    }
    client.release();
    running = false;
  }
}
