/**
 * Fill blocks.miner_address on heights that appear in rent_collected.
 * Same Autolykos pick as indexHeight (fattest 88… / short P2PK on tx 0).
 * Does not write defi.* or scan all boxes. Small height bites only.
 */
import type pg from "pg";
import { minerName } from "./knownMiners.js";

const HEIGHT_KEY = "rent_miner_fill_height";
const SNAP_KEY = "rent_miners";
const SPAN = Math.max(50, Math.min(800, envInt("RENT_MINER_FILL_SPAN", 300)));
const TIMEOUT_MS = Math.max(
  4000,
  Math.min(20_000, envInt("RENT_MINER_FILL_TIMEOUT_MS", 8000))
);

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

type Queryable = { query: pg.Pool["query"] };

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

export type RentMinerPool = {
  address: string;
  name: string;
  boxCount: number;
  rentNano: string;
  share: number;
};

export type RentMinersSnap = {
  boxCount: number;
  rentNano: string;
  coveredBoxes: number;
  coveredRentNano: string;
  uncoveredBoxes: number;
  uncoveredRentNano: string;
  pools: RentMinerPool[];
  lastHeight: number | null;
};

const FILL_SQL = `
UPDATE blocks b
SET miner_address = sub.address
FROM (
  SELECT DISTINCT ON (t.height)
    t.height,
    bx.address
  FROM transactions t
  JOIN boxes bx ON bx.creation_tx_id = t.id
  WHERE t.height = ANY($1::bigint[])
    AND t.index_in_block = 0
    AND bx.address IS NOT NULL
    AND (
      bx.address LIKE '88%'
      OR (
        bx.address LIKE '9%'
        AND length(bx.address) >= 50
        AND length(bx.address) < 70
      )
    )
  ORDER BY t.height, bx.value_nano DESC NULLS LAST
) sub
WHERE b.height = sub.height
  AND (b.miner_address IS NULL OR b.miner_address = '')
`;

export async function fillRentMinerChunk(
  db: Queryable,
  heights: number[]
): Promise<number> {
  if (!heights.length) return 0;
  const r = await db.query(FILL_SQL, [heights]);
  return r.rowCount ?? 0;
}

export async function nextEmptyRentMinerHeights(
  db: Queryable,
  afterHeight: number,
  limit: number
): Promise<number[]> {
  const r = await db.query<{ h: string }>(
    `SELECT rc.spent_height::text AS h
     FROM rent_collected rc
     INNER JOIN blocks b ON b.height = rc.spent_height
     WHERE rc.spent_height > $1
       AND (b.miner_address IS NULL OR b.miner_address = '')
     GROUP BY rc.spent_height
     ORDER BY rc.spent_height ASC
     LIMIT $2`,
    [afterHeight, limit]
  );
  return r.rows
    .map((row) => Number(row.h))
    .filter((h) => Number.isFinite(h) && h > 0);
}

export async function writeRentMinersSnap(db: Queryable): Promise<RentMinersSnap> {
  const tot = await db.query<{
    n: string;
    nano: string;
    covered_n: string;
    covered_nano: string;
    last_h: string | null;
  }>(
    `SELECT
       COUNT(*)::text AS n,
       COALESCE(SUM(rc.rent_nano), 0)::text AS nano,
       COUNT(*) FILTER (
         WHERE b.miner_address IS NOT NULL AND b.miner_address <> ''
       )::text AS covered_n,
       COALESCE(SUM(rc.rent_nano) FILTER (
         WHERE b.miner_address IS NOT NULL AND b.miner_address <> ''
       ), 0)::text AS covered_nano,
       MAX(rc.spent_height)::text AS last_h
     FROM rent_collected rc
     LEFT JOIN blocks b ON b.height = rc.spent_height`
  );
  const poolsR = await db.query<{ address: string; n: string; nano: string }>(
    `SELECT b.miner_address AS address,
            COUNT(*)::text AS n,
            COALESCE(SUM(rc.rent_nano), 0)::text AS nano
     FROM rent_collected rc
     INNER JOIN blocks b ON b.height = rc.spent_height
     WHERE b.miner_address IS NOT NULL AND b.miner_address <> ''
     GROUP BY b.miner_address
     ORDER BY SUM(rc.rent_nano) DESC
     LIMIT 24`
  );
  const boxCount = Number(tot.rows[0]?.n || 0) || 0;
  const rentNano = tot.rows[0]?.nano || "0";
  const coveredBoxes = Number(tot.rows[0]?.covered_n || 0) || 0;
  const coveredRentNano = tot.rows[0]?.covered_nano || "0";
  let totalNano = 0n;
  try {
    totalNano = BigInt(rentNano);
  } catch {
    totalNano = 0n;
  }
  const pools: RentMinerPool[] = poolsR.rows.map((row) => {
    let share = 0;
    try {
      const part = BigInt(row.nano || "0");
      share =
        totalNano > 0n ? Number((part * 100_000n) / totalNano) / 100_000 : 0;
    } catch {
      share = 0;
    }
    return {
      address: row.address,
      name: minerName(row.address),
      boxCount: Number(row.n) || 0,
      rentNano: row.nano || "0",
      share,
    };
  });
  let uncoveredNano = "0";
  try {
    uncoveredNano = (BigInt(rentNano) - BigInt(coveredRentNano)).toString();
  } catch {
    uncoveredNano = "0";
  }
  const lastHeight = tot.rows[0]?.last_h != null ? Number(tot.rows[0].last_h) : null;
  const payload: RentMinersSnap = {
    boxCount,
    rentNano,
    coveredBoxes,
    coveredRentNano,
    uncoveredBoxes: Math.max(0, boxCount - coveredBoxes),
    uncoveredRentNano: uncoveredNano,
    pools,
    lastHeight: Number.isFinite(lastHeight as number) ? lastHeight : null,
  };
  await db.query(
    `INSERT INTO snapshot_kv (key, payload, height, updated_at)
     VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (key) DO UPDATE SET
       payload = EXCLUDED.payload,
       height = EXCLUDED.height,
       updated_at = now()`,
    [SNAP_KEY, JSON.stringify(payload), payload.lastHeight]
  );
  return payload;
}

/** One bite. Returns filled row count, or -1 when no empty heights left. */
export async function maybeBackfillRentMiners(pool: pg.Pool): Promise<number> {
  const client = await pool.connect();
  const t0 = Date.now();
  try {
    const after = Number((await getState(client, HEIGHT_KEY)) || 0) || 0;
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = ${TIMEOUT_MS}`);
    const heights = await nextEmptyRentMinerHeights(client, after, SPAN);
    if (!heights.length) {
      await writeRentMinersSnap(client);
      await client.query("COMMIT");
      return -1;
    }
    const filled = await fillRentMinerChunk(client, heights);
    const hi = heights[heights.length - 1]!;
    await setState(client, HEIGHT_KEY, String(hi));
    await client.query("COMMIT");
    const ms = Date.now() - t0;
    if (ms > 400 || filled > 0) {
      console.log(
        `[indexer] rent miner fill ${heights[0]}→${hi} rows=${filled} n=${heights.length} ${ms}ms`
      );
    }
    return filled;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* */
    }
    console.warn("[indexer] rent miner fill", String(e));
    return 0;
  } finally {
    client.release();
  }
}

export async function backfillRentMinersAll(
  pool: pg.Pool,
  opts?: { maxChunks?: number; pauseMs?: number }
): Promise<{ chunks: number; filled: number; snap: RentMinersSnap | null }> {
  const maxChunks = opts?.maxChunks ?? 2000;
  const pauseMs = opts?.pauseMs ?? 25;
  const boot = await pool.connect();
  try {
    await setState(boot, HEIGHT_KEY, "0");
  } finally {
    boot.release();
  }
  let chunks = 0;
  let filled = 0;
  let snap: RentMinersSnap | null = null;
  for (let i = 0; i < maxChunks; i++) {
    const n = await maybeBackfillRentMiners(pool);
    chunks++;
    if (n < 0) {
      const client = await pool.connect();
      try {
        snap = await writeRentMinersSnap(client);
      } finally {
        client.release();
      }
      break;
    }
    filled += n;
    if (pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs));
  }
  if (!snap) {
    const client = await pool.connect();
    try {
      snap = await writeRentMinersSnap(client);
    } finally {
      client.release();
    }
  }
  return { chunks, filled, snap };
}
