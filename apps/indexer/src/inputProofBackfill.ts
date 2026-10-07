/**
 * Spending-proof bytes on packed.tx_inputs.
 * Live tip writes them with the spend. History walks packed.blocks from
 * genesis and stops at last_height. Source is the local node full block.
 * An empty proof stays NULL. Cursor is indexer_state.input_proof_height.
 * One short bite per tick. Does not touch block_section_height.
 */
import type pg from "pg";

const HEIGHT_KEY = "input_proof_height";
const LAG_SKIP = 8;
const BATCH = 6;
const FETCHES = 4;
const BUDGET_MS = 800;

const NODE = (process.env.ERGO_NODE_URL || "http://127.0.0.1:9053").replace(/\/$/, "");

type NodeInput = {
  boxId?: string;
  spendingProof?: { proofBytes?: string };
};

type NodeBlock = {
  header?: { id?: string };
  blockTransactions?: {
    transactions?: Array<{ inputs?: NodeInput[] }>;
  };
};

export function spendingProofHex(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const hex = raw.trim().toLowerCase();
  if (hex.length < 2 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hex)) return null;
  return hex;
}

/** Non-empty proofs only. Empty proofs stay NULL and are not rewritten. */
export function inputProofsFromBlock(block: NodeBlock | null | undefined): { boxId: string; proof: string }[] {
  const out: { boxId: string; proof: string }[] = [];
  const seen = new Set<string>();
  for (const tx of block?.blockTransactions?.transactions ?? []) {
    for (const input of tx.inputs ?? []) {
      const boxId = (input.boxId ?? "").trim().toLowerCase();
      const proof = spendingProofHex(input.spendingProof?.proofBytes);
      if (!/^[0-9a-f]{64}$/.test(boxId) || !proof || seen.has(boxId)) continue;
      seen.add(boxId);
      out.push({ boxId, proof });
    }
  }
  return out;
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

export async function maybeBackfillInputProofs(pool: pg.Pool): Promise<void> {
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
        return { row, block, proofs: inputProofsFromBlock(block) };
      });

      await client.query("BEGIN");
      await client.query(`SET LOCAL statement_timeout = '20s'`);
      for (const item of blocks) {
        const id = (item.block.header?.id ?? "").toLowerCase();
        if (!item.block.blockTransactions) {
          throw new Error(`block txs missing at ${item.row.height}`);
        }
        if (id && id !== item.row.id.toLowerCase()) {
          throw new Error(`block id mismatch at ${item.row.height}`);
        }
        if (!item.proofs.length) continue;
        await client.query(
          `UPDATE packed.tx_inputs AS t
              SET proof_bytes = decode(v.proof, 'hex')
             FROM unnest($1::text[], $2::text[]) AS v(box_id, proof)
            WHERE t.box_id = packed.hex32(v.box_id)
              AND t.spent_height = $3
              AND v.proof ~ '^[0-9a-fA-F]{2,}$'
              AND length(v.proof) % 2 = 0`,
          [item.proofs.map((p) => p.boxId), item.proofs.map((p) => p.proof), Number(item.row.height)]
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
    console.warn("[indexer] input proof", String(e));
  } finally {
    client?.release();
    running = false;
  }
  if (wrote) {
    console.log(`[indexer] input proof ${from}→${to} n=${wrote} ${Date.now() - t0}ms`);
  }
}
