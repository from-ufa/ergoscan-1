import {
  LITHOS_DEX_VENUE,
  SNAP_MARKET_KEY,
  ergoTokenDecimals,
  isAgeUsdBankNft,
  lithosPendingFromRegs,
  n2tTvlErg,
  t2tTvlErg,
  parseMarketSnap,
  pickErgUsd,
  sqlNotAgeUsdBankPool,
} from "@ergoscan/shared";
import type { Db } from "./db.js";
import { absorbPoolBox, poolNeedsNftTvl, type PoolBox, type PoolBoxRow } from "./ranks-tvl.js";
import { T2T_VENUE } from "./t2t-registry.js";

const HEX64 = /^[0-9a-f]{64}$/;
const ERG_ZERO = "0".repeat(64);
const MAX_TRADE_ERG = Number(process.env.RANKS_MAX_TRADE_ERG || 3_000);
const BOARD = 24;
const UNIVERSE_N = 80;
const TVL_CHUNK = Math.max(8, Number(process.env.RANKS_TVL_CHUNK || 40) || 40);
const NFT_TVL_CHUNK = Math.max(4, Math.min(TVL_CHUNK, 8));
const TVL_TIMEOUT_MS = Math.max(
  500,
  Number(process.env.RANKS_TVL_TIMEOUT_MS || 4_000) || 4_000
);
const LAST_SWAP_TVL_TIMEOUT_MS = Math.max(TVL_TIMEOUT_MS, 8_000);
const POOL_TICK_KEEP_MS = 14 * 24 * 3600 * 1000;

type Heat = {
  tokenId: string;
  symbol: string;
  name: string;
  poolId?: string;
  volumeErg: number;
  tvlErg: number;
  priceErg: number;
  volumeUsd: number;
  tvlUsd: number;
  turnover: number;
  priceUsd?: number;
};

type PoolAcc = {
  symbol: string;
  poolId: string;
  tokenId: string;
  baseId: string | null;
  venue: string;
  decimals: number | null;
  baseDecimals: number | null;
  priceErg: number;
  tvlErg: number;
  volumeErg: number;
};

type TokAcc = {
  symbol: string;
  poolId: string;
  priceErg: number;
  tvlErg: number;
  volumeErg: number;
  leadVol: number;
};

type PoolBoxAsk = {
  poolId: string;
  tokenId: string;
  baseId?: string | null;
  prevTvl: number;
  volumeErg: number;
  allowZeroNano: boolean;
  /** Load the unspent NFT box even before the first fill. */
  forceNft?: boolean;
};

function tvlArgs(chunk: PoolBoxAsk[]): [string[], string[], string[]] {
  return [
    chunk.map((p) => p.poolId),
    chunk.map((p) => p.tokenId),
    chunk.map((p) => {
      const b = String(p.baseId || "").toLowerCase();
      return HEX64.test(b) && b !== ERG_ZERO ? b : "";
    }),
  ];
}

/**
 * Unspent pool box + quote/base amounts + registers.
 * Last-fill tx first (creation_tx_id). NFT walk only for active misses.
 * Own connections so a timeout cannot abort the ranks write txn.
 * Leftover pool NFT in a P2PK wallet is not TVL — mark withdrawn.
 */
const TVL_BOX_SQL = `
               b.value_nano::text,
               b.additional_registers,
               b.ergo_tree,
               b.address,
               (SELECT count(*)::int FROM packed.box_assets x WHERE x.box_id = b.box_id) AS n_assets,
               y.amount::text AS quote_raw,
               z.amount::text AS base_raw`;

function takeTvlBox(
  best: Map<string, PoolBox>,
  withdrawn: Set<string>,
  row: PoolBoxRow,
  allowZeroNano: boolean
): void {
  const nft = String(row.pool_id || "").toLowerCase();
  const kind = absorbPoolBox(best, row, allowZeroNano);
  if (kind === "wallet" && HEX64.test(nft)) withdrawn.add(nft);
}

async function loadPoolBoxes(
  db: Db,
  pools: PoolBoxAsk[]
): Promise<{ boxes: Map<string, PoolBox>; withdrawn: Set<string> }> {
  const best = new Map<string, PoolBox>();
  const withdrawn = new Set<string>();
  if (!pools.length) return { boxes: best, withdrawn };
  const byId = new Map(pools.map((p) => [p.poolId, p]));
  const hadLastSwap = new Set<string>();
  const client = await db.connect();
  try {
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL statement_timeout = ${LAST_SWAP_TVL_TIMEOUT_MS}`);
      const last = await client.query<PoolBoxRow>(
        `
        WITH last AS (
          SELECT DISTINCT ON (s.pool_id)
                 lower(s.pool_id) AS pool_id,
                 s.tx_id
          FROM defi.swaps s
          WHERE s.pool_id = ANY($1::text[])
          ORDER BY s.pool_id, s.height DESC NULLS LAST, s.ts_ms DESC NULLS LAST
        )
        SELECT last.pool_id,
               ${TVL_BOX_SQL}
        FROM last
        JOIN unnest($1::text[], $2::text[], $3::text[]) AS q(pool_id, quote_token, base_token)
          ON q.pool_id = last.pool_id
        LEFT JOIN LATERAL (
          SELECT bx.box_id, bx.value_nano, bx.additional_registers,
                 sc.ergo_tree, ad.address
          FROM packed.boxes bx
          JOIN packed.box_assets nft
            ON nft.box_id = bx.box_id
           AND nft.token_id = packed.hex32(last.pool_id)
           AND nft.amount = 1
          LEFT JOIN packed.addr ad ON ad.id = bx.addr_id
          LEFT JOIN packed.script sc ON sc.id = bx.script_id
          WHERE bx.creation_tx_id = packed.hex32(last.tx_id)
            AND bx.spent_tx_id IS NULL
          LIMIT 1
        ) b ON true
        LEFT JOIN packed.box_assets y
          ON y.box_id = b.box_id AND y.token_id = packed.hex32(q.quote_token)
        LEFT JOIN packed.box_assets z
          ON z.box_id = b.box_id
         AND length(q.base_token) = 64
         AND q.base_token <> repeat('0', 64)
         AND z.token_id = packed.hex32(q.base_token)
        `,
        tvlArgs(pools)
      );
      await client.query("COMMIT");
      for (const row of last.rows) {
        const nft = String(row.pool_id || "").toLowerCase();
        if (HEX64.test(nft)) hadLastSwap.add(nft);
        const ask = byId.get(nft);
        takeTvlBox(best, withdrawn, row, ask?.allowZeroNano ?? false);
      }
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      console.warn(JSON.stringify({ type: "tvl_last_swap_skip", err: String(e) }));
    }

    const missing = pools.filter(
      (p) =>
        !withdrawn.has(p.poolId) &&
        (p.forceNft ||
          poolNeedsNftTvl({
            hadBox: best.has(p.poolId),
            hadLastSwap: hadLastSwap.has(p.poolId),
            prevTvl: p.prevTvl,
            volumeErg: p.volumeErg,
          }))
    );
    for (let i = 0; i < missing.length; i += NFT_TVL_CHUNK) {
      const chunk = missing.slice(i, i + NFT_TVL_CHUNK);
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL statement_timeout = ${TVL_TIMEOUT_MS}`);
        const tvl = await client.query<PoolBoxRow>(
          `
          SELECT lower(q.pool_id) AS pool_id,
                 ${TVL_BOX_SQL}
          FROM unnest($1::text[], $2::text[], $3::text[]) AS q(pool_id, quote_token, base_token)
          JOIN LATERAL (
            SELECT bx.box_id, bx.value_nano, bx.additional_registers,
                   sc.ergo_tree, ad.address
            FROM packed.box_assets ba
            JOIN packed.boxes bx ON bx.box_id = ba.box_id AND bx.spent_tx_id IS NULL
            LEFT JOIN packed.addr ad ON ad.id = bx.addr_id
            LEFT JOIN packed.script sc ON sc.id = bx.script_id
            WHERE ba.token_id = packed.hex32(q.pool_id) AND ba.amount = 1
            ORDER BY bx.creation_height DESC NULLS LAST
            LIMIT 1
          ) b ON true
          LEFT JOIN packed.box_assets y
            ON y.box_id = b.box_id AND y.token_id = packed.hex32(q.quote_token)
          LEFT JOIN packed.box_assets z
            ON z.box_id = b.box_id
           AND length(q.base_token) = 64
           AND q.base_token <> repeat('0', 64)
           AND z.token_id = packed.hex32(q.base_token)
          `,
          tvlArgs(chunk)
        );
        await client.query("COMMIT");
        for (const row of tvl.rows) {
          const ask = byId.get(String(row.pool_id || "").toLowerCase());
          takeTvlBox(best, withdrawn, row, ask?.allowZeroNano ?? false);
        }
      } catch (e) {
        try {
          await client.query("ROLLBACK");
        } catch {
          /* ignore */
        }
        console.warn(
          JSON.stringify({ type: "tvl_chunk_skip", i, err: String(e) })
        );
      }
    }
  } finally {
    client.release();
  }
  return { boxes: best, withdrawn };
}

/**
 * Milestone 1 ranks: registry + Stage unspent pool TVL + trades 24h.
 * One snap / tick per pool. Heat and price_tick stay Spectrum — Lithos LIT
 * is not mixed into /defi. No Spectrum/Crux HTTP as truth.
 */
export async function materializeRanks(db: Db): Promise<{ heat: number; pools: number }> {
  const ergUsd = await ergUsdPrice(db);

  const regs = await db.query<{
    pool_id: string;
    quote_token: string;
    base_token: string | null;
    venue: string | null;
    symbol: string | null;
    decimals: number | null;
    base_decimals: number | null;
    snap_symbol: string | null;
    snap_price: string | null;
    snap_tvl: string | null;
    token_name: string | null;
  }>(`
    SELECT r.pool_id, r.quote_token, r.base_token, r.venue, r.symbol, r.decimals,
           btok.decimals AS base_decimals,
           ps.symbol AS snap_symbol, ps.price_erg::text AS snap_price,
           ps.tvl_erg::text AS snap_tvl,
           tok.name AS token_name
    FROM defi.pool_registry r
    LEFT JOIN defi.pool_snap ps ON ps.pool_id = r.pool_id
    LEFT JOIN tokens tok ON tok.token_id = r.quote_token
    LEFT JOIN tokens btok ON btok.token_id = r.base_token
    WHERE r.venue IN ('spectrum_cfmm', 'spectrum_n2n', 'lithos_dex')
  `);

  const byPool = new Map<string, PoolAcc>();

  for (const row of regs.rows) {
    const tid = row.quote_token.toLowerCase();
    const nft = row.pool_id.toLowerCase();
    if (!HEX64.test(tid) || !HEX64.test(nft) || isAgeUsdBankNft(nft)) continue;
    const pe = num(row.snap_price);
    const raw = (row.symbol || row.snap_symbol || "").trim();
    const fromTok = (row.token_name || "").trim();
    const sym =
      (raw && raw !== "?" && !/^[0-9a-f]{1,8}$/i.test(raw) ? raw : "") ||
      fromTok ||
      "?";
    const bid = String(row.base_token || "").toLowerCase();
    const baseOk = HEX64.test(bid) && bid !== ERG_ZERO;
    const decRaw = row.decimals != null ? Number(row.decimals) : NaN;
    const known = ergoTokenDecimals(tid);
    const baseDecRaw = row.base_decimals != null ? Number(row.base_decimals) : NaN;
    const baseKnown = baseOk ? ergoTokenDecimals(bid) : null;
    byPool.set(nft, {
      symbol: sym,
      poolId: nft,
      tokenId: tid,
      baseId: baseOk ? bid : null,
      venue: (row.venue || "spectrum_cfmm").trim() || "spectrum_cfmm",
      decimals: Number.isFinite(decRaw)
        ? decRaw
        : known != null
          ? known
          : null,
      baseDecimals: Number.isFinite(baseDecRaw)
        ? baseDecRaw
        : baseKnown != null
          ? baseKnown
          : null,
      priceErg: pe > 0 ? pe : 0,
      tvlErg: num(row.snap_tvl) > 0 ? num(row.snap_tvl) : 0,
      volumeErg: 0,
    });
  }

  const since = Date.now() - 24 * 60 * 60 * 1000;
  const vols = await db.query<{
    pool_id: string;
    vol_erg: number;
  }>(
    `SELECT pool_id,
            COALESCE(SUM(base_amount), 0)::float8 AS vol_erg
     FROM defi.trades
     WHERE ts_ms >= $1
       AND pool_id IS NOT NULL
       AND length(pool_id) = 64
       AND base_amount IS NOT NULL
       AND base_amount > 0
       AND base_amount <= $2
       AND COALESCE(token_amount, 0) > 0
       AND ${sqlNotAgeUsdBankPool("pool_id")}
       AND (base_id IS NULL OR base_id = repeat('0', 64))
     GROUP BY pool_id`,
    [since, MAX_TRADE_ERG]
  );
  for (const row of vols.rows) {
    const pid = String(row.pool_id || "").toLowerCase();
    if (!HEX64.test(pid)) continue;
    const acc = byPool.get(pid);
    if (!acc) continue;
    const vol = num(row.vol_erg);
    acc.volumeErg = vol > 0 && vol < 1e9 ? vol : 0;
  }

  const lastPx = await db.query<{
    pool_id: string;
    last_px: number | null;
  }>(
    `SELECT DISTINCT ON (pool_id)
            pool_id,
            price::float8 AS last_px
     FROM defi.trades
     WHERE ts_ms >= $1
       AND pool_id IS NOT NULL
       AND length(pool_id) = 64
       AND price IS NOT NULL
       AND price > 0
       AND price < 1e12
       AND base_amount IS NOT NULL
       AND base_amount > 0
       AND base_amount <= $2
       AND COALESCE(token_amount, 0) > 0
       AND ${sqlNotAgeUsdBankPool("pool_id")}
       AND (base_id IS NULL OR base_id = repeat('0', 64))
     ORDER BY pool_id, ts_ms DESC`,
    [since, MAX_TRADE_ERG]
  );
  for (const row of lastPx.rows) {
    const pid = String(row.pool_id || "").toLowerCase();
    const acc = byPool.get(pid);
    if (!acc) continue;
    const pe = num(row.last_px);
    if (pe > 0 && pe < 1e12) acc.priceErg = pe;
  }

  const n2tAsks = [...byPool.values()]
    .filter((p) => p.venue !== T2T_VENUE)
    .map((p) => ({
      poolId: p.poolId,
      tokenId: p.tokenId,
      baseId: p.baseId,
      prevTvl: p.tvlErg,
      volumeErg: p.volumeErg,
      allowZeroNano: false,
      forceNft: p.venue === LITHOS_DEX_VENUE,
    }));
  const t2tAsks = [...byPool.values()]
    .filter((p) => p.venue === T2T_VENUE)
    .map((p) => ({
      poolId: p.poolId,
      tokenId: p.tokenId,
      baseId: p.baseId,
      prevTvl: p.tvlErg,
      volumeErg: p.volumeErg,
      allowZeroNano: true,
    }));
  const n2tLoad = await loadPoolBoxes(db, n2tAsks);
  const n2tBoxes = n2tLoad.boxes;
  const n2tPx = new Map<string, { px: number; vol: number }>();
  for (const acc of byPool.values()) {
    if (acc.venue === T2T_VENUE) continue;
    if (n2tLoad.withdrawn.has(acc.poolId)) {
      acc.tvlErg = 0;
      continue;
    }
    const box = n2tBoxes.get(acc.poolId);
    if (!box) continue;
    let pendingX: string | number | bigint = 0;
    let pendingY: string | number | bigint = 0;
    if (acc.venue === LITHOS_DEX_VENUE) {
      const pending = lithosPendingFromRegs(box.regs);
      if (pending) {
        pendingX = pending.pendingX;
        pendingY = pending.pendingY;
      }
    }
    const parts = n2tTvlErg({
      valueNano: box.valueNano,
      pendingXNano: pendingX,
      pendingY,
      quoteRaw: box.quoteRaw,
      quoteDecimals: acc.decimals,
      priceErg: acc.priceErg > 0 ? acc.priceErg : null,
    });
    acc.tvlErg = parts.tvlErg;
    if (acc.priceErg > 0) {
      const prev = n2tPx.get(acc.tokenId);
      if (!prev || acc.volumeErg > prev.vol) {
        n2tPx.set(acc.tokenId, { px: acc.priceErg, vol: acc.volumeErg });
      }
    }
  }

  const t2tLoad = await loadPoolBoxes(db, t2tAsks);
  const t2tBoxes = t2tLoad.boxes;
  for (const acc of byPool.values()) {
    if (acc.venue !== T2T_VENUE) continue;
    if (t2tLoad.withdrawn.has(acc.poolId)) {
      acc.tvlErg = 0;
      continue;
    }
    const box = t2tBoxes.get(acc.poolId);
    if (!box) continue;
    const t = t2tTvlErg({
      amountA: box.quoteRaw,
      decimalsA: acc.decimals,
      priceErgA: n2tPx.get(acc.tokenId)?.px ?? null,
      amountB: box.baseRaw,
      decimalsB: acc.baseDecimals,
      priceErgB: acc.baseId ? n2tPx.get(acc.baseId)?.px ?? null : null,
    });
    acc.tvlErg = t.tvlErg;
  }

  const byTok = new Map<string, TokAcc>();
  for (const acc of byPool.values()) {
    if (acc.venue === LITHOS_DEX_VENUE || acc.venue === T2T_VENUE) continue;
    let tok = byTok.get(acc.tokenId);
    if (!tok) {
      tok = {
        symbol: acc.symbol,
        poolId: acc.poolId,
        priceErg: 0,
        tvlErg: 0,
        volumeErg: 0,
        leadVol: -1,
      };
      byTok.set(acc.tokenId, tok);
    }
    tok.tvlErg += acc.tvlErg;
    tok.volumeErg += acc.volumeErg;
    if (acc.symbol && acc.symbol !== "?" && tok.symbol === "?") tok.symbol = acc.symbol;
    if (acc.priceErg > 0 && acc.volumeErg >= tok.leadVol) {
      tok.priceErg = acc.priceErg;
      tok.poolId = acc.poolId;
      tok.leadVol = acc.volumeErg;
    } else if (!(tok.priceErg > 0) && acc.priceErg > 0) {
      tok.priceErg = acc.priceErg;
      tok.poolId = acc.poolId;
    }
  }

  const heat: Heat[] = [];
  for (const [tid, acc] of byTok) {
    if (acc.tvlErg < 0.05 && acc.volumeErg < 0.001) continue;
    const tvlErg = acc.tvlErg;
    let volumeErg = acc.volumeErg;
    if (volumeErg > 5_000_000) volumeErg = 0;
    const priceErg = acc.priceErg > 0 ? acc.priceErg : 0;
    heat.push({
      tokenId: tid,
      symbol: acc.symbol || "?",
      name: acc.symbol || "?",
      poolId: acc.poolId || undefined,
      volumeErg,
      tvlErg,
      priceErg,
      volumeUsd: volumeErg * ergUsd,
      tvlUsd: tvlErg * ergUsd,
      turnover: tvlErg > 0 ? volumeErg / tvlErg : volumeErg > 0 ? 1 : 0,
      priceUsd: priceErg > 0 ? priceErg * ergUsd : undefined,
    });
  }

  const slim = (h: Heat) => ({
    tokenId: h.tokenId,
    symbol: h.symbol,
    name: h.name,
    volumeErg: h.volumeErg,
    tvlErg: h.tvlErg,
    volumeUsd: h.volumeUsd,
    tvlUsd: h.tvlUsd,
    turnover: h.turnover,
    priceErg: h.priceErg > 0 ? h.priceErg : undefined,
    priceUsd: h.priceUsd,
  });

  const byVol = [...heat].sort((a, b) => b.volumeErg - a.volumeErg);
  const byTvl = [...heat].sort((a, b) => b.tvlErg - a.tvlErg);
  const byTurn = [...heat].sort((a, b) => b.turnover - a.turnover);
  const flow = byVol.slice(0, BOARD).map(slim);
  const depth = byTvl.slice(0, BOARD).map(slim);
  const swing = byTurn.slice(0, BOARD).map(slim);
  const universe = byTvl.slice(0, UNIVERSE_N).map(slim);
  const leader = flow[0];
  const now = Date.now();
  const payload = {
    ok: true,
    updatedAt: now,
    ergUsd,
    poolCount: byPool.size,
    heatCount: heat.length,
    tokenCount: heat.length,
    flow,
    traded: flow,
    depth,
    swing,
    gainers: [] as ReturnType<typeof slim>[],
    losers: [] as ReturnType<typeof slim>[],
    universe,
    pulse: {
      headline: leader
        ? `${leader.symbol} owns the session`
        : "ErgoScan DeFi",
      volUsd: flow.reduce((s, t) => s + (t.volumeUsd || 0), 0),
      hotCount: flow.filter((t) => t.volumeErg > 1 || t.turnover > 0.02).length,
      leader: leader || null,
    },
    source: "projector",
    universeNote:
      "index TVL per pool (N2T ERG+token at last fill; T2T both reserves at N2T ERG prices; Lithos minus pending) + Spectrum defi.trades 24h on heat; no Spectrum HTTP as truth",
    changeNote: "Δ% later — projector v1",
    at: now,
  };

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = 20000`);

    let poolWrites = 0;
    for (const acc of byPool.values()) {
      if (!acc.poolId || !HEX64.test(acc.poolId)) continue;
      await client.query(
        `INSERT INTO defi.pool_snap (pool_id, token_id, symbol, tvl_erg, volume_erg_24h, price_erg, updated_at_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (pool_id) DO UPDATE SET
           token_id = EXCLUDED.token_id,
           symbol = COALESCE(NULLIF(EXCLUDED.symbol, '?'), defi.pool_snap.symbol),
           tvl_erg = EXCLUDED.tvl_erg,
           volume_erg_24h = EXCLUDED.volume_erg_24h,
           price_erg = COALESCE(EXCLUDED.price_erg, defi.pool_snap.price_erg),
           updated_at_ms = EXCLUDED.updated_at_ms`,
        [
          acc.poolId,
          acc.tokenId,
          acc.symbol,
          acc.tvlErg,
          acc.volumeErg,
          acc.priceErg > 0 ? acc.priceErg : null,
          now,
        ]
      );
      poolWrites += 1;
    }
    payload.poolCount = poolWrites;

    await client.query(
      `INSERT INTO defi.ranks_cache (id, payload_json, updated_at_ms, source)
       VALUES (1, $1::jsonb, $2, 'projector')
       ON CONFLICT (id) DO UPDATE SET
         payload_json = EXCLUDED.payload_json,
         updated_at_ms = EXCLUDED.updated_at_ms,
         source = EXCLUDED.source`,
      [JSON.stringify(payload), now]
    );

    const bucket = Math.floor(now / 60_000) * 60_000;
    const ids: string[] = [];
    const pes: (number | null)[] = [];
    const pus: (number | null)[] = [];
    const tes: (number | null)[] = [];
    for (const h of heat) {
      if (!(h.priceErg > 0) && !(h.tvlErg > 0.5)) continue;
      if (!HEX64.test(h.tokenId)) continue;
      ids.push(h.tokenId);
      pes.push(h.priceErg > 0 ? h.priceErg : null);
      pus.push(h.priceUsd && h.priceUsd > 0 ? h.priceUsd : null);
      tes.push(h.tvlErg > 0 ? h.tvlErg : null);
    }
    if (ids.length) {
      await client.query(
        `INSERT INTO defi.price_tick (token_id, ts_ms, price_erg, price_usd, tvl_erg)
         SELECT x.token_id, $2::bigint, x.price_erg, x.price_usd, x.tvl_erg
         FROM unnest($1::text[], $3::float8[], $4::float8[], $5::float8[])
           AS x(token_id, price_erg, price_usd, tvl_erg)
         ON CONFLICT (token_id, ts_ms) DO UPDATE SET
           price_erg = COALESCE(EXCLUDED.price_erg, defi.price_tick.price_erg),
           price_usd = COALESCE(EXCLUDED.price_usd, defi.price_tick.price_usd),
           tvl_erg = COALESCE(EXCLUDED.tvl_erg, defi.price_tick.tvl_erg)`,
        [ids, bucket, pes, pus, tes]
      );
      await client.query(`DELETE FROM defi.price_tick WHERE ts_ms < $1`, [
        now - POOL_TICK_KEEP_MS,
      ]);
    }

    const pids: string[] = [];
    const pTvl: (number | null)[] = [];
    const pVol: (number | null)[] = [];
    const pPx: (number | null)[] = [];
    for (const acc of byPool.values()) {
      if (!HEX64.test(acc.poolId)) continue;
      if (!(acc.tvlErg > 0.05) && !(acc.volumeErg > 0) && !(acc.priceErg > 0)) {
        continue;
      }
      pids.push(acc.poolId);
      pTvl.push(acc.tvlErg > 0 ? acc.tvlErg : null);
      pVol.push(acc.volumeErg > 0 ? acc.volumeErg : null);
      pPx.push(acc.priceErg > 0 ? acc.priceErg : null);
    }
    if (pids.length) {
      await client.query(
        `INSERT INTO defi.pool_tick (pool_id, ts_ms, tvl_erg, volume_erg_24h, price_erg)
         SELECT x.pool_id, $2::bigint, x.tvl_erg, x.volume_erg_24h, x.price_erg
         FROM unnest($1::text[], $3::float8[], $4::float8[], $5::float8[])
           AS x(pool_id, tvl_erg, volume_erg_24h, price_erg)
         ON CONFLICT (pool_id, ts_ms) DO UPDATE SET
           tvl_erg = COALESCE(EXCLUDED.tvl_erg, defi.pool_tick.tvl_erg),
           volume_erg_24h = COALESCE(EXCLUDED.volume_erg_24h, defi.pool_tick.volume_erg_24h),
           price_erg = COALESCE(EXCLUDED.price_erg, defi.pool_tick.price_erg)`,
        [pids, bucket, pTvl, pVol, pPx]
      );
      await client.query(`DELETE FROM defi.pool_tick WHERE ts_ms < $1`, [
        now - POOL_TICK_KEEP_MS,
      ]);
    }

    await client.query("COMMIT");
    return { heat: heat.length, pools: poolWrites };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.warn(JSON.stringify({ type: "ranks_skip", err: String(e) }));
    return { heat: 0, pools: 0 };
  } finally {
    client.release();
  }
}

async function ergUsdPrice(db: Db): Promise<number> {
  let market: number | null = null;
  let tick: number | null = null;
  try {
    const snap = await db.query<{ payload: unknown }>(
      `SELECT payload FROM snapshot_kv WHERE key = $1 LIMIT 1`,
      [SNAP_MARKET_KEY]
    );
    market = parseMarketSnap(snap.rows[0]?.payload)?.ergUsd ?? null;
  } catch {
    /* writer cold */
  }
  try {
    const r = await db.query<{ erg_usd: string | number }>(
      `SELECT erg_usd
         FROM market_cg_tick
        WHERE erg_usd IS NOT NULL AND erg_usd > 0
        ORDER BY ts_ms DESC
        LIMIT 1`
    );
    const usd = Number(r.rows[0]?.erg_usd);
    if (Number.isFinite(usd) && usd > 0) tick = usd;
  } catch {
    /* tick cold */
  }
  return pickErgUsd({ env: Number(process.env.ERG_USD || 0), market, tick });
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
