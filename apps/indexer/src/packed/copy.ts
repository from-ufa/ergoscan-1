import type pg from "pg";
import { ensurePackedSchema } from "./schema.js";

type Queryable = { query: pg.Pool["query"] };

/**
 * Copy text-chain rows for heights [lo, hi) into packed.
 * Drives from transactions.height, boxes.creation_tx_id, tx_inputs.spent_height.
 * Does not scan boxes by address. Does not move gix counters.
 * Idempotent: ON CONFLICT updates the spend, it does not insert a second row.
 */
export async function copyPackedRange(
  db: Queryable,
  lo: number,
  hi: number
): Promise<void> {
  if (!(hi > lo)) return;
  await ensurePackedSchema(db);
  // Asset scratch is small. The volume is slow for random pages, so keep it on the local disk.
  await db.query(`SET LOCAL temp_tablespaces TO DEFAULT`);
  const params = [lo, hi];

  await db.query(
    `INSERT INTO packed.blocks (
       height, id, parent_id, timestamp_ms, size, tx_count, difficulty,
       miner_pk, miner_address, fee_nano, value_nano
     )
     SELECT height, packed.hex32(id), packed.hex32(parent_id), timestamp_ms, size, tx_count,
            difficulty, miner_pk, miner_address, fee_nano, value_nano
       FROM blocks
      WHERE height >= $1 AND height < $2
        AND id ~ '^[0-9a-fA-F]{64}$'
     ON CONFLICT (height) DO UPDATE SET
       id = EXCLUDED.id,
       parent_id = EXCLUDED.parent_id,
       timestamp_ms = EXCLUDED.timestamp_ms,
       size = EXCLUDED.size,
       tx_count = EXCLUDED.tx_count,
       difficulty = EXCLUDED.difficulty,
       miner_pk = EXCLUDED.miner_pk,
       miner_address = EXCLUDED.miner_address,
       fee_nano = EXCLUDED.fee_nano,
       value_nano = EXCLUDED.value_nano`,
    params
  );

  await db.query(
    `INSERT INTO packed.transactions (
       id, height, timestamp_ms, size, fee, index_in_block, input_count, output_count,
       value_nano, shape, protocol, rule_id, rules_version, gix
     )
     SELECT packed.hex32(id), height, timestamp_ms, size, fee, index_in_block,
            input_count, output_count, value_nano, shape, protocol, rule_id, rules_version, gix
       FROM transactions
      WHERE height >= $1 AND height < $2
        AND id ~ '^[0-9a-fA-F]{64}$'
     ON CONFLICT (id) DO UPDATE SET
       height = EXCLUDED.height,
       gix = COALESCE(packed.transactions.gix, EXCLUDED.gix)`,
    params
  );

  await db.query(
    `INSERT INTO packed.addr (address, addr_md5)
     SELECT DISTINCT b.address, md5(b.address)
       FROM transactions t
       JOIN boxes b ON b.creation_tx_id = t.id
      WHERE t.height >= $1 AND t.height < $2
        AND b.address IS NOT NULL AND b.address <> ''
     ON CONFLICT (addr_md5) DO NOTHING`,
    params
  );
  await db.query(
    `INSERT INTO packed.addr (address, addr_md5)
     SELECT DISTINCT x.address, md5(x.address)
       FROM address_tx x
      WHERE x.height >= $1 AND x.height < $2
        AND x.address IS NOT NULL AND x.address <> ''
     ON CONFLICT (addr_md5) DO NOTHING`,
    params
  );
  await db.query(
    `INSERT INTO packed.script (ergo_tree, tree_md5)
     SELECT DISTINCT b.ergo_tree, md5(b.ergo_tree)
       FROM transactions t
       JOIN boxes b ON b.creation_tx_id = t.id
      WHERE t.height >= $1 AND t.height < $2
        AND b.ergo_tree IS NOT NULL AND b.ergo_tree <> ''
     ON CONFLICT (tree_md5) DO NOTHING`,
    params
  );

  await db.query(
    `INSERT INTO packed.boxes (
       box_id, creation_height, value_nano, addr_id, script_id, creation_tx_id,
       spent_tx_id, spent_height, output_index, additional_registers, gix, tree_bytes
     )
     SELECT packed.hex32(b.box_id), b.creation_height, b.value_nano,
            a.id, s.id, packed.hex32(b.creation_tx_id), packed.hex32(b.spent_tx_id),
            b.spent_height, b.output_index, b.additional_registers, b.gix,
            CASE WHEN b.ergo_tree IS NULL OR b.ergo_tree = '' THEN 0
                 ELSE length(b.ergo_tree) / 2 END
       FROM transactions t
       JOIN boxes b ON b.creation_tx_id = t.id
       LEFT JOIN packed.addr a
         ON a.addr_md5 = md5(b.address) AND a.address = b.address
       LEFT JOIN packed.script s
         ON s.tree_md5 = md5(b.ergo_tree) AND s.ergo_tree = b.ergo_tree
      WHERE t.height >= $1 AND t.height < $2
        AND b.box_id ~ '^[0-9a-fA-F]{64}$'
        AND (b.creation_tx_id IS NULL OR b.creation_tx_id ~ '^[0-9a-fA-F]{64}$')
     ON CONFLICT (box_id) DO UPDATE SET
       spent_tx_id = CASE
         WHEN packed.boxes.spent_height IS NULL THEN EXCLUDED.spent_tx_id
         WHEN EXCLUDED.spent_height IS NULL THEN packed.boxes.spent_tx_id
         WHEN EXCLUDED.spent_height >= packed.boxes.spent_height THEN EXCLUDED.spent_tx_id
         ELSE packed.boxes.spent_tx_id
       END,
       spent_height = CASE
         WHEN packed.boxes.spent_height IS NULL THEN EXCLUDED.spent_height
         WHEN EXCLUDED.spent_height IS NULL THEN packed.boxes.spent_height
         ELSE GREATEST(packed.boxes.spent_height, EXCLUDED.spent_height)
       END,
       gix = COALESCE(packed.boxes.gix, EXCLUDED.gix),
       tree_bytes = COALESCE(packed.boxes.tree_bytes, EXCLUDED.tree_bytes)`,
    params
  );

  // Narrow input list for this chunk. packed.tx_inputs has no spent_height index
  // until the copy finishes, so filtering it would seq-scan the whole copy.
  await db.query(
    `CREATE TEMP TABLE packed_copy_inputs (
       box_id text NOT NULL,
       spent_tx_id text NOT NULL,
       spent_height bigint NOT NULL
     ) ON COMMIT DROP`
  );
  await db.query(
    `INSERT INTO packed_copy_inputs (box_id, spent_tx_id, spent_height)
     SELECT i.box_id, i.spent_tx_id, i.spent_height
       FROM tx_inputs i
      WHERE i.spent_height >= $1 AND i.spent_height < $2
        AND i.box_id ~ '^[0-9a-fA-F]{64}$'
        AND i.spent_tx_id ~ '^[0-9a-fA-F]{64}$'`,
    params
  );

  await db.query(
    `INSERT INTO packed.tx_inputs (box_id, spent_tx_id, spent_height)
     SELECT packed.hex32(box_id), packed.hex32(spent_tx_id), spent_height
       FROM packed_copy_inputs
     ON CONFLICT (box_id) DO UPDATE SET
       spent_tx_id = EXCLUDED.spent_tx_id,
       spent_height = EXCLUDED.spent_height
      WHERE EXCLUDED.spent_height >= packed.tx_inputs.spent_height`
  );

  await db.query(
    `UPDATE packed.boxes pb
        SET spent_tx_id = packed.hex32(i.spent_tx_id),
            spent_height = i.spent_height
       FROM packed_copy_inputs i
      WHERE pb.box_id = packed.hex32(i.box_id)
        AND (pb.spent_height IS NULL OR i.spent_height >= pb.spent_height)`
  );

  await db.query(
    `CREATE TEMP TABLE packed_copy_created (
       box_id text NOT NULL,
       token_id text NOT NULL,
       amount numeric NOT NULL,
       tx_id text NOT NULL,
       height bigint NOT NULL
     ) ON COMMIT DROP`
  );
  await db.query(
    `CREATE TEMP TABLE packed_copy_spent (
       token_id text NOT NULL,
       tx_id text NOT NULL,
       height bigint NOT NULL
     ) ON COMMIT DROP`
  );
  await db.query(
    `WITH ids AS MATERIALIZED (
       SELECT b.box_id, t.id AS tx_id, t.height
         FROM transactions t
         JOIN boxes b ON b.creation_tx_id = t.id
        WHERE t.height >= $1 AND t.height < $2
          AND t.id ~ '^[0-9a-fA-F]{64}$'
          AND b.box_id ~ '^[0-9a-fA-F]{64}$'
     )
     INSERT INTO packed_copy_created (box_id, token_id, amount, tx_id, height)
     SELECT a.box_id, a.token_id, a.amount, ids.tx_id, ids.height
       FROM ids
       JOIN LATERAL (
         SELECT box_id, token_id, amount
           FROM box_assets
          WHERE box_id = ids.box_id
            AND token_id ~ '^[0-9a-fA-F]{64}$'
          OFFSET 0
       ) a ON true`,
    params
  );
  await db.query(
    `INSERT INTO packed_copy_spent (token_id, tx_id, height)
     SELECT a.token_id, i.spent_tx_id, i.spent_height
       FROM packed_copy_inputs i
       JOIN LATERAL (
         SELECT token_id
           FROM box_assets
          WHERE box_id = i.box_id
            AND token_id ~ '^[0-9a-fA-F]{64}$'
          OFFSET 0
       ) a ON true`
  );

  await db.query(
    `INSERT INTO packed.box_assets (box_id, token_id, amount)
     SELECT packed.hex32(box_id), packed.hex32(token_id), amount
       FROM packed_copy_created
     ON CONFLICT (box_id, token_id) DO NOTHING`
  );

  await db.query(
    `INSERT INTO packed.address_tx (addr_id, tx_id, height)
     SELECT a.id, packed.hex32(x.tx_id), x.height
       FROM address_tx x
       JOIN packed.addr a ON a.addr_md5 = md5(x.address) AND a.address = x.address
      WHERE x.height >= $1 AND x.height < $2
        AND x.tx_id ~ '^[0-9a-fA-F]{64}$'
     ON CONFLICT (addr_id, tx_id) DO NOTHING`,
    params
  );

  await db.query(
    `INSERT INTO packed.token_tx_seen (token_id, tx_id, height)
     SELECT DISTINCT packed.hex32(c.token_id), packed.hex32(c.tx_id), c.height
       FROM packed_copy_created c
       JOIN LATERAL (
         SELECT 1
           FROM token_tx_seen s
          WHERE s.token_id = c.token_id AND s.tx_id = c.tx_id
          LIMIT 1
       ) seen ON true
     ON CONFLICT (token_id, tx_id) DO NOTHING`
  );
  await db.query(
    `INSERT INTO packed.token_tx_seen (token_id, tx_id, height)
     SELECT DISTINCT packed.hex32(c.token_id), packed.hex32(c.tx_id), c.height
       FROM packed_copy_spent c
       JOIN LATERAL (
         SELECT 1
           FROM token_tx_seen s
          WHERE s.token_id = c.token_id AND s.tx_id = c.tx_id
          LIMIT 1
       ) seen ON true
     ON CONFLICT (token_id, tx_id) DO NOTHING`
  );

  await db.query(
    `INSERT INTO packed.token_tx_move (
       token_id, tx_id, height, created, spent, moved, from_addrs, to_addrs
     )
     SELECT packed.hex32(k.token_id), packed.hex32(k.tx_id), m.height,
            m.created, m.spent, m.moved, m.from_addrs, m.to_addrs
       FROM (
         SELECT token_id, tx_id FROM packed_copy_created
         UNION
         SELECT token_id, tx_id FROM packed_copy_spent
       ) k
       JOIN LATERAL (
         SELECT m.height, m.created, m.spent, m.moved, m.from_addrs, m.to_addrs
           FROM token_tx_move m
          WHERE m.token_id = k.token_id AND m.tx_id = k.tx_id
          LIMIT 1
       ) m ON true
     ON CONFLICT (token_id, tx_id) DO NOTHING`
  );
}

/** One height, called inside the text height's transaction. No-op unless PACKED_WRITE=1. */
export async function writePackedHeight(db: Queryable, height: number): Promise<void> {
  await copyPackedRange(db, height, height + 1);
}
