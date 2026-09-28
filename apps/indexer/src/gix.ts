/**
 * Global index (our numbers, not official explorer).
 * Tip assigns on insert only after gix_v1. Historical writer fills NULL by height.
 * maxBoxGix / byGlobalIndex HTTP streams read *_gix_next on the gateway.
 * Never COUNT(*) boxes. Never one UPDATE on the whole table.
 */
import type pg from "pg";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

const HEIGHTS = Math.max(1, Math.min(200, envInt("GIX_BACKFILL_HEIGHTS", 8)));
const BOX_LIMIT = Math.max(64, Math.min(20_000, envInt("GIX_BACKFILL_BOXES", 4_000)));
const TX_LIMIT = Math.max(64, Math.min(20_000, envInt("GIX_BACKFILL_TXS", 4_000)));
const BUDGET_MS = Math.max(4_000, Math.min(40_000, envInt("GIX_BACKFILL_BUDGET_MS", 20_000)));
const TIMEOUT_MS = Math.max(8_000, Math.min(60_000, envInt("GIX_BACKFILL_TIMEOUT_MS", 25_000)));
export const GIX_SLICE_MIN = 64;

export const BOX_GIX_NEXT = "box_gix_next";
export const TX_GIX_NEXT = "tx_gix_next";
export const BACKFILL_H = "gix_backfill_height";
export const DONE_KEY = "gix_v1";
export const FROM_H_KEY = "gix_from_height";
export const PAUSE_KEY = "gix_pause";
const LOCK_KEY = 88177402;

export type GixTick = {
  skipped: "env" | "lock" | "pause" | "inflight" | null;
  empty: boolean;
  done: boolean;
  scanned: number;
  written: number;
  heights: number;
  ms: number;
};

/** Tip unit sets `GIX_BACKFILL=0`. Writer keeps default `1`. */
export function gixBackfillEnabled(): boolean {
  const v = (process.env.GIX_BACKFILL ?? "1").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

export function shrinkGixSlice(n: number): number {
  return Math.max(GIX_SLICE_MIN, Math.floor(n / 4));
}

export function growGixSlice(n: number, cap: number): number {
  if (n >= cap) return cap;
  return Math.min(cap, n * 2);
}

/**
 * After a range SELECT+UPDATE: if LIMIT missed, the window [from, to) is done.
 * If LIMIT hit, the last height in the slice may still have NULL gix — stay there.
 * `lastHeight` may be a pg bigint string.
 */
export function nextHeightAfterSlice(
  from: number,
  to: number,
  lastHeight: number | string | null | undefined,
  rowCount: number,
  limit: number
): number {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return from;
  if (rowCount <= 0 || rowCount < limit) return to;
  const last = Number(lastHeight);
  if (!Number.isFinite(last)) return from;
  return Math.max(from, Math.min(Math.trunc(last), to - 1));
}

/** Cursor may move only as far as both tables finished. */
export function nextBackfillHeight(txNext: number, boxNext: number): number {
  return Math.min(txNext, boxNext);
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

type Queryable = { query: pg.Pool["query"] };

let running = false;
let adaptBoxes = BOX_LIMIT;
let adaptTxs = TX_LIMIT;
let minTimeouts = 0;

function idleTick(t0: number, skipped: GixTick["skipped"]): GixTick {
  return {
    skipped,
    empty: false,
    done: false,
    scanned: 0,
    written: 0,
    heights: 0,
    ms: Date.now() - t0,
  };
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
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value]
  );
}

export async function ensureGixCounters(db: Queryable): Promise<void> {
  await db.query(
    `INSERT INTO indexer_state (key, value) VALUES
       ($1, '0'), ($2, '0'), ($3, '0')
     ON CONFLICT (key) DO NOTHING`,
    [BOX_GIX_NEXT, TX_GIX_NEXT, BACKFILL_H]
  );
}

/** Reserve n numbers. Never reuse: next only moves forward. */
export async function takeGixRange(
  db: Queryable,
  key: typeof BOX_GIX_NEXT | typeof TX_GIX_NEXT,
  n: number
): Promise<number> {
  if (n <= 0) return 0;
  await ensureGixCounters(db);
  const r = await db.query<{ start: string }>(
    `UPDATE indexer_state
        SET value = (value::bigint + $2)::text, updated_at = now()
      WHERE key = $1
      RETURNING (value::bigint - $2) AS start`,
    [key, n]
  );
  return Number(r.rows[0]?.start || 0);
}

/** Tip may stamp only after the historical pass closed. */
export function gixTipStampEnabled(done: string | null | undefined): boolean {
  return Boolean(done && String(done).trim());
}

export async function stampTxGix<T extends { gix?: number | null }>(
  db: Queryable,
  rows: T[]
): Promise<void> {
  if (!rows.length) return;
  if (!gixTipStampEnabled(await getState(db, DONE_KEY))) return;
  const start = await takeGixRange(db, TX_GIX_NEXT, rows.length);
  for (let i = 0; i < rows.length; i++) rows[i].gix = start + i;
}

export async function stampBoxGix<T extends { gix?: number | null }>(
  db: Queryable,
  rows: T[]
): Promise<void> {
  if (!rows.length) return;
  if (!gixTipStampEnabled(await getState(db, DONE_KEY))) return;
  const start = await takeGixRange(db, BOX_GIX_NEXT, rows.length);
  for (let i = 0; i < rows.length; i++) rows[i].gix = start + i;
}

/** After unwind: next already moved forward — do not MAX(gix) (no index yet). Gaps stay. */
export async function bumpGixNextAfterUnwind(db: Queryable): Promise<void> {
  await ensureGixCounters(db);
}

type RangeStat = {
  scanned: number;
  written: number;
  timedOut: boolean;
  /** First height that still may have NULL gix. Same as `from` when LIMIT hit there. */
  next: number;
};

async function fillRange(
  client: pg.PoolClient,
  from: number,
  to: number,
  boxLimit: number,
  txLimit: number
): Promise<RangeStat> {
  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL statement_timeout = ${TIMEOUT_MS}`);
    const txs = await client.query<{ id: string; height: string }>(
      `SELECT id, height::text AS height FROM transactions
        WHERE height >= $1 AND height < $2 AND gix IS NULL
        ORDER BY height, index_in_block NULLS LAST, id
        LIMIT $3`,
      [from, to, txLimit]
    );
    let written = 0;
    if (txs.rows.length) {
      const start = await takeGixRange(client, TX_GIX_NEXT, txs.rows.length);
      await client.query(
        `UPDATE transactions t
            SET gix = $2 + x.ord
           FROM unnest($1::text[]) WITH ORDINALITY AS x(id, ord)
          WHERE t.id = x.id AND t.gix IS NULL`,
        [txs.rows.map((r) => r.id), start - 1]
      );
      written += txs.rows.length;
    }
    const boxes = await client.query<{ box_id: string; height: string }>(
      `SELECT b.box_id, b.creation_height::text AS height
         FROM boxes b
         LEFT JOIN transactions t ON t.id = b.creation_tx_id
        WHERE b.creation_height >= $1 AND b.creation_height < $2 AND b.gix IS NULL
        ORDER BY b.creation_height,
                 COALESCE(t.index_in_block, 2147483647),
                 COALESCE(b.output_index, 2147483647),
                 b.box_id
        LIMIT $3`,
      [from, to, boxLimit]
    );
    if (boxes.rows.length) {
      const start = await takeGixRange(client, BOX_GIX_NEXT, boxes.rows.length);
      await client.query(
        `UPDATE boxes b
            SET gix = $2 + x.ord
           FROM unnest($1::text[]) WITH ORDINALITY AS x(box_id, ord)
          WHERE b.box_id = x.box_id AND b.gix IS NULL`,
        [boxes.rows.map((r) => r.box_id), start - 1]
      );
      written += boxes.rows.length;
    }
    const next = nextBackfillHeight(
      nextHeightAfterSlice(
        from,
        to,
        txs.rows.at(-1)?.height,
        txs.rows.length,
        txLimit
      ),
      nextHeightAfterSlice(
        from,
        to,
        boxes.rows.at(-1)?.height,
        boxes.rows.length,
        boxLimit
      )
    );
    if (next > from) {
      await setState(client, BACKFILL_H, String(next));
    }
    await client.query("COMMIT");
    return {
      scanned: txs.rows.length + boxes.rows.length,
      written,
      timedOut: false,
      next,
    };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    if (isPgStatementTimeout(e)) {
      return { scanned: 0, written: 0, timedOut: true, next: from };
    }
    throw e;
  }
}

export async function maybeBackfillGix(pool: pg.Pool): Promise<GixTick> {
  const t0 = Date.now();
  if (!gixBackfillEnabled()) return idleTick(t0, "env");
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
    if (await getState(client, PAUSE_KEY)) return idleTick(t0, "pause");
    await ensureGixCounters(client);
    const done = await getState(client, DONE_KEY);
    let h = Number((await getState(client, BACKFILL_H)) || 0);
    if (!Number.isFinite(h) || h < 0) h = 0;
    const tip = Number((await getState(client, "last_height")) || 0);

    let written = 0;
    let scanned = 0;
    let heights = 0;
    let empty = false;

    while (Date.now() - t0 < BUDGET_MS) {
      if (h > tip) {
        empty = true;
        break;
      }
      const from = h;
      const to = Math.min(from + HEIGHTS, tip + 1);
      if (to <= from) {
        empty = true;
        break;
      }
      const stat = await fillRange(client, from, to, adaptBoxes, adaptTxs);
      if (stat.timedOut) {
        const nextB = shrinkGixSlice(adaptBoxes);
        const nextT = shrinkGixSlice(adaptTxs);
        console.warn(
          `[gix] timeout h=${from} boxes=${adaptBoxes}→${nextB} txs=${adaptTxs}→${nextT}`
        );
        if (nextB >= adaptBoxes && nextT >= adaptTxs) {
          minTimeouts += 1;
          if (minTimeouts >= 3) {
            h = from + 1;
            await setState(client, BACKFILL_H, String(h));
            minTimeouts = 0;
            console.warn(`[gix] skip height ${from} after min-slice timeouts`);
          }
        } else {
          adaptBoxes = nextB;
          adaptTxs = nextT;
          minTimeouts = 0;
        }
        break;
      }
      heights += Math.max(1, stat.next - from);
      scanned += stat.scanned;
      written += stat.written;
      adaptBoxes = growGixSlice(adaptBoxes, BOX_LIMIT);
      adaptTxs = growGixSlice(adaptTxs, TX_LIMIT);
      minTimeouts = 0;
      if (stat.next > from) h = stat.next;
      // One window per tick. Stay in the loop only when LIMIT pinned us
      // on `from` (fat height) and there is still budget.
      if (stat.next > from || stat.written === 0) break;
    }

    let nowDone = Boolean(done);
    if (empty && !done) {
      await setState(client, DONE_KEY, String(Date.now()));
      await setState(client, FROM_H_KEY, String(tip));
      nowDone = true;
      console.log("[gix] backfill pass done");
    }

    if (written > 0 || scanned > 0) {
      console.log(
        `[gix] wrote+=${written} scanned=${scanned} heights=${heights} h=${h} ${Date.now() - t0}ms`
      );
    }
    return {
      skipped: null,
      empty,
      done: nowDone,
      scanned,
      written,
      heights,
      ms: Date.now() - t0,
    };
  } catch (e) {
    console.warn("[gix]", String(e));
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
