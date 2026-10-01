/**
 * Tail for packed.script.template_hash and packed.box_template.
 * History is scripts/fill-script-template-hash.ts. This only hashes new trees
 * and boxes that land near the tip or the packed-copy cursor.
 */
import type pg from "pg";
import { ergoTreeTemplateHash } from "./ergoTree.js";
import { getWritePool } from "./indexDb.js";

const BATCH = 32;
const EVERY_MS = 5_000;
/** Blocks re-read every tick: a fork re-index can land below the last tip within one tick. */
const OVERLAP = 6;
let busy = false;
let warned = false;
let indexReady: boolean | null = null;
let tipFrom = -1;
let copyFrom = -1;

export function startTemplateHashFill(): void {
  setInterval(() => void tick(), EVERY_MS);
}

async function tick(): Promise<void> {
  if (busy) return;
  const pool = getWritePool();
  if (!pool) return;
  busy = true;
  let client: pg.PoolClient | null = null;
  try {
    if (indexReady !== true) {
      indexReady = await hashIndexReady(pool);
      if (!indexReady) return;
    }
    client = await pool.connect();
    const found = await client.query<{ id: string; ergo_tree: string }>(
      `SELECT s.id::text AS id, s.ergo_tree
         FROM packed.script s
        WHERE s.template_hash IS NULL
        ORDER BY s.id
        LIMIT $1`,
      [BATCH]
    );
    const ids: string[] = [];
    const hashes: string[] = [];
    for (const row of found.rows) {
      let hex: string | null = null;
      try {
        if (row.ergo_tree.length <= 500_000) hex = await ergoTreeTemplateHash(row.ergo_tree);
      } catch {
        hex = null;
      }
      ids.push(row.id);
      hashes.push(hex ?? "");
    }
    if (ids.length) {
      await client.query(
        `UPDATE packed.script AS s
            SET template_hash = CASE WHEN v.hash = '' THEN '\\x00'::bytea ELSE decode(v.hash, 'hex') END
           FROM unnest($1::bigint[], $2::text[]) AS v(id, hash)
          WHERE s.id = v.id AND s.template_hash IS NULL`,
        [ids, hashes]
      );
      await client.query(
        `INSERT INTO packed.box_template (box_id, template_hash, creation_height)
         SELECT b.box_id, s.template_hash, COALESCE(b.creation_height, 0)
           FROM packed.script s
           JOIN packed.boxes b ON b.script_id = s.id
          WHERE s.id = ANY($1::bigint[])
            AND octet_length(s.template_hash) = 32
         ON CONFLICT (box_id) DO NOTHING`,
        [ids]
      );
    }
    await fillHeights(client);
  } catch (err) {
    if (!warned) {
      warned = true;
      console.warn("[template-hash] fill failed", err);
    }
  } finally {
    client?.release();
    busy = false;
  }
}

async function hashIndexReady(pool: pg.Pool): Promise<boolean> {
  const r = await pool.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM pg_index i
         JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relname = 'packed_box_template_hash_idx'
          AND i.indisvalid
          AND i.indisready
     ) AS ok`
  );
  return r.rows[0]?.ok === true;
}

async function fillHeights(client: pg.PoolClient): Promise<void> {
  const heights = await client.query<{ key: string; value: string }>(
    `SELECT key, value FROM indexer_state WHERE key IN ('last_height', 'packed_copy_next')`
  );
  const tip = Number(heights.rows.find((r) => r.key === "last_height")?.value ?? 0);
  const copy = Number(heights.rows.find((r) => r.key === "packed_copy_next")?.value ?? 0);
  if (!Number.isFinite(tip) || tip <= 0) return;
  if (tipFrom < 0) tipFrom = Math.max(0, tip - 20);
  if (copyFrom < 0) copyFrom = Math.max(0, (copy || tip) - 20);
  await insertHeights(client, Math.min(tipFrom, tip - OVERLAP), tip);
  tipFrom = Math.max(0, tip - OVERLAP);
  if (copy > 0 && copy > copyFrom) {
    await insertHeights(client, copyFrom, copy);
    copyFrom = copy;
  }
}

async function insertHeights(client: pg.PoolClient, from: number, to: number): Promise<void> {
  if (to < from) return;
  // By block height: boxes.creation_height is the box's own creationHeight, which the tx author
  // sets and can trail the block by many heights (a fifth of new boxes lag more than 2).
  await client.query(
    `INSERT INTO packed.box_template (box_id, template_hash, creation_height)
     SELECT b.box_id, s.template_hash, COALESCE(b.creation_height, 0)
       FROM packed.transactions t
       JOIN packed.boxes b ON b.creation_tx_id = t.id
       JOIN packed.script s ON s.id = b.script_id
      WHERE t.height >= $1
        AND t.height <= $2
        AND octet_length(s.template_hash) = 32
     ON CONFLICT (box_id) DO NOTHING`,
    [from, to]
  );
}
