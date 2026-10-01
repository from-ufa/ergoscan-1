/**
 * GET /v1/oracles/:slug/buyback
 * slug = xau-erg (GORT) | erg-usd (DORT).
 * Reads the buyback NFT's boxes from the index. No node. No COUNT(*).
 */
import type { Express, Response } from "express";
import pg from "pg";
import { cacheTokens } from "../lib/httpCache.js";
import {
  BUYBACK,
  assembleBuyback,
  buybackBySlug,
  downsample,
  goldCover,
  refreshPay,
  type BuybackDef,
  type BuybackKind,
  type RawBox,
} from "../lib/buyback.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;
const mem = new Map<string, { at: number; body: unknown }>();
const MEM_MS = 20_000;

function getPool(): pg.Pool | null {
  const url =
    process.env.DATABASE_READ_URL ||
    process.env.DATABASE_URL ||
    process.env.INDEXER_DATABASE_URL ||
    "";
  if (!url) return null;
  if (!pool) {
    const withTimeout =
      url.includes("options=") || url.includes("statement_timeout")
        ? url
        : `${url}${url.includes("?") ? "&" : "?"}options=${encodeURIComponent("-c statement_timeout=4000")}`;
    pool = new Pool({
      connectionString: withTimeout,
      max: 2,
      connectionTimeoutMillis: 2500,
      idleTimeoutMillis: 20_000,
    });
    pool.on("error", () => {
      /* ignore */
    });
  }
  return pool;
}

async function q<T extends pg.QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[] | null> {
  const p = getPool();
  if (!p) return null;
  try {
    const r = await p.query<T>(sql, params);
    return r.rows;
  } catch {
    return null;
  }
}

function bi(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (v == null || v === "") return 0n;
  try {
    return BigInt(String(v));
  } catch {
    return 0n;
  }
}

function n(v: unknown): number | null {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function s(v: bigint): string {
  return v.toString();
}

const BOXES = `
  SELECT encode(b.box_id, 'hex') AS id,
         ba.amount::text AS nft,
         b.creation_height::text AS height,
         b.spent_height::text AS spent_height,
         encode(b.spent_tx_id, 'hex') AS spent_tx,
         encode(b.creation_tx_id, 'hex') AS creation_tx,
         b.value_nano::text AS erg,
         COALESCE(rw.amount, 0)::text AS reward
    FROM packed.box_assets ba
    JOIN packed.boxes b ON b.box_id = ba.box_id
    LEFT JOIN packed.box_assets rw
      ON rw.box_id = b.box_id AND rw.token_id = decode($2, 'hex')
   WHERE ba.token_id = decode($1, 'hex')
`;

const LIVE = `
  SELECT b.value_nano::text AS erg,
         COALESCE(rw.amount, 0)::text AS token
    FROM packed.box_assets ba
    JOIN packed.boxes b ON b.box_id = ba.box_id AND b.spent_tx_id IS NULL
    LEFT JOIN packed.box_assets rw
      ON rw.box_id = b.box_id AND rw.token_id = decode($2, 'hex')
   WHERE ba.token_id = decode($1, 'hex') AND ba.amount = 1
   LIMIT 1
`;

type BoxRow = {
  id: string;
  nft: string;
  height: string;
  spent_height: string | null;
  spent_tx: string | null;
  creation_tx: string | null;
  erg: string;
  reward: string;
};

function rowsOf(raw: BoxRow[]): RawBox[] {
  const out: RawBox[] = [];
  for (const r of raw) {
    const height = n(r.height);
    if (!r.id || height == null || !r.creation_tx) continue;
    out.push({
      id: r.id,
      nft: bi(r.nft),
      height,
      spentHeight: n(r.spent_height),
      spentTx: r.spent_tx,
      creationTx: r.creation_tx,
      erg: bi(r.erg),
      reward: bi(r.reward),
    });
  }
  return out;
}

async function build(def: BuybackDef) {
  const boxesP = q<BoxRow>(BOXES, [def.nftId, def.tokenId]);
  const lpP = q<{ erg: string; token: string }>(LIVE, [def.lpNft, def.tokenId]);
  const poolP = q<{
    creation_height: number | null;
    quote: number | null;
    epoch: number | null;
    live_operators: number | null;
    oracle_token: string | null;
    r4_nano: string | null;
  }>(
    `SELECT creation_height, quote, epoch, live_operators, oracle_token, r4_nano
       FROM oracle.pool_snap WHERE slug = $1`,
    [def.slug]
  );
  const tipP = q<{ value: string }>(
    `SELECT value FROM oracle.worker_state WHERE key = 'scan_height'`
  );
  const datapointsP = q<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM oracle.pool_snap s
       JOIN packed.boxes c ON c.box_id = packed.hex32(s.box_id)
       JOIN packed.boxes i ON i.spent_tx_id = c.creation_tx_id
       JOIN packed.box_assets oa
         ON oa.box_id = i.box_id AND oa.token_id = decode(s.oracle_token, 'hex')
      WHERE s.slug = $1`,
    [def.slug]
  );
  const bankP =
    def.bankNft && def.bankToken
      ? q<{ erg: string; token: string }>(LIVE, [def.bankNft, def.bankToken])
      : Promise.resolve([] as { erg: string; token: string }[] | null);
  const emP = def.emissionNft
    ? q<{ height: string; amount: string }>(
        `SELECT b.creation_height::text AS height, COALESCE(rw.amount, 0)::text AS amount
           FROM packed.box_assets ba
           JOIN packed.boxes b ON b.box_id = ba.box_id AND b.spent_tx_id IS NULL
           LEFT JOIN packed.box_assets rw
             ON rw.box_id = b.box_id AND rw.token_id = decode($2, 'hex')
          WHERE ba.token_id = decode($1, 'hex') AND ba.amount = 1
          LIMIT 1`,
        [def.emissionNft, def.tokenId]
      )
    : Promise.resolve([] as { height: string; amount: string }[] | null);

  const [boxes, lpRows, poolRows, tipRows, bankRows, emRows, datapointRows] = await Promise.all([
    boxesP,
    lpP,
    poolP,
    tipP,
    bankP,
    emP,
    datapointsP,
  ]);
  if (!boxes) return null;

  const assembled = assembleBuyback(rowsOf(boxes));
  const swapTx = assembled.moves.filter((m) => m.kind === "swap").map((m) => m.tx);
  const heights = [...new Set(assembled.moves.map((m) => m.height))];

  const who = new Map<string, string>();
  if (swapTx.length) {
    const callers = await q<{ tx: string; address: string }>(
      `SELECT DISTINCT ON (b.spent_tx_id)
              encode(b.spent_tx_id, 'hex') AS tx,
              a.address
         FROM packed.boxes b
         JOIN packed.addr a ON a.id = b.addr_id
        WHERE b.spent_tx_id = ANY($1::bytea[])
          AND NOT EXISTS (
            SELECT 1 FROM packed.box_assets x
             WHERE x.box_id = b.box_id
               AND x.token_id IN (decode($2, 'hex'), decode($3, 'hex'))
          )
        ORDER BY b.spent_tx_id, b.value_nano DESC`,
      [swapTx.map((id) => Buffer.from(id, "hex")), def.nftId, def.lpNft]
    );
    for (const row of callers ?? []) {
      if (row.tx && row.address) who.set(row.tx, row.address);
    }
  }

  const when = new Map<number, { ts: number; blockId: string }>();
  if (heights.length) {
    const stamps = await q<{ height: string; id: string; ts: string }>(
      `SELECT height::text AS height, encode(id, 'hex') AS id, timestamp_ms::text AS ts
         FROM packed.blocks WHERE height = ANY($1::bigint[])`,
      [heights]
    );
    for (const row of stamps ?? []) {
      const h = n(row.height);
      const ts = n(row.ts);
      if (h != null && ts != null && row.id) when.set(h, { ts, blockId: row.id });
    }
  }

  const lp = lpRows?.[0] ?? null;
  const lpErg = lp ? bi(lp.erg) : 0n;
  const lpToken = lp ? bi(lp.token) : 0n;
  const pool = poolRows?.[0] ?? null;
  const liveOps = pool?.live_operators ?? 0;
  const pay = refreshPay(n(datapointRows?.[0]?.n) ?? 0);
  const live = assembled.live;
  const script = def.scriptOracleToken.toLowerCase();
  const posted = (pool?.oracle_token ?? "").toLowerCase();
  const returns = assembled.moves.reduce((n0, m) => n0 + (m.kind === "return" ? 1 : 0), 0);
  const giveback = returns > 0 ? "used" : posted && posted === script ? "idle" : "blocked";

  let ergIn = 0n;
  let ergOut = 0n;
  let bought = 0n;
  let sent = 0n;
  let topups = 0;
  let swaps = 0;
  let opens = 0;
  let lastTop: (typeof assembled.moves)[number] | null = null;
  let lastSwap: (typeof assembled.moves)[number] | null = null;
  const signers = new Map<string, number>();
  for (const m of assembled.moves) {
    if (m.derg > 0n) ergIn += m.derg;
    else ergOut += -m.derg;
    if (m.dtok > 0n) bought += m.dtok;
    else sent += -m.dtok;
    if (m.kind === "topup") {
      topups += 1;
      lastTop = m;
    } else if (m.kind === "swap") {
      swaps += 1;
      lastSwap = m;
      const addr = who.get(m.tx);
      if (addr) signers.set(addr, (signers.get(addr) ?? 0) + 1);
    } else if (m.kind === "open") opens += 1;
  }

  let topSigner: { address: string; swaps: number } | null = null;
  for (const [address, count] of signers) {
    if (!topSigner || count > topSigner.swaps) topSigner = { address, swaps: count };
  }

  const canBuy =
    live && lpToken > 0n && lpErg > 0n ? (live.erg * lpToken) / lpErg : null;
  const cover =
    pay && live && pay > 0 ? Number(live.reward / BigInt(pay)) : null;

  let bank: { erg: string; ratioBps: number; payoutOpen: boolean } | null = null;
  const bankRow = bankRows?.[0];
  if (bankRow && pool?.r4_nano) {
    const coverRow = goldCover(bi(bankRow.erg), bi(bankRow.token), bi(pool.r4_nano));
    if (coverRow) {
      bank = { erg: s(bi(bankRow.erg)), ...coverRow };
    }
  }

  const em = emRows?.[0];
  const emission =
    em && n(em.height) != null
      ? { amount: s(bi(em.amount)), height: n(em.height) as number }
      : null;

  const series = downsample(assembled.moves, 180).flatMap((m) => {
    const stamp = when.get(m.height);
    if (!stamp) return [];
    return [
      {
        t: stamp.ts,
        erg: Number(m.erg) / 1e9,
        token: Number(m.token),
      },
    ];
  });

  const moves = assembled.moves
    .slice()
    .reverse()
    .map((m) => {
      const stamp = when.get(m.height);
      return {
        height: m.height,
        ts: stamp?.ts ?? null,
        blockId: stamp?.blockId ?? null,
        kind: m.kind,
        derg: s(m.derg),
        dtok: s(m.dtok),
        erg: s(m.erg),
        token: s(m.token),
        tx: m.tx,
        who: who.get(m.tx) ?? null,
      };
    });

  const stampOf = (m: (typeof assembled.moves)[number] | null) =>
    m ? { height: m.height, ts: when.get(m.height)?.ts ?? null } : null;

  return {
    ready: true,
    source: "lumen-index" as const,
    kind: def.kind satisfies BuybackKind,
    symbol: def.symbol,
    slug: def.slug,
    tokenId: def.tokenId,
    nftId: def.nftId,
    scriptOracleToken: def.scriptOracleToken,
    box: live
      ? { id: live.id, height: live.height, erg: s(live.erg), token: s(live.reward) }
      : null,
    lp:
      lp && lpToken > 0n
        ? { erg: s(lpErg), token: s(lpToken), priceNano: s(lpErg / lpToken) }
        : null,
    pool: {
      height: pool?.creation_height ?? null,
      live: liveOps,
      epoch: pool?.epoch ?? null,
      oracleToken: pool?.oracle_token ?? null,
      quote: pool?.quote ?? null,
    },
    giveback,
    spare: s(assembled.spare),
    tipHeight: n(tipRows?.[0]?.value),
    totals: {
      topups,
      swaps,
      returns,
      opens,
      ergIn: s(ergIn),
      ergOut: s(ergOut),
      bought: s(bought),
      sent: s(sent),
    },
    lastTopup: stampOf(lastTop),
    lastSwap: stampOf(lastSwap),
    canBuy: canBuy == null ? null : s(canBuy),
    epochPay: pay,
    coverRefreshes: cover,
    bank,
    emission,
    topSigner,
    series,
    moves,
  };
}

function empty(kind: BuybackKind) {
  const def = BUYBACK[kind];
  return {
    ready: false,
    source: "lumen-index" as const,
    kind,
    symbol: def.symbol,
    slug: def.slug,
    tokenId: def.tokenId,
    nftId: def.nftId,
    scriptOracleToken: def.scriptOracleToken,
    box: null,
    lp: null,
    pool: { height: null, live: 0, epoch: null, oracleToken: null, quote: null },
    giveback: "blocked" as const,
    spare: "0",
    tipHeight: null,
    totals: {
      topups: 0,
      swaps: 0,
      returns: 0,
      opens: 0,
      ergIn: "0",
      ergOut: "0",
      bought: "0",
      sent: "0",
    },
    lastTopup: null,
    lastSwap: null,
    canBuy: null,
    epochPay: null,
    coverRefreshes: null,
    bank: null,
    emission: null,
    topSigner: null,
    series: [],
    moves: [],
  };
}

async function handle(slug: string, res: Response) {
  const def = buybackBySlug(slug);
  if (!def) {
    res.status(404).json({ error: "unknown_oracle_feed" });
    return;
  }
  const hit = mem.get(def.kind);
  if (hit && Date.now() - hit.at < MEM_MS) {
    cacheTokens(res);
    res.json(hit.body);
    return;
  }
  const body = await build(def);
  if (!body) {
    res.status(503).json(empty(def.kind));
    return;
  }
  mem.set(def.kind, { at: Date.now(), body });
  cacheTokens(res);
  res.json(body);
}

export function registerBuybackRoutes(app: Express): void {
  for (const base of ["/v1/oracles", "/api/v1/oracles"]) {
    app.get(`${base}/:slug/buyback`, (req, res) => {
      void handle(String(req.params.slug ?? ""), res);
    });
  }
}
