/**
 * Spending-proof bytes on packed.tx_inputs.
 * Live tip writes them with the spend. History walks packed.blocks from
 * genesis and stops at last_height. Source is the node transactions
 * section, not the full block: ad proofs are not needed here.
 * An empty proof stays NULL. Cursor is indexer_state.input_proof_height.
 * One bite per tick. Does not touch block_section_height.
 */
import type pg from "pg";

const HEIGHT_KEY = "input_proof_height";
const LAG_SKIP = 8;
const BATCH = 32;
const FETCHES = 16;
const BUDGET_MS = 3500;

const NODE = (process.env.ERGO_NODE_URL || "http://127.0.0.1:9053").replace(/\/$/, "");

type NodeInput = {
  boxId?: string;
  spendingProof?: { proofBytes?: string };
};

type NodeTx = { inputs?: NodeInput[] };

type NodeBlock = {
  header?: { id?: string };
  headerId?: string;
  blockTransactions?: { transactions?: NodeTx[] };
  transactions?: NodeTx[];
};

function blockTxs(block: NodeBlock | null | undefined): NodeTx[] | null {
  if (!block) return null;
  if (Array.isArray(block.transactions)) return block.transactions;
  if (block.blockTransactions && Array.isArray(block.blockTransactions.transactions)) {
    return block.blockTransactions.transactions;
  }
  return null;
}

export function blockHeaderId(block: NodeBlock | null | undefined): string {
  return (block?.header?.id || block?.headerId || "").trim().toLowerCase();
}

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
  const txs = blockTxs(block);
  if (!txs) return out;
  for (const tx of txs) {
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
  const res = await fetch(`${NODE}/blocks/${headerId}/transactions`, {
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

      const boxIds: string[] = [];
      const proofs: string[] = [];
      const heights: number[] = [];
      for (const item of blocks) {
        const txs = blockTxs(item.block);
        if (!txs) throw new Error(`block txs missing at ${item.row.height}`);
        const id = blockHeaderId(item.block);
        if (id && id !== item.row.id.toLowerCase()) {
          throw new Error(`block id mismatch at ${item.row.height}`);
        }
        const height = Number(item.row.height);
        for (const proof of item.proofs) {
          boxIds.push(proof.boxId);
          proofs.push(proof.proof);
          heights.push(height);
        }
      }
      await client.query("BEGIN");
      await client.query(`SET LOCAL statement_timeout = '20s'`);
      if (boxIds.length) {
        await client.query(
          `UPDATE packed.tx_inputs AS t
              SET proof_bytes = decode(v.proof, 'hex')
             FROM unnest($1::text[], $2::text[], $3::bigint[]) AS v(box_id, proof, spent_height)
            WHERE t.box_id = packed.hex32(v.box_id)
              AND t.spent_height = v.spent_height
              AND v.proof ~ '^[0-9a-fA-F]{2,}$'
              AND length(v.proof) % 2 = 0`,
          [boxIds, proofs, heights]
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
