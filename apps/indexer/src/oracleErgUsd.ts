/**
 * Official Erg-USD quote the oracle writer already laid.
 * Indexer copies into home. No box hop.
 */
import type { Pool, PoolClient } from "pg";
import { parseMarketSnap, SNAP_MARKET_KEY } from "@ergoscan/shared";

type Queryable = Pool | PoolClient;

export const ORACLE_BOX_STATE_KEY = "erg_usd_oracle_box";

export type OracleErgUsdSnap = {
  boxId: string;
  height: number | null;
  nanoPerUsd: number;
  ergUsd: number;
};

export async function rememberOracleBox(db: Queryable, boxId: string): Promise<void> {
  if (!/^[0-9a-f]{64}$/i.test(boxId)) return;
  await db.query(
    `INSERT INTO indexer_state (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [ORACLE_BOX_STATE_KEY, boxId.toLowerCase()]
  );
}

export async function writeOracleHomeFields(pool: Pool): Promise<OracleErgUsdSnap | null> {
  const snap = await resolveOracleErgUsd(pool);
  if (!snap) return null;
  await pool.query(
    `UPDATE snapshot_kv
     SET payload = COALESCE(payload, '{}'::jsonb) || $2::jsonb,
         updated_at = now()
     WHERE key = $1`,
    [
      "home",
      JSON.stringify({
        ergUsdOracle: snap.ergUsd,
        ergUsdOracleNano: snap.nanoPerUsd,
        ergUsdOracleBoxId: snap.boxId,
        ergUsdOracleHeight: snap.height,
      }),
    ]
  );
  return snap;
}

function fromRow(row: {
  box_id: string | null;
  quote: number | null;
  r4_nano: string | null;
  creation_height: number | null;
}): OracleErgUsdSnap | null {
  const boxId = String(row.box_id || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(boxId)) return null;
  const usd = Number(row.quote);
  const nano = Number(row.r4_nano);
  if (!(usd > 0) || !(nano > 0)) return null;
  const h = Number(row.creation_height);
  return {
    boxId,
    height: Number.isFinite(h) ? h : null,
    nanoPerUsd: nano,
    ergUsd: usd,
  };
}

export async function resolveOracleErgUsd(pool: Pool): Promise<OracleErgUsdSnap | null> {
  try {
    const snap = await pool.query<{
      box_id: string | null;
      quote: number | null;
      r4_nano: string | null;
      creation_height: number | null;
    }>(
      `SELECT box_id, quote, r4_nano, creation_height
         FROM oracle.pool_snap
        WHERE slug = 'ergusd'
        LIMIT 1`
    );
    const fromPool = snap.rows[0] ? fromRow(snap.rows[0]) : null;
    if (fromPool) return fromPool;
  } catch {
    /* writer schema not ready */
  }
  try {
    const market = await pool.query<{ payload: unknown }>(
      `SELECT payload FROM snapshot_kv WHERE key = $1 LIMIT 1`,
      [SNAP_MARKET_KEY]
    );
    const p = parseMarketSnap(market.rows[0]?.payload);
    if (p?.oracleErgUsd != null && p.oracleErgUsdBoxId && p.oracleErgUsdNano != null) {
      return {
        boxId: p.oracleErgUsdBoxId,
        height: p.oracleErgUsdHeight,
        nanoPerUsd: p.oracleErgUsdNano,
        ergUsd: p.oracleErgUsd,
      };
    }
  } catch {
    /* */
  }
  return null;
}
