/**
 * Block extension and AD proof bytes.
 * Live tip writes them with the block. History walks packed.blocks from
 * genesis and stops at last_height. The node has extension from genesis.
 * ad_proofs stays null where this node has no modifier (below 1460790).
 * Cursor is indexer_state.block_section_height. One short bite per tick.
 */
import type pg from "pg";
import { hexBuf } from "./headerBackfill.js";

const HEIGHT_KEY = "block_section_height";
const LAG_SKIP = 8;
const BATCH = 8;
const FETCHES = 4;
const BUDGET_MS = 800;

const NODE = (process.env.ERGO_NODE_URL || "http://127.0.0.1:9053").replace(/\/$/, "");

export type SectionBytes = {
  extension: Buffer | null;
  adProofs: Buffer | null;
};

type NodeBlock = {
  header?: { id?: string };
  extension?: { headerId?: string; fields?: unknown };
  adProofs?: unknown;
};

function u16(n: number): Buffer {
  const buf = Buffer.alloc(2);
  buf.writeUInt16BE(n);
  return buf;
}

/** Canonical Extension section: header id, field count, then key, length, value. */
export function extensionSectionBytes(headerId: string, fields: unknown): Buffer | null {
  const id = hexBuf(headerId);
  if (!id || id.length !== 32) return null;
  if (!Array.isArray(fields)) return null;
  if (fields.length > 0xffff) return null;
  const parts: Buffer[] = [id, u16(fields.length)];
  for (const field of fields) {
    if (!Array.isArray(field) || field.length < 2) return null;
    const key = hexBuf(field[0]);
    const value = hexBuf(field[1]);
    if (!key || key.length !== 2 || !value || value.length > 255) return null;
    parts.push(key, Buffer.from([value.length]), value);
  }
  return Buffer.concat(parts);
}

/** Explorer hex is proofBytes. An empty proof is null, not a zero-length blob. */
export function adProofSectionBytes(raw: unknown): Buffer | null {
  const hex = typeof raw === "string" ? raw : raw && typeof raw === "object" ? (raw as { proofBytes?: unknown }).proofBytes : null;
  if (typeof hex !== "string" || !hex.trim()) return null;
  const buf = hexBuf(hex);
  return buf && buf.length > 0 ? buf : null;
}

export function sectionBytesFromBlock(block: NodeBlock | null | undefined): SectionBytes {
  const headerId = block?.extension?.headerId || block?.header?.id || "";
  return {
    extension: extensionSectionBytes(headerId, block?.extension?.fields ?? []),
    adProofs: adProofSectionBytes(block?.adProofs),
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

async function fetchBlock(headerId: string): Promise<NodeBlock> {
  const res = await fetch(`${NODE}/blocks/${headerId}`, {
    signal: AbortSignal.timeout(20_000),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`node ${res.status} /blocks/${headerId}`);
  return (await res.json()) as NodeBlock;
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

export async function maybeBackfillBlockSections(pool: pg.Pool): Promise<void> {
  if (running) return;
  running = true;
  let client: pg.PoolClient | null = null;
  const t0 = Date.now();
  let wrote = 0;
  let from = 0;
  let to = 0;
  try {
    client = await pool.connect();
    const lastH = Number((await getState(client, "last_height")) || 0);
    const tipSeen = Number((await getState(client, "tip_seen")) || lastH);
    if (!lastH) return;
    if (tipSeen - lastH > LAG_SKIP) return;

    let prev = Number((await getState(client, HEIGHT_KEY)) || 0);
    if (prev >= lastH) return;
    from = prev + 1;

    while (Date.now() - t0 < BUDGET_MS && prev < lastH) {
      const rows = await client.query<{ height: string; id: string }>(
        `SELECT b.height::text AS height, encode(b.id, 'hex') AS id
           FROM packed.blocks b
          WHERE b.height > $1 AND b.height <= $2
          ORDER BY b.height
          LIMIT $3`,
        [prev, lastH, BATCH]
      );
      if (!rows.rows.length) break;

      const blocks = await mapPool(rows.rows, FETCHES, async (row) => {
        const block = await fetchBlock(row.id);
        return { row, block, bytes: sectionBytesFromBlock(block) };
      });

      await client.query("BEGIN");
      await client.query(`SET LOCAL statement_timeout = '20s'`);
      for (const item of blocks) {
        const id = (item.block.header?.id ?? "").toLowerCase();
        if (id && id !== item.row.id.toLowerCase()) {
          throw new Error(`block id mismatch at ${item.row.height}`);
        }
        await client.query(
          `UPDATE packed.blocks
              SET extension = $2, ad_proofs = $3
            WHERE height = $1`,
          [item.row.height, item.bytes.extension, item.bytes.adProofs]
        );
      }
      const hi = Number(rows.rows[rows.rows.length - 1]!.height);
      await setState(client, HEIGHT_KEY, String(hi));
      await client.query("COMMIT");
      wrote += rows.rows.length;
      to = hi;
      prev = hi;
    }
  } catch (e) {
    try {
      await client?.query("ROLLBACK");
    } catch {
      /* */
    }
    console.warn("[indexer] block section", String(e));
  } finally {
    client?.release();
    running = false;
  }
  if (wrote) {
    console.log(`[indexer] block section ${from}→${to} n=${wrote} ${Date.now() - t0}ms`);
  }
}
