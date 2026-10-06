/**
 * Block header fields Nautilus needs to sign: roots, votes, PoW.
 * Live tip writes them on each new block. History walks packed.blocks
 * from genesis upward and stops tip−32 so a reorg stays on the live writer.
 * One header GET per height. Cursor is indexer_state.block_header_height.
 */
import type pg from "pg";

const HEIGHT_KEY = "block_header_height";
const TIP_UNWIND = 32;
const LAG_SKIP = 8;
const SPAN = 360;
const FETCHES = 6;

const NODE = (process.env.ERGO_NODE_URL || "http://127.0.0.1:9053").replace(/\/$/, "");

export type HeaderBytes = {
  version: number | null;
  nBits: string | null;
  votes: Buffer | null;
  stateRoot: Buffer | null;
  adProofsRoot: Buffer | null;
  transactionsRoot: Buffer | null;
  extensionHash: Buffer | null;
  powW: Buffer | null;
  powN: Buffer | null;
  powD: string | null;
};

type NodeHeader = {
  id?: string;
  version?: number;
  nBits?: number | string;
  votes?: string | number[];
  stateRoot?: string;
  adProofsRoot?: string;
  transactionsRoot?: string;
  extensionHash?: string;
  powSolutions?: { w?: string; n?: string; d?: number | string };
};

/** Even hex, no 0x. Odd or junk → null so a bad field does not fail the row. */
export function hexBuf(v: unknown): Buffer | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/^0x/i, "").toLowerCase();
  if (!s || s.length % 2 || !/^[0-9a-f]+$/.test(s)) return null;
  return Buffer.from(s, "hex");
}

function uintStr(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return String(Math.trunc(v));
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return v.trim();
  return null;
}

function votesBuf(v: unknown): Buffer | null {
  if (Array.isArray(v) && v.every((n) => typeof n === "number" && n >= 0 && n <= 255)) {
    return Buffer.from(v);
  }
  return hexBuf(v);
}

export function headerBytesFromNode(h: NodeHeader | null | undefined): HeaderBytes {
  const pow = h?.powSolutions;
  const version = typeof h?.version === "number" && Number.isFinite(h.version) ? Math.trunc(h.version) : null;
  return {
    version,
    nBits: uintStr(h?.nBits),
    votes: votesBuf(h?.votes),
    stateRoot: hexBuf(h?.stateRoot),
    adProofsRoot: hexBuf(h?.adProofsRoot),
    transactionsRoot: hexBuf(h?.transactionsRoot),
    extensionHash: hexBuf(h?.extensionHash),
    powW: hexBuf(pow?.w),
    powN: hexBuf(pow?.n),
    powD: uintStr(pow?.d),
  };
}

type Queryable = { query: pg.Pool["query"] };

let running = false;

async function getState(db: Queryable, key: string): Promise<string | null> {
  const r = await db.query<{ value: string }>(`SELECT value FROM indexer_state WHERE key = $1`, [key]);
  return r.rows[0]?.value ?? null;
}

async function setState(db: Queryable, key: string, value: string): Promise<void> {
  await db.query(
    `INSERT INTO indexer_state (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value]
  );
}

async function fetchHeader(headerId: string): Promise<NodeHeader> {
  const res = await fetch(`${NODE}/blocks/${headerId}/header`, {
    signal: AbortSignal.timeout(12_000),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`node ${res.status} /blocks/${headerId}/header`);
  return (await res.json()) as NodeHeader;
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!);
    }
  }
  const n = Math.min(Math.max(1, concurrency), Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

export async function maybeBackfillBlockHeaders(pool: pg.Pool): Promise<void> {
  if (running) return;
  running = true;
  const client = await pool.connect();
  const t0 = Date.now();
  try {
    const lastH = Number((await getState(client, "last_height")) || 0);
    const tipSeen = Number((await getState(client, "tip_seen")) || lastH);
    if (!lastH) return;
    if (tipSeen - lastH > LAG_SKIP) return;

    const stopAt = lastH - TIP_UNWIND;
    const prev = Number((await getState(client, HEIGHT_KEY)) || 0);
    if (prev >= stopAt) return;

    const rows = await client.query<{ height: string; id: string }>(
      `SELECT b.height::text AS height, encode(b.id, 'hex') AS id
         FROM packed.blocks b
        WHERE b.height > $1 AND b.height <= $2
        ORDER BY b.height
        LIMIT $3`,
      [prev, stopAt, SPAN]
    );
    if (!rows.rows.length) return;

    const headers = await mapPool(rows.rows, FETCHES, async (row) => {
      const header = await fetchHeader(row.id);
      return { row, header, bytes: headerBytesFromNode(header) };
    });

    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = '20s'`);
    for (const item of headers) {
      const id = (item.header.id ?? "").toLowerCase();
      if (id && id !== item.row.id.toLowerCase()) {
        throw new Error(`header id mismatch at ${item.row.height}`);
      }
      const b = item.bytes;
      await client.query(
        `UPDATE packed.blocks SET
           version = $2,
           n_bits = $3,
           votes = $4,
           state_root = $5,
           ad_proofs_root = $6,
           transactions_root = $7,
           extension_hash = $8,
           pow_w = $9,
           pow_n = $10,
           pow_d = $11
         WHERE height = $1 AND state_root IS NULL`,
        [
          item.row.height,
          b.version,
          b.nBits,
          b.votes,
          b.stateRoot,
          b.adProofsRoot,
          b.transactionsRoot,
          b.extensionHash,
          b.powW,
          b.powN,
          b.powD,
        ]
      );
    }
    const hi = Number(rows.rows[rows.rows.length - 1]!.height);
    await setState(client, HEIGHT_KEY, String(hi));
    await client.query("COMMIT");
    const ms = Date.now() - t0;
    console.log(
      `[indexer] block header ${rows.rows[0]!.height}→${hi} n=${rows.rows.length} ${ms}ms`
    );
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* */
    }
    console.warn("[indexer] block header", String(e));
  } finally {
    client.release();
    running = false;
  }
}
