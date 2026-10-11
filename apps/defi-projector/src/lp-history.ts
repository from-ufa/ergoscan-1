import { isAgeUsdBankNft } from "@ergoscan/shared";
import type { Db } from "./db.js";
import { getState, setState } from "./db.js";
import { SPECTRUM_CFMM_TEMPLATE, SPECTRUM_N2N_TEMPLATE } from "./spectrum-pools.js";

const DONE = "lp_history_v1";
const CURSOR = "lp_history_pool";
const ERG = "0".repeat(64);

export type LpVenue = "spectrum_cfmm" | "spectrum_n2n";

export type LpBox = {
  creationTx: string;
  spentTx: string | null;
  height: number;
  tsMs: number;
  erg: bigint;
  quote: bigint;
  base: bigint;
  lp: bigint;
};

export type LpEvent = {
  txId: string;
  height: number;
  tsMs: number;
  kind: "mint" | "redeem";
  tokenRaw: bigint;
  baseRaw: bigint;
};

/** Transaction height wins. A box can store creation_height 0 while the tx has the block. */
export function resolveBoxHeight(creationHeight: number, txHeight: number): number {
  if (txHeight > 0) return txHeight;
  if (creationHeight > 0) return creationHeight;
  return 0;
}

/**
 * Deposit and withdraw only. A swap moves the reserves apart and is left alone.
 * N2N: LP leaves the box on deposit and comes back on withdraw.
 */
export function classifyLpStep(
  venue: LpVenue,
  dQuote: bigint,
  dBase: bigint,
  dLp: bigint
): "mint" | "redeem" | null {
  if (dQuote === 0n || dBase === 0n) return null;
  if ((dQuote > 0n) !== (dBase > 0n)) return null;
  if (venue === "spectrum_cfmm") return dQuote > 0n ? "mint" : "redeem";
  if (dQuote > 0n && dLp < 0n) return "mint";
  if (dQuote < 0n && dLp > 0n) return "redeem";
  return null;
}

/**
 * One chain per pool. The earliest real head is the opening deposit.
 * A later fragment is only its steps, so a missing link cannot look like a second birth.
 */
export function lpEventsFromBoxes(venue: LpVenue, boxes: LpBox[]): LpEvent[] {
  const byCreation = new Map<string, LpBox>();
  for (const box of boxes) {
    if (!box.creationTx) continue;
    const prev = byCreation.get(box.creationTx);
    if (!prev || box.height < prev.height) byCreation.set(box.creationTx, box);
  }
  const list = [...byCreation.values()];
  const spawned = new Set<string>();
  for (const box of list) {
    if (box.spentTx) spawned.add(box.spentTx);
  }
  const heads = list
    .filter((box) => !spawned.has(box.creationTx))
    .sort((a, b) => a.height - b.height || (a.creationTx < b.creationTx ? -1 : 1));
  const nextOf = new Map<string, LpBox>();
  for (const box of list) {
    if (!box.spentTx) continue;
    const nxt = byCreation.get(box.spentTx);
    if (nxt) nextOf.set(box.creationTx, nxt);
  }
  const out: LpEvent[] = [];
  const birth = heads.find((box) => box.height > 0);
  if (birth && birth.quote > 0n && baseOf(venue, birth) > 0n) {
    out.push({
      txId: birth.creationTx,
      height: birth.height,
      tsMs: birth.tsMs,
      kind: "mint",
      tokenRaw: birth.quote,
      baseRaw: baseOf(venue, birth),
    });
  }
  for (const head of heads) {
    const seen = new Set<string>();
    let cur = head;
    while (cur.spentTx && !seen.has(cur.creationTx)) {
      seen.add(cur.creationTx);
      const nxt = nextOf.get(cur.creationTx);
      if (!nxt || !(nxt.height > 0)) break;
      const dQuote = nxt.quote - cur.quote;
      const dBase = baseOf(venue, nxt) - baseOf(venue, cur);
      const kind = classifyLpStep(venue, dQuote, dBase, nxt.lp - cur.lp);
      if (kind) {
        out.push({
          txId: nxt.creationTx,
          height: nxt.height,
          tsMs: nxt.tsMs,
          kind,
          tokenRaw: dQuote < 0n ? -dQuote : dQuote,
          baseRaw: dBase < 0n ? -dBase : dBase,
        });
      }
      cur = nxt;
    }
  }
  return out;
}

function baseOf(venue: LpVenue, box: LpBox): bigint {
  return venue === "spectrum_cfmm" ? box.erg : box.base;
}

export type GapSwap = {
  txId: string;
  height: number;
  tsMs: number;
  /** Quote leg. Buy means the quote token left the pool. */
  side: "buy" | "sell";
  /** Other leg. For a CFMM pool this is ERG, and the side is the opposite of `side`. */
  baseSide: "buy" | "sell";
  tokenRaw: bigint;
  baseRaw: bigint;
};

/** The old writer dropped a swap that moved more than half of a pool larger than 1000 raw units. */
export function halfPoolDrop(delta: bigint, pool: bigint): boolean {
  const moved = delta < 0n ? -delta : delta;
  return pool > 1000n && moved * 2n > pool;
}

/**
 * Swaps the size filter threw away. Small swaps are already stored.
 * Same-direction reserve moves stay liquidity and are not returned.
 */
export function droppedSwapEvents(venue: LpVenue, boxes: LpBox[]): GapSwap[] {
  const byCreation = new Map<string, LpBox>();
  for (const box of boxes) {
    if (!box.creationTx) continue;
    const prev = byCreation.get(box.creationTx);
    if (!prev || box.height < prev.height) byCreation.set(box.creationTx, box);
  }
  const list = [...byCreation.values()];
  const spawned = new Set<string>();
  for (const box of list) {
    if (box.spentTx) spawned.add(box.spentTx);
  }
  const heads = list.filter((box) => !spawned.has(box.creationTx));
  const nextOf = new Map<string, LpBox>();
  for (const box of list) {
    if (!box.spentTx) continue;
    const nxt = byCreation.get(box.spentTx);
    if (nxt) nextOf.set(box.creationTx, nxt);
  }
  const out: GapSwap[] = [];
  for (const head of heads) {
    const seen = new Set<string>();
    let cur = head;
    while (cur.spentTx && !seen.has(cur.creationTx)) {
      seen.add(cur.creationTx);
      const nxt = nextOf.get(cur.creationTx);
      if (!nxt || !(nxt.height > 0)) break;
      const dQuote = nxt.quote - cur.quote;
      const dBase = baseOf(venue, nxt) - baseOf(venue, cur);
      const dLp = nxt.lp - cur.lp;
      const poolQ = nxt.quote > cur.quote ? nxt.quote : cur.quote;
      const baseCur = baseOf(venue, cur);
      const baseNxt = baseOf(venue, nxt);
      const poolB = baseNxt > baseCur ? baseNxt : baseCur;
      cur = nxt;
      if (dQuote === 0n || dBase === 0n) continue;
      if ((dQuote > 0n) === (dBase > 0n)) continue;
      if (venue === "spectrum_n2n" && dLp !== 0n) continue;
      const dropped =
        venue === "spectrum_cfmm"
          ? halfPoolDrop(dQuote, poolQ)
          : halfPoolDrop(dQuote, poolQ) || halfPoolDrop(dBase, poolB);
      if (!dropped) continue;
      out.push({
        txId: cur.creationTx,
        height: cur.height,
        tsMs: cur.tsMs,
        side: dQuote < 0n ? "buy" : "sell",
        baseSide: dBase < 0n ? "buy" : "sell",
        tokenRaw: dQuote < 0n ? -dQuote : dQuote,
        baseRaw: dBase < 0n ? -dBase : dBase,
      });
    }
  }
  return out;
}

export type PoolRow = {
  poolId: string;
  venue: LpVenue;
  quote: string;
  base: string;
  quoteDec: number;
  baseDec: number;
};

/**
 * Opening deposit and later add/remove for Spectrum pools.
 * Inserts only. Does not update a swap that is already stored, and does not
 * move scan_height*.
 */
export async function backfillLpHistory(db: Db): Promise<void> {
  if (await getState(db, DONE)) return;
  const cursor = (await getState(db, CURSOR)) || "";
  const pools = await listSpectrumPools(db, cursor);
  console.log(JSON.stringify({ type: "lp_backfill_start", from: cursor || null, pools: pools.length }));
  let n = 0;
  let done = 0;
  for (const pool of pools) {
    if (isAgeUsdBankNft(pool.poolId)) {
      await setState(db, CURSOR, pool.poolId);
      done += 1;
      continue;
    }
    const saved = await fillPool(db, pool);
    if (!saved.ok) {
      console.warn(JSON.stringify({ type: "lp_backfill_retry", pool: pool.poolId, done, n }));
      return;
    }
    n += saved.n;
    done += 1;
    await setState(db, CURSOR, pool.poolId);
    if (done % 25 === 0) {
      console.log(
        JSON.stringify({ type: "lp_backfill", pool: pool.poolId, venue: pool.venue, done, n, added: saved.n })
      );
    }
  }
  await setState(db, DONE, String(Date.now()));
  console.log(JSON.stringify({ type: "lp_backfill_done", pools: done, n }));
}

export async function listSpectrumPools(db: Db, after: string): Promise<PoolRow[]> {
  const r = await db.query<{
    pool_id: string;
    venue: string;
    quote_token: string;
    base_token: string;
    quote_dec: number | null;
    base_dec: number | null;
  }>(
    `SELECT r.pool_id, r.venue, r.quote_token,
            COALESCE(NULLIF(r.base_token, ''), $2) AS base_token,
            COALESCE(tq.decimals, r.decimals, 0) AS quote_dec,
            COALESCE(tb.decimals, 0) AS base_dec
       FROM defi.pool_registry r
       LEFT JOIN tokens tq ON tq.token_id = r.quote_token
       LEFT JOIN tokens tb ON tb.token_id = r.base_token
      WHERE r.venue IN ('spectrum_cfmm', 'spectrum_n2n')
        AND r.pool_id > $1
      ORDER BY r.pool_id`,
    [after, ERG]
  );
  return r.rows
    .filter((row) => row.venue === "spectrum_cfmm" || row.venue === "spectrum_n2n")
    .map((row) => ({
      poolId: row.pool_id,
      venue: row.venue as LpVenue,
      quote: row.quote_token,
      base: row.base_token || ERG,
      quoteDec: Number(row.quote_dec) || 0,
      baseDec: Number(row.base_dec) || 0,
    }));
}

async function fillPool(db: Db, pool: PoolRow): Promise<{ ok: boolean; n: number }> {
  const boxes = await readPoolBoxes(db, pool);
  if (!boxes) return { ok: false, n: 0 };
  const events = lpEventsFromBoxes(pool.venue, boxes).filter((ev) => ev.tokenRaw > 0n && ev.baseRaw > 0n);
  if (!events.length) return { ok: true, n: 0 };
  const traders = await readTraders(db, events.map((ev) => ev.txId));
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = 20000");
    let n = 0;
    for (const ev of events) {
      const tokenAmount = wholeTokens(ev.tokenRaw, pool.quoteDec);
      const baseAmount =
        pool.venue === "spectrum_cfmm" ? ergFromNano(ev.baseRaw) : wholeTokens(ev.baseRaw, pool.baseDec);
      if (!(tokenAmount > 0) || !(baseAmount > 0) || !Number.isFinite(tokenAmount) || !Number.isFinite(baseAmount)) {
        continue;
      }
      const price = baseAmount / tokenAmount;
      const inserted = await client.query(
        `INSERT INTO defi.swaps
           (tx_id, height, ts_ms, venue, pool_id, token_id, base_id, side,
            token_amount, base_amount, price, trader, event_kind, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$8,'confirmed')
         ON CONFLICT (tx_id, pool_id, event_kind) DO NOTHING`,
        [
          ev.txId,
          ev.height,
          ev.tsMs > 0 ? ev.tsMs : null,
          pool.venue,
          pool.poolId,
          pool.quote,
          pool.venue === "spectrum_cfmm" ? ERG : pool.base,
          ev.kind,
          tokenAmount,
          baseAmount,
          Number.isFinite(price) ? price : null,
          traders.get(ev.txId) ?? null,
        ]
      );
      n += inserted.rowCount ?? 0;
    }
    await client.query("COMMIT");
    return { ok: true, n };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.warn(JSON.stringify({ type: "lp_backfill_skip", pool: pool.poolId, err: String(e) }));
    return { ok: false, n: 0 };
  } finally {
    client.release();
  }
}

export async function readPoolBoxes(db: Db, pool: PoolRow): Promise<LpBox[] | null> {
  const template = pool.venue === "spectrum_cfmm" ? SPECTRUM_CFMM_TEMPLATE : SPECTRUM_N2N_TEMPLATE;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = 30000");
    const r = await client.query<{
      creation_tx: string | null;
      spent_tx: string | null;
      creation_height: string | number | null;
      tx_height: string | number | null;
      ts_ms: string | number | null;
      erg: string | null;
      quote_amt: string | null;
      base_amt: string | null;
      lp_amt: string | null;
      template: string | null;
    }>(
      `SELECT encode(b.creation_tx_id, 'hex') AS creation_tx,
              encode(b.spent_tx_id, 'hex') AS spent_tx,
              b.creation_height,
              COALESCE(tx.height, 0) AS tx_height,
              COALESCE(tx.timestamp_ms, 0) AS ts_ms,
              b.value_nano::text AS erg,
              COALESCE(q.amount, 0)::text AS quote_amt,
              COALESCE(ba.amount, 0)::text AS base_amt,
              COALESCE(lp.amount, 0)::text AS lp_amt,
              encode(sc.template_hash, 'hex') AS template
         FROM packed.box_assets nft
         JOIN packed.boxes b ON b.box_id = nft.box_id
         LEFT JOIN packed.script sc ON sc.id = b.script_id
         LEFT JOIN packed.transactions tx ON tx.id = b.creation_tx_id
         LEFT JOIN packed.box_assets q
           ON q.box_id = b.box_id AND q.token_id = decode($2, 'hex')
         LEFT JOIN packed.box_assets ba
           ON ba.box_id = b.box_id AND ba.token_id = decode($3, 'hex')
         LEFT JOIN LATERAL (
           SELECT x.amount
             FROM packed.box_assets x
            WHERE x.box_id = b.box_id
              AND x.token_id <> nft.token_id
              AND x.token_id <> decode($2, 'hex')
              AND x.token_id IS DISTINCT FROM decode(NULLIF($3, $4), 'hex')
            ORDER BY x.amount DESC
            LIMIT 1
         ) lp ON true
        WHERE nft.token_id = decode($1, 'hex')
          AND nft.amount = 1`,
      [pool.poolId, pool.quote, pool.base, ERG]
    );
    await client.query("COMMIT");
    const out: LpBox[] = [];
    for (const row of r.rows) {
      if ((row.template || "").toLowerCase() !== template) continue;
      const creationTx = (row.creation_tx || "").toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(creationTx)) continue;
      const spent = (row.spent_tx || "").toLowerCase();
      out.push({
        creationTx,
        spentTx: /^[0-9a-f]{64}$/.test(spent) ? spent : null,
        height: resolveBoxHeight(num(row.creation_height), num(row.tx_height)),
        tsMs: num(row.ts_ms),
        erg: big(row.erg),
        quote: big(row.quote_amt),
        base: big(row.base_amt),
        lp: big(row.lp_amt),
      });
    }
    return out;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.warn(JSON.stringify({ type: "lp_backfill_read_skip", pool: pool.poolId, err: String(e) }));
    return null;
  } finally {
    client.release();
  }
}

export async function readTraders(db: Db, txIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(txIds)].filter((id) => /^[0-9a-f]{64}$/.test(id));
  if (!ids.length) return out;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = 8000");
    const r = await client.query<{ tx_id: string; address: string }>(
      `SELECT DISTINCT ON (encode(a.tx_id, 'hex'))
              encode(a.tx_id, 'hex') AS tx_id,
              ad.address
         FROM packed.address_tx a
         JOIN packed.addr ad ON ad.id = a.addr_id
        WHERE a.tx_id = ANY($1::bytea[])
          AND ad.address LIKE '9%'
          AND length(ad.address) BETWEEN 50 AND 60
        ORDER BY encode(a.tx_id, 'hex'), length(ad.address), ad.address`,
      [ids.map((id) => Buffer.from(id, "hex"))]
    );
    await client.query("COMMIT");
    for (const row of r.rows) out.set(row.tx_id, row.address);
    return out;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.warn(JSON.stringify({ type: "lp_backfill_trader_skip", err: String(e) }));
    return out;
  } finally {
    client.release();
  }
}

export function wholeTokens(raw: bigint, decimals: number): number {
  const dec = Math.max(0, Math.min(18, Math.trunc(decimals) || 0));
  if (dec === 0) return Number(raw);
  const base = 10n ** BigInt(dec);
  return Number(raw / base) + Number(raw % base) / Number(base);
}

export function ergFromNano(nano: bigint): number {
  const base = 1000000000n;
  return Number(nano / base) + Number(nano % base) / 1e9;
}

function big(v: string | null): bigint {
  const s = String(v ?? "0").split(".")[0]?.replace(/^\+/, "") || "0";
  return /^-?\d+$/.test(s) ? BigInt(s) : 0n;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
