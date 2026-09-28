/**
 * Fill boxes.additional_registers in the historical hole where deepen
 * stored the box but left regs NULL. Node GET /blocks/{our blocks.id} only.
 * Never /blocks/at. Never indexHeight. Never ENRICH.
 *
 * Main window ~1.401M–1.854M. Leftover sliver ~1.400M–1.400999
 * (original LO sat 1000 heights above the hole). Tip boxes already have regs.
 */
import type pg from "pg";

const HEIGHT_KEY = "regs_bf_height";
const DONE_KEY = "regs_bf_done";
const LAG_SKIP = 2;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

const ENABLED =
  process.env.REGS_BF === "1" || process.env.REGS_BF === "true";
const LO = Math.max(1, envInt("REGS_BF_LO", 1_400_000));
const HI = Math.max(LO, envInt("REGS_BF_HI", 1_854_799));
const SLIVER_HEIGHT_KEY = "regs_bf_sliver_height";
const SLIVER_DONE_KEY = "regs_bf_sliver_done";
const SLIVER_LO = Math.max(1, envInt("REGS_BF_SLIVER_LO", 1_400_000));
const SLIVER_HI = Math.max(SLIVER_LO, envInt("REGS_BF_SLIVER_HI", 1_400_999));
const PER_TICK = Math.max(1, Math.min(64, envInt("REGS_BF_PER_TICK", 36)));
const CONCURRENCY = Math.max(1, Math.min(16, envInt("REGS_BF_CONCURRENCY", 8)));
const TIMEOUT_MS = Math.max(4000, Math.min(30_000, envInt("REGS_BF_TIMEOUT_MS", 12_000)));
const NODE = (process.env.ERGO_NODE_URL || "http://127.0.0.1:9053").replace(
  /\/$/,
  ""
);

type Queryable = { query: pg.Pool["query"] };

type NodeTx = {
  outputs?: Array<{
    boxId?: string;
    additionalRegisters?: Record<string, unknown>;
    registers?: Record<string, unknown>;
  }>;
};

type NodeFullBlock = {
  blockTransactions?: { transactions?: NodeTx[] };
  transactions?: NodeTx[];
};

let running = false;

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

function regsJson(o: {
  additionalRegisters?: Record<string, unknown>;
  registers?: Record<string, unknown>;
}): string {
  const r = o.additionalRegisters ?? o.registers;
  if (!r || typeof r !== "object" || Object.keys(r).length === 0) return "{}";
  try {
    return JSON.stringify(r);
  } catch {
    return "{}";
  }
}

async function nodeBlock(headerId: string): Promise<NodeFullBlock> {
  const res = await fetch(`${NODE}/blocks/${headerId}`, {
    signal: AbortSignal.timeout(20_000),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`node ${res.status} /blocks/${headerId}`);
  return (await res.json()) as NodeFullBlock;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
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

function outputsOf(block: NodeFullBlock): { boxId: string; regs: string }[] {
  const txs =
    block.blockTransactions?.transactions ?? block.transactions ?? [];
  const out: { boxId: string; regs: string }[] = [];
  for (const tx of txs) {
    for (const o of tx.outputs ?? []) {
      if (!o.boxId) continue;
      out.push({ boxId: o.boxId, regs: regsJson(o) });
    }
  }
  return out;
}

/** true = did a bite; caller should skip the 2s POLL sleep. */
export async function maybeBackfillBoxRegisters(pool: pg.Pool): Promise<boolean> {
  if (!ENABLED || running) return false;
  running = true;
  const client = await pool.connect();
  const t0 = Date.now();
  let bit = false;
  try {
    const lastH = Number((await getState(client, "last_height")) || 0);
    const tipSeen = Number((await getState(client, "tip_seen")) || lastH);
    if (!lastH) return false;
    if (tipSeen - lastH > LAG_SKIP) return false;

    const mainDone = Boolean(await getState(client, DONE_KEY));
    const sliverDone = Boolean(await getState(client, SLIVER_DONE_KEY));
    if (mainDone && sliverDone) return false;

    const lo = mainDone ? SLIVER_LO : LO;
    const hi = mainDone ? SLIVER_HI : HI;
    const heightKey = mainDone ? SLIVER_HEIGHT_KEY : HEIGHT_KEY;
    const doneKey = mainDone ? SLIVER_DONE_KEY : DONE_KEY;
    const tag = mainDone ? "regs sliver" : "regs bf";

    const prev = Number((await getState(client, heightKey)) || lo - 1);
    if (prev >= hi) {
      await setState(client, doneKey, String(Date.now()));
      console.log(`[indexer] ${tag} done at ${prev}`);
      return false;
    }

    const headers = await client.query<{ height: string; id: string }>(
      `SELECT height::text, id FROM blocks
        WHERE height > $1 AND height <= $2
        ORDER BY height
        LIMIT $3`,
      [prev, hi, PER_TICK]
    );
    if (!headers.rows.length) {
      await setState(client, doneKey, String(Date.now()));
      console.log(`[indexer] ${tag} done at ${prev} (no more heights)`);
      return false;
    }

    const got = await mapPool(headers.rows, CONCURRENCY, async (row) => {
      const height = Number(row.height);
      try {
        const block = await nodeBlock(row.id);
        return { height, outs: outputsOf(block), err: null as string | null };
      } catch (e) {
        return { height, outs: [], err: String(e) };
      }
    });

    const ids: string[] = [];
    const regs: string[] = [];
    let lastOk = prev;
    let fetched = 0;
    for (const item of got) {
      if (!Number.isFinite(item.height)) break;
      if (item.err) {
        console.warn(`[indexer] ${tag} fetch ${item.height}`, item.err);
        break;
      }
      for (const o of item.outs) {
        ids.push(o.boxId);
        regs.push(o.regs);
      }
      lastOk = item.height;
      fetched += 1;
    }

    if (fetched === 0) return false;

    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = ${TIMEOUT_MS}`);
    const upd = await client.query(
      `UPDATE boxes b
          SET additional_registers = v.regs
         FROM unnest($1::text[], $2::jsonb[]) AS v(box_id, regs)
        WHERE b.box_id = v.box_id
          AND b.additional_registers IS NULL`,
      [ids, regs]
    );
    await setState(client, heightKey, String(lastOk));
    await client.query("COMMIT");
    bit = true;

    if (lastOk >= hi) {
      await setState(client, doneKey, String(Date.now()));
      console.log(`[indexer] ${tag} done at ${lastOk}`);
    }

    console.log(
      `[indexer] ${tag} ${headers.rows[0]!.height}→${lastOk} fetched=${fetched} conc=${CONCURRENCY} boxes=${ids.length} filled=${upd.rowCount ?? 0} ${Date.now() - t0}ms`
    );
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* */
    }
    console.warn("[indexer] regs bf", String(e));
  } finally {
    client.release();
    running = false;
  }
  return bit;
}
