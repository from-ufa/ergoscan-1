import { ORACLE_FEEDS, oracleCurrentRound, oracleSeatLive, type OracleFeedSlug } from "@ergoscan/shared";
import type { Queryable } from "./db.js";
import { setState } from "./db.js";
import type { DetectedBox, DetectedFeed, MarketSnap, OracleCensus } from "./detect.js";
import { enrichOperators } from "./detect.js";

export const TICK_KEEP = 4_000;

/**
 * Partial holders must not wipe silent seats. Both censuses keep unspent
 * snaps and only mark unseen rows silent. Spent boxes drop via PK.
 */
export function operatorSnapGc(_census: OracleCensus): "stale-live" {
  return "stale-live";
}

export function shouldWriteTick(quote: number | null): quote is number {
  return quote != null && Number.isFinite(quote) && quote > 0;
}

/** USD feeds overlay CG ERG/USD. Gold overlays implied XAU/ERG. */
export function overlayMarketQuote(
  slug: OracleFeedSlug,
  market: MarketSnap
): number | null {
  const raw = slug === "xau-erg" ? market.xauPerErg : market.ergUsd;
  return raw != null && Number.isFinite(raw) && raw > 0 ? raw : null;
}

export function tickIdsToDrop(newestFirst: string[], keep: number): string[] {
  if (keep <= 0) return [...newestFirst];
  return newestFirst.slice(keep);
}

export async function persistFeed(
  db: Queryable,
  found: DetectedFeed,
  market: MarketSnap,
  scanHeight: number,
  keep = TICK_KEEP
): Promise<{ ticks: number }> {
  const def = ORACLE_FEEDS[found.slug];
  const pool = found.pool;
  const extra = await enrichOperators(db, found.operators, def);
  let poolEpoch = pool?.epoch ?? null;
  let poolHeight = pool?.height ?? null;
  if (!pool) {
    const prev = await db.query<{
      epoch: number | null;
      creation_height: string | number | null;
    }>(
      `SELECT epoch, creation_height FROM oracle.pool_snap WHERE slug = $1 LIMIT 1`,
      [found.slug]
    );
    const row = prev.rows[0];
    if (row) {
      if (poolEpoch == null && row.epoch != null) {
        const n = Number(row.epoch);
        if (Number.isFinite(n)) poolEpoch = n;
      }
      if (poolHeight == null && row.creation_height != null) {
        const n = Number(row.creation_height);
        if (Number.isFinite(n)) poolHeight = n;
      }
    }
  }
  const currentRound = oracleCurrentRound(found.operators, poolEpoch);
  const liveOf = (op: DetectedBox) =>
    oracleSeatLive(op.round, currentRound, {
      opEpoch: op.epoch,
      poolEpoch,
      opHeight: op.height,
      poolHeight,
      epochLength: def.epochLength,
    });
  const live = found.operators.filter((o) => liveOf(o) === true).length;
  const overlay = overlayMarketQuote(found.slug, market);
  const usdMarket = def.quote === "usd";
  const prevQuotes =
    found.operators.length === 0
      ? []
      : (
          await db.query<{ address: string; quote: number }>(
            `SELECT address, quote FROM oracle.operator_snap
              WHERE slug = $1 AND address IS NOT NULL AND quote IS NOT NULL`,
            [found.slug]
          )
        ).rows;
  const quoteByAddr = new Map(prevQuotes.map((r) => [r.address, Number(r.quote)]));

  await db.query(
    `INSERT INTO oracle.pool_snap (
       slug, pair, pool_nft, oracle_token, box_id, creation_height, ts_ms,
       quote, r4_nano, epoch, value_nano, live_operators, issued,
       market_erg_usd, market_circulating, market_volume_24h, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, now()
     )
     ON CONFLICT (slug) DO UPDATE SET
       pair = EXCLUDED.pair,
       pool_nft = EXCLUDED.pool_nft,
       oracle_token = EXCLUDED.oracle_token,
       box_id = COALESCE(EXCLUDED.box_id, oracle.pool_snap.box_id),
       creation_height = COALESCE(EXCLUDED.creation_height, oracle.pool_snap.creation_height),
       ts_ms = COALESCE(EXCLUDED.ts_ms, oracle.pool_snap.ts_ms),
       quote = COALESCE(EXCLUDED.quote, oracle.pool_snap.quote),
       r4_nano = COALESCE(EXCLUDED.r4_nano, oracle.pool_snap.r4_nano),
       epoch = COALESCE(EXCLUDED.epoch, oracle.pool_snap.epoch),
       value_nano = COALESCE(EXCLUDED.value_nano, oracle.pool_snap.value_nano),
       live_operators = EXCLUDED.live_operators,
       issued = EXCLUDED.issued,
       market_erg_usd = EXCLUDED.market_erg_usd,
       market_circulating = EXCLUDED.market_circulating,
       market_volume_24h = EXCLUDED.market_volume_24h,
       updated_at = now()`,
    [
      found.slug,
      def.pair,
      def.poolNft,
      def.oracleToken,
      pool?.boxId ?? null,
      pool?.height ?? null,
      pool?.tsMs ?? null,
      pool?.quote ?? null,
      pool?.r4Nano ?? null,
      poolEpoch,
      pool?.valueNano ?? null,
      live,
      def.issued,
      def.market ? overlay : null,
      usdMarket ? market.circulating : null,
      usdMarket ? market.volume24h : null,
    ]
  );

  let ticks = 0;
  const tickBoxes: DetectedBox[] = [];
  if (pool && shouldWriteTick(pool.quote)) tickBoxes.push(pool);
  for (const b of found.spentTicks) {
    if (shouldWriteTick(b.quote)) tickBoxes.push(b);
  }
  for (const b of tickBoxes) {
    const ins = await db.query(
      `INSERT INTO oracle.ticks (slug, box_id, height, ts_ms, quote, epoch, market_quote)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (slug, box_id) DO NOTHING`,
      [
        found.slug,
        b.boxId,
        b.height ?? 0,
        b.tsMs,
        b.quote,
        b.epoch,
        def.market ? overlay : null,
      ]
    );
    ticks += ins.rowCount ?? 0;
  }
  if (pool && def.market && overlay != null) {
    await db.query(
      `UPDATE oracle.ticks SET market_quote = $3
        WHERE slug = $1 AND box_id = $2
          AND market_quote IS DISTINCT FROM $3`,
      [found.slug, pool.boxId, overlay]
    );
  }
  await trimTicks(db, found.slug, keep);

  const ids = found.operators.map((o) => o.boxId);
  for (const op of found.operators) {
    const more = extra.get(op.boxId);
    const liveOp = liveOf(op);
    const kept =
      op.quote ??
      (op.address && Number.isFinite(quoteByAddr.get(op.address))
        ? quoteByAddr.get(op.address)!
        : null);
    await db.query(
      `INSERT INTO oracle.operator_snap (
         slug, box_id, address, creation_height, ts_ms, quote, r4_nano, epoch,
         value_nano, address_erg_nano, fee_nano, live, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now()
       )
       ON CONFLICT (slug, box_id) DO UPDATE SET
         address = EXCLUDED.address,
         creation_height = EXCLUDED.creation_height,
         ts_ms = EXCLUDED.ts_ms,
         quote = COALESCE(EXCLUDED.quote, oracle.operator_snap.quote),
         r4_nano = COALESCE(EXCLUDED.r4_nano, oracle.operator_snap.r4_nano),
         epoch = COALESCE(EXCLUDED.epoch, oracle.operator_snap.epoch),
         value_nano = EXCLUDED.value_nano,
         address_erg_nano = EXCLUDED.address_erg_nano,
         fee_nano = EXCLUDED.fee_nano,
         live = EXCLUDED.live,
         updated_at = now()`,
      [
        found.slug,
        op.boxId,
        op.address,
        op.height,
        more?.tsMs ?? op.tsMs,
        kept,
        op.r4Nano,
        op.epoch,
        op.valueNano,
        more?.addressErgNano ?? null,
        more?.feeNano ?? null,
        liveOp,
      ]
    );
  }
  await db.query(
    `DELETE FROM oracle.operator_snap s
     WHERE s.slug = $1
       AND NOT EXISTS (
         SELECT 1 FROM packed.boxes b
          WHERE b.box_id = packed.hex32(s.box_id)
            AND b.spent_tx_id IS NULL
       )`,
    [found.slug]
  );
  if (ids.length) {
    await db.query(
      `UPDATE oracle.operator_snap
          SET live = false, updated_at = now()
        WHERE slug = $1 AND live IS DISTINCT FROM false
          AND NOT (box_id = ANY($2::text[]))`,
      [found.slug, ids]
    );
  } else {
    await db.query(
      `UPDATE oracle.operator_snap
          SET live = false, updated_at = now()
        WHERE slug = $1 AND live IS DISTINCT FROM false`,
      [found.slug]
    );
  }

  await setState(db, `scan_height`, String(scanHeight));
  await setState(db, `scan_${found.slug}`, String(scanHeight));
  return { ticks };
}

async function trimTicks(db: Queryable, slug: OracleFeedSlug, keep: number): Promise<void> {
  const r = await db.query<{ box_id: string }>(
    `SELECT box_id FROM oracle.ticks WHERE slug = $1
     ORDER BY height DESC, box_id DESC`,
    [slug]
  );
  const drop = tickIdsToDrop(
    r.rows.map((x) => x.box_id),
    keep
  );
  if (!drop.length) return;
  await db.query(
    `DELETE FROM oracle.ticks WHERE slug = $1 AND box_id = ANY($2::text[])`,
    [slug, drop]
  );
}
