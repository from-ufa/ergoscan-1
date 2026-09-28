/**
 * One-shot: fill boxes.additional_registers in #1.400000–#1.400999,
 * then persist the 14 official-only Event Triggers.
 * Does not move rosen.worker_state.scan_height. Does not touch ENRICH/DEEPEN.
 *
 *   DETECT_TIMEOUT_MS=20000 npx tsx apps/rosen-projector/src/fill-sliver.ts
 */
import { readFileSync } from "node:fs";
import { ROSEN_TRIGGER_ADDRESSES } from "@ergoscan/shared";
import { createPool } from "./db.js";
import { detectRosenBoxes, detectRosenWindow } from "./detect.js";
import { persistRosen } from "./persist.js";

const REGS_LO = Number(process.env.SLIVER_REGS_LO || 1_400_000);
const REGS_HI = Number(process.env.SLIVER_REGS_HI || 1_400_999);
const DETECT_LO = Number(process.env.SLIVER_DETECT_LO || 1_400_390);
const DETECT_HI = Number(process.env.SLIVER_DETECT_HI || 1_402_400);
const DETECT_BATCH = Number(process.env.SLIVER_DETECT_BATCH || 200);
const PER_TICK = Number(process.env.REGS_BF_PER_TICK || 36);
const CONCURRENCY = Number(process.env.REGS_BF_CONCURRENCY || 6);
const NODE = (process.env.ERGO_NODE_URL || "http://127.0.0.1:9053").replace(
  /\/$/,
  ""
);
const THEIRS =
  process.env.THEIRS_ONLY_JSON || "/tmp/theirs-only.json";

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

function officialCompleted(): { eventId: string; spend: string }[] {
  try {
    const raw = JSON.parse(readFileSync(THEIRS, "utf8")) as Array<{
      eventId?: string;
      spend?: string | null;
      status?: string;
    }>;
    return raw
      .filter((x) => x.status === "COMPLETED" && x.eventId && x.spend)
      .map((x) => ({ eventId: x.eventId!, spend: x.spend! }));
  } catch {
    return [];
  }
}

async function fillRegs(db: ReturnType<typeof createPool>): Promise<number> {
  let filled = 0;
  let prev = REGS_LO - 1;
  while (prev < REGS_HI) {
    const headers = await db.query<{ height: string; id: string }>(
      `SELECT height::text, id FROM blocks
        WHERE height > $1 AND height <= $2
        ORDER BY height
        LIMIT $3`,
      [prev, REGS_HI, PER_TICK]
    );
    if (!headers.rows.length) break;
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
        console.error(JSON.stringify({ type: "regs_fetch", height: item.height, err: item.err }));
        throw new Error(item.err);
      }
      for (const o of item.outs) {
        ids.push(o.boxId);
        regs.push(o.regs);
      }
      lastOk = item.height;
      fetched += 1;
    }
    if (fetched === 0) break;
    const upd = await db.query(
      `UPDATE boxes b
          SET additional_registers = v.regs
         FROM unnest($1::text[], $2::jsonb[]) AS v(box_id, regs)
        WHERE b.box_id = v.box_id
          AND b.additional_registers IS NULL`,
      [ids, regs]
    );
    filled += upd.rowCount ?? 0;
    prev = lastOk;
    console.log(
      JSON.stringify({
        type: "regs",
        from: headers.rows[0]!.height,
        to: lastOk,
        fetched,
        boxes: ids.length,
        filled: upd.rowCount ?? 0,
      })
    );
  }
  await db.query(
    `INSERT INTO indexer_state (key, value, updated_at) VALUES ('regs_bf_sliver_height', $1, now()), ('regs_bf_sliver_done', $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [String(REGS_HI), String(Date.now())]
  );
  return filled;
}

async function main(): Promise<void> {
  const db = createPool();
  db.options.application_name = "rosen-sliver-fill";
  const want = officialCompleted();
  console.log(
    JSON.stringify({
      type: "start",
      regsLo: REGS_LO,
      regsHi: REGS_HI,
      detectLo: DETECT_LO,
      detectHi: DETECT_HI,
      officialCompleted: want.length,
    })
  );

  const filled = await fillRegs(db);
  console.log(JSON.stringify({ type: "regs_done", filled }));

  if (want.length) {
    const boxes = await db.query<{ box_id: string }>(
      `SELECT box_id FROM boxes
        WHERE spent_tx_id = ANY($1::text[])
          AND address = ANY($2::text[])`,
      [
        want.map((w) => w.spend),
        ROSEN_TRIGGER_ADDRESSES,
      ]
    );
    const detected = await detectRosenBoxes(
      db,
      boxes.rows.map((r) => r.box_id)
    );
    if (!detected.ok) throw new Error("detectRosenBoxes failed");
    const persisted = await persistRosen(db, detected.events, detected.spends);
    console.log(
      JSON.stringify({
        type: "targeted",
        boxes: boxes.rows.length,
        events: detected.events.length,
        spends: detected.spends.length,
        upserts: persisted.n,
        ok: persisted.ok,
        eventIds: detected.events.map((e) => e.eventId),
      })
    );
    if (!persisted.ok) throw new Error("persist targeted failed");
  }

  let windowEvents = 0;
  let windowUpserts = 0;
  for (let from = DETECT_LO; from <= DETECT_HI; from += DETECT_BATCH) {
    const to = Math.min(DETECT_HI, from + DETECT_BATCH - 1);
    const detected = await detectRosenWindow(db, from, to);
    if (!detected.ok) throw new Error(`detect window ${from}-${to} failed`);
    const persisted = await persistRosen(db, detected.events, detected.spends);
    if (!persisted.ok) throw new Error(`persist window ${from}-${to} failed`);
    windowEvents += detected.events.length;
    windowUpserts += persisted.n;
    if (detected.events.length || detected.spends.length) {
      console.log(
        JSON.stringify({
          type: "window",
          from,
          to,
          events: detected.events.length,
          spends: detected.spends.length,
          upserts: persisted.n,
        })
      );
    }
  }

  const ids = want.map((w) => w.eventId);
  const got = ids.length
    ? await db.query<{ event_id: string; status: string; height: string }>(
        `SELECT event_id, status, height::text
           FROM rosen.events
          WHERE event_id = ANY($1::text[])
          ORDER BY height`,
        [ids]
      )
    : { rows: [] };
  const missing = ids.filter((id) => !got.rows.some((r) => r.event_id === id));
  console.log(
    JSON.stringify({
      type: "done",
      filled,
      windowEvents,
      windowUpserts,
      found: got.rows.length,
      want: ids.length,
      missing,
      rows: got.rows,
    })
  );
  await db.end();
  if (missing.length) process.exitCode = 2;
}

void main().catch((e) => {
  console.error(JSON.stringify({ type: "fatal", err: String(e) }));
  process.exit(1);
});
