/**
 * address_summary: confirmed nanoERG + counts for one address.
 * Writer = indexer (seed once + recount touched addresses at height).
 * Gateway GET must only SELECT this table — never COUNT/SUM boxes.
 *
 * boxes_unspent_idx is partial `length(address) <= 200` (btree cannot index
 * huge P2S keys). Longer contracts (emission is 318 chars) are looked up via
 * md5(address) after ensureLongAddressLookup — never seq-scan boxes on GET.
 * SUM on fat P2PK waits for boxes_unspent_value_idx (023, VPS CONCURRENTLY).
 */
import type pg from "pg";

type Queryable = { query: pg.Pool["query"] };

/** Matches boxes_address_idx / boxes_unspent_idx predicate. */
export const BOXES_ADDRESS_BTREE_MAX = 200;

/**
 * PG btree v4 (8 kB page) max index row ~2704 bytes. `address_summary`
 * PK and rank indexes include `address`, so huge P2S cannot be rows.
 * Bank (992) and emission (318) fit. Skip the rest — still in `boxes`.
 */
export const ADDRESS_SUMMARY_BTREE_MAX = 2000;

let longLookupReady = false;

export function isLongAddressLookupReady(): boolean {
  return longLookupReady;
}

/**
 * Partial md5 index for unspent long P2S. CONCURRENTLY — not inside a tx.
 * Must finish before those addresses are included in per-height refresh.
 */
export async function ensureLongAddressLookup(pool: pg.Pool): Promise<void> {
  const exists = await pool.query<{ c: string | null }>(
    `SELECT to_regclass('public.boxes')::text AS c`
  );
  if (!exists.rows[0]?.c) return;
  const t0 = Date.now();
  const inv = await pool.query<{ name: string }>(
    `SELECT c.relname AS name
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
      WHERE NOT i.indisvalid
        AND c.relname = 'boxes_unspent_long_md5_idx'`
  );
  if (inv.rows.length) {
    console.log("[indexer] drop invalid boxes_unspent_long_md5_idx");
    await pool.query("DROP INDEX CONCURRENTLY IF EXISTS boxes_unspent_long_md5_idx");
  }
  console.log("[indexer] boxes_unspent_long_md5_idx…");
  await pool.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS boxes_unspent_long_md5_idx
      ON boxes (md5(address))
      WHERE spent_tx_id IS NULL AND address IS NOT NULL AND length(address) > 200
  `);
  longLookupReady = true;
  console.log(`[indexer] boxes_unspent_long_md5_idx ready ${Date.now() - t0}ms`);
}

/** Skip SUM on these until boxes_unspent_value_idx is indisvalid. */
export const FAT_SUMMARY_BOX_COUNT = 4000;

const BOXES_UNSPENT_VALUE_IDX = "boxes_unspent_value_idx";

/** True only when the covering index exists and pg_index.indisvalid. */
export async function isBoxesUnspentValueIdxValid(db: Queryable): Promise<boolean> {
  const r = await db.query<{ indisvalid: boolean }>(
    `SELECT i.indisvalid
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = $1
        AND n.nspname = 'public'`,
    [BOXES_UNSPENT_VALUE_IDX]
  );
  return r.rows[0]?.indisvalid === true;
}

/** Rows already in address_summary with box_count at/over the fat threshold. */
export async function fatSummaryRows(
  db: Queryable,
  addresses: string[]
): Promise<{ address: string; box_count: number }[]> {
  if (!addresses.length) return [];
  const r = await db.query<{ address: string; box_count: string | number }>(
    `SELECT address, box_count
       FROM address_summary
      WHERE address = ANY($1::text[])
        AND box_count >= $2`,
    [addresses, FAT_SUMMARY_BOX_COUNT]
  );
  return r.rows.map((row) => ({
    address: row.address,
    box_count: Number(row.box_count) || 0,
  }));
}

/**
 * Live last/first from address_tx. `MAX(height)` on a fat P2S (emission
 * ~1.8M rows) seq-scans under load and blows the 3s tip slot; `LIMIT 1`
 * uses address_tx_addr_height_idx.
 */
export const ADDR_TX_LAST_HEIGHT_SQL = `(SELECT x.height FROM packed.addr ad JOIN packed.address_tx x ON x.addr_id = ad.id WHERE ad.addr_md5 = md5(a.address) AND ad.address = a.address ORDER BY x.height DESC, x.tx_id LIMIT 1)`;

/** Recount last from LIMIT 1. first_height stays on the address_tx bump (ASC on a fat P2S still times out). */
const KEEP_HEIGHTS_SQL = `
  last_height = COALESCE(EXCLUDED.last_height, address_summary.last_height),
  first_height = address_summary.first_height`;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS address_summary (
  address      TEXT PRIMARY KEY,
  nanoerg      NUMERIC NOT NULL DEFAULT 0,
  box_count    INT NOT NULL DEFAULT 0,
  tx_count     INT NOT NULL DEFAULT 0,
  token_count  INT NOT NULL DEFAULT 0,
  last_height  BIGINT,
  first_height BIGINT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

const RANK_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS address_summary_nanoerg_idx
  ON address_summary (nanoerg DESC, address)
`;

const TOKEN_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS address_summary_token_count_idx
  ON address_summary (token_count DESC, address)
`;

const TX_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS address_summary_tx_count_idx
  ON address_summary (tx_count DESC, address)
`;

const FIRST_HEIGHT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS address_summary_first_height_idx
  ON address_summary (first_height DESC NULLS LAST, address)
`;

const LAST_HEIGHT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS address_summary_last_height_idx
  ON address_summary (last_height DESC NULLS LAST, address)
`;

export async function ensureAddressSummarySchema(db: Queryable): Promise<void> {
  await db.query(SCHEMA_SQL);
  await db.query(RANK_INDEX_SQL);
  await db.query(TOKEN_INDEX_SQL);
  await db.query(TX_INDEX_SQL);
  await db.query(FIRST_HEIGHT_INDEX_SQL);
  await db.query(LAST_HEIGHT_INDEX_SQL);
}

const PACKED_UNSPENT = `
  FROM packed.addr ad
  JOIN packed.boxes b ON b.addr_id = ad.id AND b.spent_tx_id IS NULL
 WHERE ad.addr_md5 = md5(a.address) AND ad.address = a.address
`;

const UPSERT_SQL = `
INSERT INTO address_summary (
  address, nanoerg, box_count, token_count, tx_count, last_height, first_height, updated_at
)
SELECT
  a.address,
  COALESCE((
    SELECT SUM(b.value_nano) ${PACKED_UNSPENT}
  ), 0),
  COALESCE((
    SELECT COUNT(*)::int ${PACKED_UNSPENT}
  ), 0),
  CASE
    WHEN COALESCE((
      SELECT COUNT(*)::int ${PACKED_UNSPENT}
    ), 0) >= ${FAT_SUMMARY_BOX_COUNT} THEN 0
    ELSE COALESCE((
      SELECT COUNT(DISTINCT ba.token_id)::int
        FROM packed.addr ad
        JOIN packed.boxes b ON b.addr_id = ad.id AND b.spent_tx_id IS NULL
        JOIN packed.box_assets ba ON ba.box_id = b.box_id
       WHERE ad.addr_md5 = md5(a.address) AND ad.address = a.address
    ), 0)
  END,
  -- Live tx_count is incremented with address_tx. Insert 0 only for a new
  -- row; ON CONFLICT must not reset the counter.
  0,
  ${ADDR_TX_LAST_HEIGHT_SQL},
  NULL,
  now()
FROM unnest($1::text[]) AS a(address)
ON CONFLICT (address) DO UPDATE SET
  nanoerg = EXCLUDED.nanoerg,
  box_count = EXCLUDED.box_count,
  token_count = CASE
    WHEN EXCLUDED.box_count >= ${FAT_SUMMARY_BOX_COUNT} THEN address_summary.token_count
    ELSE EXCLUDED.token_count
  END,
  tx_count = address_summary.tx_count,
  ${KEEP_HEIGHTS_SQL},
  updated_at = now()
`;

const UPSERT_LONG_SQL = `
INSERT INTO address_summary (
  address, nanoerg, box_count, token_count, tx_count, last_height, first_height, updated_at
)
SELECT
  a.address,
  COALESCE((
    SELECT SUM(b.value_nano) ${PACKED_UNSPENT}
  ), 0),
  COALESCE((
    SELECT COUNT(*)::int ${PACKED_UNSPENT}
  ), 0),
  CASE
    WHEN COALESCE((
      SELECT COUNT(*)::int ${PACKED_UNSPENT}
    ), 0) >= ${FAT_SUMMARY_BOX_COUNT} THEN 0
    ELSE COALESCE((
      SELECT COUNT(DISTINCT ba.token_id)::int
        FROM packed.addr ad
        JOIN packed.boxes b ON b.addr_id = ad.id AND b.spent_tx_id IS NULL
        JOIN packed.box_assets ba ON ba.box_id = b.box_id
       WHERE ad.addr_md5 = md5(a.address) AND ad.address = a.address
    ), 0)
  END,
  0,
  COALESCE(
    ${ADDR_TX_LAST_HEIGHT_SQL},
    (SELECT MAX(b.creation_height) ${PACKED_UNSPENT})
  ),
  NULL,
  now()
FROM unnest($1::text[]) AS a(address)
ON CONFLICT (address) DO UPDATE SET
  nanoerg = EXCLUDED.nanoerg,
  box_count = EXCLUDED.box_count,
  token_count = CASE
    WHEN EXCLUDED.box_count >= ${FAT_SUMMARY_BOX_COUNT} THEN address_summary.token_count
    ELSE EXCLUDED.token_count
  END,
  tx_count = address_summary.tx_count,
  ${KEEP_HEIGHTS_SQL},
  updated_at = now()
`;

export async function refreshAddressSummaries(
  client: Queryable,
  addresses: string[],
  chunk = 40
): Promise<void> {
  const seen = new Set<string>();
  const short: string[] = [];
  const long: string[] = [];
  for (const a of addresses) {
    if (typeof a !== "string" || a.length === 0 || seen.has(a)) continue;
    seen.add(a);
    if (a.length <= BOXES_ADDRESS_BTREE_MAX) short.push(a);
    else if (a.length > ADDRESS_SUMMARY_BTREE_MAX) continue;
    else if (longLookupReady) long.push(a);
  }
  const size = Math.max(1, Math.min(40, Math.trunc(chunk) || 40));
  for (let i = 0; i < short.length; i += size) {
    await client.query(UPSERT_SQL, [short.slice(i, i + size)]);
  }
  for (let i = 0; i < long.length; i += size) {
    await client.query(UPSERT_LONG_SQL, [long.slice(i, i + size)]);
  }
}

/** Addresses that gained or spent boxes, or got an address_tx row, at this height. */
export async function touchedAddressesAtHeight(
  client: Queryable,
  height: number
): Promise<string[]> {
  const rows = await client.query<{ address: string }>(
    `SELECT DISTINCT address FROM (
       SELECT ad.address
         FROM packed.transactions t
         JOIN packed.boxes b ON b.creation_tx_id = t.id
         JOIN packed.addr ad ON ad.id = b.addr_id
        WHERE t.height = $1
          AND ad.address IS NOT NULL
          AND ($2::boolean OR length(ad.address) <= 200)
       UNION
       SELECT ad.address
         FROM packed.boxes b
         JOIN packed.addr ad ON ad.id = b.addr_id
        WHERE b.spent_height = $1
          AND ad.address IS NOT NULL
          AND ($2::boolean OR length(ad.address) <= 200)
       UNION
       SELECT ad.address
         FROM packed.address_tx x
         JOIN packed.addr ad ON ad.id = x.addr_id
        WHERE x.height = $1
          AND ($2::boolean OR length(ad.address) <= 200)
     ) u`,
    [height, longLookupReady]
  );
  return rows.rows.map((r) => r.address);
}

/**
 * Unspent long-P2S boxes that already have an address_summary row.
 * Nested loop from summary → boxes_unspent_long_md5_idx. `md5(address) > ''`
 * is required; without it the planner seq-scans boxes and stalls the 6h slot.
 * Do not UNION emission tokens × box_assets × unspent boxes (no unspent-token
 * index; that SELECT holds the writer pool for hours).
 */
export async function listLongUnspentBoxes(
  db: Queryable
): Promise<{ box_id: string; address: string }[]> {
  const r = await db.query<{ box_id: string; address: string }>(
    `SELECT DISTINCT b.box_id, b.address
       FROM address_summary s
       JOIN boxes b
         ON b.spent_tx_id IS NULL
        AND b.address IS NOT NULL
        AND length(b.address) > 200
        AND length(b.address) <= ${ADDRESS_SUMMARY_BTREE_MAX}
        AND md5(b.address) > ''
        AND md5(b.address) = md5(s.address)
        AND b.address = s.address
      WHERE length(s.address) > 200
        AND length(s.address) <= ${ADDRESS_SUMMARY_BTREE_MAX}`
  );
  return r.rows;
}

/** Index probe for one long P2S (emission leftover log). Not a catalog scan. */
export async function hasLongUnspentBox(
  db: Queryable,
  address: string
): Promise<boolean> {
  if (!address || address.length <= 200) return false;
  const r = await db.query<{ one: number }>(
    `SELECT 1 AS one
       FROM boxes b
      WHERE b.spent_tx_id IS NULL
        AND b.address IS NOT NULL
        AND length(b.address) > 200
        AND md5(b.address) > ''
        AND md5(b.address) = md5($1)
        AND b.address = $1
      LIMIT 1`,
    [address]
  );
  return r.rows.length > 0;
}

/** Stale long P2S already in summary. Do not GROUP BY all long unspent boxes. */
export async function collectLongAddresses(db: Queryable): Promise<string[]> {
  const summary = await db.query<{ address: string }>(
    `SELECT address FROM address_summary WHERE length(address) > 200`
  );
  return summary.rows
    .map((r) => r.address)
    .filter((a) => typeof a === "string" && a.length > 0);
}

/**
 * Long unspent P2S that never got an address_summary row. Writer only.
 * Range on boxes_unspent_long_md5_idx (`md5(address) > ''`). Same FROM boxes
 * without an md5() expression seq-scans boxes and stalls the slot.
 */
export async function collectMissingLongAddresses(
  db: Queryable
): Promise<string[]> {
  const r = await db.query<{ address: string }>(
    `SELECT DISTINCT b.address
       FROM boxes b
      WHERE b.spent_tx_id IS NULL
        AND b.address IS NOT NULL
        AND length(b.address) > 200
        AND length(b.address) <= ${ADDRESS_SUMMARY_BTREE_MAX}
        AND md5(b.address) > ''
        AND NOT EXISTS (
          SELECT 1 FROM address_summary s
           WHERE md5(s.address) = md5(b.address)
             AND s.address = b.address
        )`
  );
  return r.rows
    .map((row) => row.address)
    .filter((a) => typeof a === "string" && a.length > 0);
}

const SEED_BALANCES_SQL = `
INSERT INTO address_summary (
  address, nanoerg, box_count, token_count, tx_count, last_height, first_height, updated_at
)
SELECT
  b.address,
  COALESCE(SUM(b.value_nano), 0),
  COUNT(*)::int,
  0,
  0,
  MAX(b.creation_height),
  MIN(b.creation_height),
  now()
FROM boxes b
WHERE b.spent_tx_id IS NULL
  AND b.address IS NOT NULL
  AND length(b.address) <= ${ADDRESS_SUMMARY_BTREE_MAX}
GROUP BY b.address
ON CONFLICT (address) DO UPDATE SET
  nanoerg = EXCLUDED.nanoerg,
  box_count = EXCLUDED.box_count,
  last_height = CASE
    WHEN address_summary.last_height IS NULL THEN EXCLUDED.last_height
    WHEN EXCLUDED.last_height IS NULL THEN address_summary.last_height
    ELSE GREATEST(address_summary.last_height, EXCLUDED.last_height)
  END,
  first_height = CASE
    WHEN address_summary.first_height IS NULL THEN EXCLUDED.first_height
    WHEN EXCLUDED.first_height IS NULL THEN address_summary.first_height
    ELSE LEAST(address_summary.first_height, EXCLUDED.first_height)
  END,
  tx_count = address_summary.tx_count,
  updated_at = now()
`;

/**
 * One-shot fill from unspent boxes (writer only). Idempotent.
 * Does not run on GET. Holds one pool client; tip uses the others.
 * tx_count is the live address_tx counter — seed must not reset it.
 */
export async function seedAddressSummaries(pool: pg.Pool): Promise<{ rows: number }> {
  const client = await pool.connect();
  const t0 = Date.now();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = 0");
    console.log("[indexer] address_summary seed balances…");
    const inserted = await client.query(SEED_BALANCES_SQL);
    await client.query("COMMIT");
    console.log(
      `[indexer] address_summary seed balances upsert=${inserted.rowCount ?? 0} ${Date.now() - t0}ms`
    );
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }

  try {
    const n = await client.query<{ n: string }>(
      "SELECT COUNT(*)::text AS n FROM address_summary"
    );
    const rows = Number(n.rows[0]?.n || 0) || 0;
    console.log(
      `[indexer] address_summary seed done rows=${rows} ${Date.now() - t0}ms`
    );
    return { rows };
  } finally {
    client.release();
  }
}

/**
 * One-shot: address_summary.tx_count = COUNT(address_tx) for every address.
 * Read into TEMP first (no lock on address_summary), then small COMMITs.
 * Writer only. Not inside indexHeight. Covers long P2S (emission / proxy).
 */
const TX_COUNT_FILL_CHUNK = 100;
const TX_COUNT_FILL_RETRY = 8;

function isPgDeadlock(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e != null &&
    "code" in e &&
    (e as { code?: string }).code === "40P01"
  );
}

async function applyTxCountChunk(
  db: Queryable,
  addrs: string[],
  ns: number[]
): Promise<number> {
  for (let attempt = 0; ; attempt++) {
    try {
      await db.query("BEGIN");
      await db.query(
        `SELECT address
           FROM address_summary
          WHERE address = ANY($1::text[])
          ORDER BY address
            FOR UPDATE`,
        [addrs]
      );
      const r = await db.query(
        `UPDATE address_summary s
            SET tx_count = u.n
           FROM unnest($1::text[], $2::int[]) AS u(address, n)
          WHERE s.address = u.address
            AND s.tx_count IS DISTINCT FROM u.n`,
        [addrs, ns]
      );
      await db.query("COMMIT");
      return r.rowCount ?? 0;
    } catch (e) {
      try {
        await db.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      if (!isPgDeadlock(e) || attempt >= TX_COUNT_FILL_RETRY) throw e;
      console.warn(
        `[indexer] address_summary tx_count pack deadlock retry=${attempt + 1} n=${addrs.length}`
      );
      await new Promise((ok) => setTimeout(ok, 25 * (attempt + 1)));
    }
  }
}

export async function backfillAddressSummaryTxCounts(
  db: Queryable
): Promise<{ rows: number }> {
  const t0 = Date.now();
  await db.query("DROP TABLE IF EXISTS pg_temp.address_summary_tx_count_fill");
  await db.query(`
    CREATE TEMP TABLE address_summary_tx_count_fill (
      address TEXT PRIMARY KEY,
      n INT NOT NULL
    ) ON COMMIT PRESERVE ROWS
  `);
  try {
    const hex = "0123456789abcdef";
    for (let i = 0; i < hex.length; i++) {
      await db.query(
        `INSERT INTO address_summary_tx_count_fill (address, n)
         SELECT address, COUNT(*)::int
           FROM address_tx
          WHERE md5(address) LIKE $1
          GROUP BY address`,
        [`${hex[i]}%`]
      );
    }
    let rows = 0;
    let last: string | null = null;
    for (;;) {
      const cursor: string | null = last;
      const page: { rows: { address: string; n: string }[] } = await db.query(
        `SELECT address, n::text AS n
           FROM address_summary_tx_count_fill
          WHERE $1::text IS NULL OR address > $1
          ORDER BY address
          LIMIT $2`,
        [cursor, TX_COUNT_FILL_CHUNK]
      );
      if (!page.rows.length) break;
      const addrs: string[] = page.rows.map((r) => r.address);
      const ns: number[] = page.rows.map((r) => Number(r.n) || 0);
      rows += await applyTxCountChunk(db, addrs, ns);
      last = addrs[addrs.length - 1];
    }
    console.log(
      `[indexer] address_summary tx_count backfill updated=${rows} ${Date.now() - t0}ms`
    );
    return { rows };
  } finally {
    try {
      await db.query("DROP TABLE IF EXISTS pg_temp.address_summary_tx_count_fill");
    } catch {
      /* session drop on release */
    }
  }
}

const TOKEN_COUNT_FILL_CHUNK = 40;

/**
 * Distinct unspent tokens for short addresses. Skips fat rows (same 4000-box
 * cap as ERG SUM). Writer only — GET still reads address_summary.
 */
export async function fillAddressTokenCounts(
  db: Queryable,
  addresses: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const short = [...new Set(addresses.filter((a) => typeof a === "string" && a.length > 0 && a.length <= BOXES_ADDRESS_BTREE_MAX))];
  if (!short.length) return out;
  const counts = await db.query<{ address: string; n: string }>(
    `SELECT b.address, COUNT(DISTINCT ba.token_id)::int::text AS n
       FROM boxes b
       JOIN box_assets ba ON ba.box_id = b.box_id
       JOIN address_summary s ON s.address = b.address
      WHERE b.spent_tx_id IS NULL
        AND b.address = ANY($1::text[])
        AND length(b.address) <= $2
        AND s.box_count < $3
      GROUP BY b.address`,
    [short, BOXES_ADDRESS_BTREE_MAX, FAT_SUMMARY_BOX_COUNT]
  );
  const nBy = new Map(counts.rows.map((r) => [r.address, Number(r.n) || 0]));
  const skinny = await db.query<{ address: string }>(
    `SELECT address FROM address_summary
      WHERE address = ANY($1::text[]) AND box_count < $2`,
    [short, FAT_SUMMARY_BOX_COUNT]
  );
  const addrs = skinny.rows.map((r) => r.address);
  const ns = addrs.map((a) => nBy.get(a) ?? 0);
  if (addrs.length) {
    await db.query(
      `UPDATE address_summary s
          SET token_count = u.n, updated_at = now()
         FROM unnest($1::text[], $2::int[]) AS u(address, n)
        WHERE s.address = u.address
          AND s.token_count IS DISTINCT FROM u.n`,
      [addrs, ns]
    );
  }
  for (let i = 0; i < addrs.length; i++) out.set(addrs[i], ns[i]);
  return out;
}

/**
 * One fat address (≥4000 boxes). Same DISTINCT as skinny, longer timeout
 * at the caller. On failure the caller must rotate updated_at so we do
 * not hammer the same whale every tick.
 */
export async function fillOneFatAddressTokenCount(
  db: Queryable
): Promise<{ address: string | null; n: number | null }> {
  const page = await db.query<{ address: string }>(
    `SELECT address
       FROM address_summary
      WHERE token_count = 0
        AND box_count >= $1
        AND length(address) <= $2
      ORDER BY updated_at ASC, nanoerg DESC
      LIMIT 1`,
    [FAT_SUMMARY_BOX_COUNT, BOXES_ADDRESS_BTREE_MAX]
  );
  const address = page.rows[0]?.address ?? null;
  if (!address) return { address: null, n: null };
  const counted = await db.query<{ n: string }>(
    `SELECT COUNT(*)::int::text AS n
       FROM (
         SELECT DISTINCT ba.token_id
           FROM boxes b
           JOIN box_assets ba ON ba.box_id = b.box_id
          WHERE b.spent_tx_id IS NULL
            AND b.address = $1
            AND length(b.address) <= $2
       ) x`,
    [address, BOXES_ADDRESS_BTREE_MAX]
  );
  const n = Number(counted.rows[0]?.n || 0);
  await db.query(
    `UPDATE address_summary
        SET token_count = $2, updated_at = now()
      WHERE address = $1
        AND token_count IS DISTINCT FROM $2`,
    [address, n]
  );
  return { address, n };
}

export async function touchAddressSummary(db: Queryable, address: string): Promise<void> {
  await db.query(`UPDATE address_summary SET updated_at = now() WHERE address = $1`, [
    address,
  ]);
}

/** One page of zero token_count rows. Empty page = backfill done for non-fat. */
export async function backfillAddressSummaryTokenCountsPage(
  db: Queryable
): Promise<{ rows: number; done: boolean }> {
  const page = await db.query<{ address: string }>(
    `SELECT address
       FROM address_summary
      WHERE token_count = 0
        AND box_count > 0
        AND box_count < $1
        AND length(address) <= $2
      ORDER BY address
      LIMIT $3`,
    [FAT_SUMMARY_BOX_COUNT, BOXES_ADDRESS_BTREE_MAX, TOKEN_COUNT_FILL_CHUNK]
  );
  if (!page.rows.length) return { rows: 0, done: true };
  const filled = await fillAddressTokenCounts(
    db,
    page.rows.map((r) => r.address)
  );
  return { rows: filled.size, done: false };
}

