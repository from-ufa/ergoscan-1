import {
  ORACLE_FEEDS,
  leaderAddressFromR4,
  pickLeader,
  type LeaderBox,
  type OracleFeedSlug,
} from "@ergoscan/shared";
import { getState, setState, type Queryable } from "./db.js";

export const LEADER_HEIGHT_KEY = "leader_height";
const WINDOW = 80;
/** Boxes sometimes land after the cursor has moved on. Rescan this tail. */
const OVERLAP = 40;

type FeedBattle = {
  slug: OracleFeedSlug;
  refreshNft: string;
  oracleToken: string;
};

export function battleFeeds(): FeedBattle[] {
  const out: FeedBattle[] = [];
  for (const def of Object.values(ORACLE_FEEDS)) {
    if (!def.refreshNft) continue;
    out.push({ slug: def.slug, refreshNft: def.refreshNft, oracleToken: def.oracleToken });
  }
  return out;
}

type RefreshTx = { height: number; tx: string };

type IoRow = {
  tx: string;
  value: string;
  r4: string | null;
  address: string | null;
  spent: boolean;
  seat: boolean;
};

/** New refresh-NFT boxes since `afterHeight`, inside a short height window. */
export async function advanceLeaders(db: Queryable, tip: number): Promise<number> {
  if (!Number.isFinite(tip) || tip <= 0) return 0;
  const raw = await getState(db, LEADER_HEIGHT_KEY);
  const cursor = raw != null && Number(raw) > 0 ? Number(raw) : Math.max(0, tip - OVERLAP);
  const from = Math.max(0, cursor - OVERLAP);
  if (from >= tip) return 0;
  const end = Math.min(tip, from + WINDOW + OVERLAP);
  let wrote = 0;
  for (const feed of battleFeeds()) {
    const txs = await refreshTxsInWindow(db, feed.refreshNft, from, end);
    wrote += await recordLeaders(db, feed, txs);
  }
  const settled = end >= tip ? Math.max(0, tip - 2) : end;
  await setState(db, LEADER_HEIGHT_KEY, String(settled));
  return wrote;
}

export async function refreshTxsInWindow(
  db: Queryable,
  refreshNft: string,
  afterHeight: number,
  throughHeight: number
): Promise<RefreshTx[]> {
  const r = await db.query<{ height: number; tx: string }>(
    `SELECT b.creation_height AS height, encode(b.creation_tx_id, 'hex') AS tx
       FROM packed.boxes b
       JOIN packed.box_assets a
         ON a.box_id = b.box_id
        AND a.amount = 1
        AND a.token_id = decode($1, 'hex')
      WHERE b.creation_height > $2
        AND b.creation_height <= $3
        AND b.creation_tx_id IS NOT NULL
      ORDER BY b.creation_height, b.creation_tx_id`,
    [refreshNft, afterHeight, throughHeight]
  );
  return heightsOf(r.rows);
}

/** Every historical refresh box for one NFT. One index walk, used by the backfill. */
export async function allRefreshTxs(db: Queryable, refreshNft: string): Promise<RefreshTx[]> {
  const r = await db.query<{ height: number; tx: string }>(
    `SELECT b.creation_height AS height, encode(b.creation_tx_id, 'hex') AS tx
       FROM packed.box_assets a
       JOIN packed.boxes b ON b.box_id = a.box_id
      WHERE a.token_id = decode($1, 'hex')
        AND a.amount = 1
        AND b.creation_height IS NOT NULL
        AND b.creation_tx_id IS NOT NULL
      ORDER BY b.creation_height, b.creation_tx_id`,
    [refreshNft]
  );
  return heightsOf(r.rows);
}

function heightsOf(rows: { height: number | string; tx: string }[]): RefreshTx[] {
  const out: RefreshTx[] = [];
  for (const row of rows) {
    const height = Number(row.height);
    if (!row.tx || !Number.isFinite(height)) continue;
    out.push({ height, tx: row.tx });
  }
  return out;
}

export async function recordLeaders(
  db: Queryable,
  feed: FeedBattle,
  txs: RefreshTx[]
): Promise<number> {
  let wrote = 0;
  const step = 80;
  for (let i = 0; i < txs.length; i += step) {
    if (txs.length > 200 && i % 800 === 0) {
      console.log(JSON.stringify({ slug: feed.slug, at: i, of: txs.length }));
    }
    const chunk = txs.slice(i, i + step);
    const io = await loadIo(db, feed.oracleToken, chunk.map((row) => row.tx));
    const byTx = new Map<string, LeaderBox[]>();
    for (const row of io) {
      const address = row.seat ? leaderAddressFromR4(row.r4) : row.address;
      const box: LeaderBox = {
        spent: row.spent,
        value: BigInt(String(row.value || "0").split(".")[0] || "0"),
        address: row.seat ? address : row.address,
        seat: row.seat && address != null,
      };
      const list = byTx.get(row.tx);
      if (list) list.push(box);
      else byTx.set(row.tx, [box]);
    }
    for (const tx of chunk) {
      const winner = pickLeader(byTx.get(tx.tx) ?? []);
      if (!winner) continue;
      if (await insertLeader(db, feed.slug, tx.height, tx.tx, winner)) wrote += 1;
    }
  }
  return wrote;
}

async function loadIo(db: Queryable, oracleToken: string, txs: string[]): Promise<IoRow[]> {
  if (!txs.length) return [];
  const r = await db.query<IoRow>(
    `WITH tx AS (
       SELECT decode(x, 'hex') AS id FROM unnest($1::text[]) AS x
     )
     SELECT encode(t.id, 'hex') AS tx,
            b.value_nano::text AS value,
            b.additional_registers->>'R4' AS r4,
            ad.address,
            true AS spent,
            EXISTS (
              SELECT 1 FROM packed.box_assets a
               WHERE a.box_id = b.box_id
                 AND a.token_id = decode($2, 'hex')
                 AND a.amount = 1
            ) AS seat
       FROM tx t
       JOIN packed.boxes b ON b.spent_tx_id = t.id
       JOIN packed.addr ad ON ad.id = b.addr_id
     UNION ALL
     SELECT encode(t.id, 'hex'),
            b.value_nano::text,
            b.additional_registers->>'R4',
            ad.address,
            false,
            EXISTS (
              SELECT 1 FROM packed.box_assets a
               WHERE a.box_id = b.box_id
                 AND a.token_id = decode($2, 'hex')
                 AND a.amount = 1
            )
       FROM tx t
       JOIN packed.boxes b ON b.creation_tx_id = t.id
       JOIN packed.addr ad ON ad.id = b.addr_id`,
    [txs, oracleToken]
  );
  return r.rows;
}

async function insertLeader(
  db: Queryable,
  slug: string,
  height: number,
  txId: string,
  address: string
): Promise<boolean> {
  const r = await db.query<{ address: string }>(
    `WITH ins AS (
       INSERT INTO oracle.leader (slug, height, tx_id, address)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug, height) DO NOTHING
       RETURNING address
     )
     INSERT INTO oracle.leader_wins (slug, address, wins)
     SELECT $1, address, 1 FROM ins
     ON CONFLICT (slug, address) DO UPDATE
       SET wins = oracle.leader_wins.wins + 1
     RETURNING address`,
    [slug, height, txId, address]
  );
  return r.rows.length > 0;
}

/** Rebuild the counter from the slot rows. Backfill only. */
export async function rebuildWinTotals(db: Queryable): Promise<void> {
  await db.query(
    `INSERT INTO oracle.leader_wins (slug, address, wins)
     SELECT slug, address, count(*)::int
       FROM oracle.leader
      GROUP BY slug, address
     ON CONFLICT (slug, address) DO UPDATE SET wins = EXCLUDED.wins`
  );
  await db.query(
    `DELETE FROM oracle.leader_wins w
      WHERE NOT EXISTS (
        SELECT 1 FROM oracle.leader l
         WHERE l.slug = w.slug AND l.address = w.address
      )`
  );
}
