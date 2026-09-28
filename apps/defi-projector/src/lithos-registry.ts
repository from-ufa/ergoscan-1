import {
  LITHOS_DEX_VENUE,
  LITHOS_POOL_TREE_HEAD,
  LIT_DECIMALS,
  isAgeUsdBankNft,
  isLithosPlaceholderId,
  lithosPoolNftFromEnv,
  lithosTokenYFromEnv,
  pickLithosPoolAssets,
  pickLithosPoolShape,
} from "@ergoscan/shared";
import type { Db } from "./db.js";
import { registryForWindow, type PoolReg } from "./registry.js";

const HEX64 = /^[0-9a-f]{64}$/;
const ERG_ZERO = "0".repeat(64);

export const LITHOS_VENUE = LITHOS_DEX_VENUE;
export { registryForWindow };

export type LithosPoolReg = PoolReg;

/**
 * Script hunt on an interval, whether or not a pool is already registered.
 * `registryN` is unused; kept so callers do not change shape.
 */
export function lithosUnspentHuntDue(
  _registryN: number,
  now: number,
  lastHuntAt: number,
  intervalMs: number
): boolean {
  if (!(intervalMs > 0)) return false;
  if (!(lastHuntAt > 0)) return true;
  return now - lastHuntAt >= intervalMs;
}

export async function seedLithosFromEnv(db: Db): Promise<number> {
  const nft = lithosPoolNftFromEnv();
  if (!nft) return 0;
  const lit = lithosTokenYFromEnv();
  const r = await db.query(
    `
    INSERT INTO defi.pool_registry
      (pool_id, venue, quote_token, base_token, symbol, decimals, updated_height, updated_at)
    VALUES ($1, $2, $3, $4, 'LIT', $5, NULL, now())
    ON CONFLICT (pool_id) DO UPDATE SET
      venue = EXCLUDED.venue,
      quote_token = EXCLUDED.quote_token,
      base_token = EXCLUDED.base_token,
      symbol = COALESCE(EXCLUDED.symbol, defi.pool_registry.symbol),
      decimals = COALESCE(EXCLUDED.decimals, defi.pool_registry.decimals),
      updated_at = now()
    WHERE defi.pool_registry.venue IS DISTINCT FROM EXCLUDED.venue
       OR defi.pool_registry.quote_token IS DISTINCT FROM EXCLUDED.quote_token
    `,
    [nft, LITHOS_VENUE, lit, ERG_ZERO, LIT_DECIMALS]
  );
  return r.rowCount ?? 0;
}

/**
 * Unspent 3-asset box holding LIT with Lithos register bank (R4/R6/R7/R8).
 * `box_assets.token_id = $1` (ids stored lowercase) so `box_assets_token_idx` hits.
 * `lower(token_id)` seq-scans the table and times out.
 */
export async function seedLithosFromUnspent(db: Db): Promise<number> {
  const lit = lithosTokenYFromEnv();
  const client = await db.connect();
  let rows: Array<{
    box_id: string;
    creation_height: string | number | null;
    token_id: string;
    amount: string;
    emission: string | number | null;
  }>;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = 8000");
    const r = await client.query<{
      box_id: string;
      creation_height: string | number | null;
      token_id: string;
      amount: string;
      emission: string | number | null;
    }>(
      `
      WITH lit_boxes AS (
        SELECT b.box_id, b.creation_height
        FROM packed.box_assets ba
        JOIN packed.boxes b ON b.box_id = ba.box_id AND b.spent_tx_id IS NULL
        WHERE ba.token_id = packed.hex32($1)
          AND b.additional_registers ? 'R4'
          AND b.additional_registers ? 'R6'
          AND b.additional_registers ? 'R7'
          AND b.additional_registers ? 'R8'
          AND (SELECT count(*) FROM packed.box_assets x WHERE x.box_id = b.box_id) = 3
      )
      SELECT
        encode(l.box_id, 'hex') AS box_id,
        l.creation_height,
        encode(ba.token_id, 'hex') AS token_id,
        ba.amount::text,
        tok.emission::text AS emission
      FROM lit_boxes l
      JOIN packed.box_assets ba ON ba.box_id = l.box_id
      LEFT JOIN tokens tok ON tok.token_id = encode(ba.token_id, 'hex')
      `,
      [lit]
    );
    await client.query("COMMIT");
    rows = r.rows;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }

  const byBox = new Map<
    string,
    {
      height: number | null;
      assets: { tokenId: string; amount: string; emission: number | null }[];
    }
  >();
  for (const row of rows) {
    const box = String(row.box_id || "");
    if (!box) continue;
    let g = byBox.get(box);
    if (!g) {
      const n = Number(row.creation_height);
      g = {
        height: Number.isFinite(n) && n > 0 ? n : null,
        assets: [],
      };
      byBox.set(box, g);
    }
    const emission = Number(row.emission);
    g.assets.push({
      tokenId: String(row.token_id || "").toLowerCase(),
      amount: String(row.amount || "0"),
      emission: Number.isFinite(emission) ? emission : null,
    });
  }

  const found: Array<{ poolId: string; height: number | null }> = [];
  const seen = new Set<string>();
  for (const g of byBox.values()) {
    const parts = pickLithosPoolAssets(g.assets, lit);
    if (!parts) continue;
    if (seen.has(parts.nft) || isLithosPlaceholderId(parts.nft) || isAgeUsdBankNft(parts.nft)) {
      continue;
    }
    seen.add(parts.nft);
    found.push({ poolId: parts.nft, height: g.height });
  }
  if (!found.length) return 0;

  const ins = await db.query(
    `
    INSERT INTO defi.pool_registry
      (pool_id, venue, quote_token, base_token, symbol, decimals, updated_height, updated_at)
    SELECT x.pool_id, $1, $2, $3, 'LIT', $4, x.updated_height, now()
    FROM unnest($5::text[], $6::int[]) AS x(pool_id, updated_height)
    ON CONFLICT (pool_id) DO UPDATE SET
      venue = EXCLUDED.venue,
      quote_token = EXCLUDED.quote_token,
      base_token = EXCLUDED.base_token,
      symbol = COALESCE(EXCLUDED.symbol, defi.pool_registry.symbol),
      decimals = COALESCE(EXCLUDED.decimals, defi.pool_registry.decimals),
      updated_height = GREATEST(
        COALESCE(defi.pool_registry.updated_height, 0),
        COALESCE(EXCLUDED.updated_height, 0)
      ),
      updated_at = now()
    WHERE defi.pool_registry.venue IS DISTINCT FROM EXCLUDED.venue
       OR defi.pool_registry.quote_token IS DISTINCT FROM EXCLUDED.quote_token
    `,
    [
      LITHOS_VENUE,
      lit,
      ERG_ZERO,
      LIT_DECIMALS,
      found.map((x) => x.poolId),
      found.map((x) => x.height),
    ]
  );
  return ins.rowCount ?? 0;
}

/**
 * Unspent pool boxes of the shared Lithos script, created at or above `floorHeight`.
 * Index is `boxes_unspent_creation_idx` (creation_height, unspent). Not a boxes seq-scan.
 * Quote token comes from the box, so a non-LIT pool is stored as itself.
 */
export async function seedLithosFromScript(db: Db, floorHeight: number): Promise<string[]> {
  const floor = Number.isFinite(floorHeight) && floorHeight > 0 ? Math.floor(floorHeight) : 0;
  const client = await db.connect();
  let boxIds: string[] = [];
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = 8000");
    const found = await client.query<{ box_id: string }>(
      `
      SELECT encode(b.box_id, 'hex') AS box_id
      FROM packed.boxes b
      JOIN packed.script sc ON sc.id = b.script_id
      WHERE b.spent_tx_id IS NULL
        AND b.creation_height >= $1
        AND sc.ergo_tree LIKE $2
        AND b.additional_registers ? 'R4'
        AND b.additional_registers ? 'R6'
        AND b.additional_registers ? 'R7'
        AND b.additional_registers ? 'R8'
      `,
      [floor, `${LITHOS_POOL_TREE_HEAD}%`]
    );
    boxIds = found.rows.map((r) => r.box_id).filter(Boolean);
    if (!boxIds.length) {
      await client.query("COMMIT");
      return [];
    }
    const assets = await client.query<{
      box_id: string;
      creation_height: string | number | null;
      token_id: string;
      amount: string;
      emission: string | null;
    }>(
      `
      SELECT encode(ba.box_id, 'hex') AS box_id, b.creation_height,
             encode(ba.token_id, 'hex') AS token_id, ba.amount::text,
             tok.emission::text AS emission
      FROM packed.box_assets ba
      JOIN packed.boxes b ON b.box_id = ba.box_id
      LEFT JOIN tokens tok ON tok.token_id = encode(ba.token_id, 'hex')
      WHERE ba.box_id IN (SELECT decode(lower(x), 'hex') FROM unnest($1::text[]) AS x)
      `,
      [boxIds]
    );
    await client.query("COMMIT");
    const byBox = new Map<
      string,
      {
        height: number | null;
        assets: { tokenId: string; amount: string; emission: number | null }[];
      }
    >();
    for (const row of assets.rows) {
      const box = String(row.box_id || "");
      if (!box) continue;
      let g = byBox.get(box);
      if (!g) {
        const n = Number(row.creation_height);
        g = { height: Number.isFinite(n) && n > 0 ? n : null, assets: [] };
        byBox.set(box, g);
      }
      const emission = Number(row.emission);
      g.assets.push({
        tokenId: String(row.token_id || "").toLowerCase(),
        amount: String(row.amount || "0"),
        emission: Number.isFinite(emission) ? emission : null,
      });
    }
    const pools: Array<{ poolId: string; quote: string; height: number | null }> = [];
    const seen = new Set<string>();
    for (const g of byBox.values()) {
      const parts = pickLithosPoolShape(g.assets);
      if (!parts) continue;
      if (seen.has(parts.nft) || isLithosPlaceholderId(parts.nft) || isAgeUsdBankNft(parts.nft)) {
        continue;
      }
      seen.add(parts.nft);
      pools.push({ poolId: parts.nft, quote: parts.lit, height: g.height });
    }
    if (!pools.length) return [];
    await db.query(
      `
      INSERT INTO defi.pool_registry
        (pool_id, venue, quote_token, base_token, symbol, decimals, updated_height, updated_at)
      SELECT x.pool_id, $1, x.quote_token, $2,
             COALESCE(NULLIF(t.name, ''), CASE WHEN x.quote_token = $3 THEN 'LIT' ELSE 'pool' END),
             COALESCE(t.decimals, CASE WHEN x.quote_token = $3 THEN $4 ELSE 0 END),
             x.updated_height, now()
      FROM unnest($5::text[], $6::text[], $7::int[]) AS x(pool_id, quote_token, updated_height)
      LEFT JOIN tokens t ON t.token_id = x.quote_token
      ON CONFLICT (pool_id) DO UPDATE SET
        quote_token = EXCLUDED.quote_token,
        base_token = EXCLUDED.base_token,
        symbol = COALESCE(NULLIF(EXCLUDED.symbol, 'pool'), defi.pool_registry.symbol),
        decimals = COALESCE(EXCLUDED.decimals, defi.pool_registry.decimals),
        updated_height = GREATEST(
          COALESCE(defi.pool_registry.updated_height, 0),
          COALESCE(EXCLUDED.updated_height, 0)
        ),
        updated_at = now()
      WHERE defi.pool_registry.quote_token IS DISTINCT FROM EXCLUDED.quote_token
      `,
      [
        LITHOS_VENUE,
        ERG_ZERO,
        lithosTokenYFromEnv(),
        LIT_DECIMALS,
        pools.map((p) => p.poolId),
        pools.map((p) => p.quote),
        pools.map((p) => p.height),
      ]
    );
    return pools.map((p) => p.poolId);
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function seedLithosRegistry(db: Db, floorHeight = 0): Promise<number> {
  const fromEnv = await seedLithosFromEnv(db);
  const fromChain = await seedLithosFromUnspent(db);
  const fromScript = floorHeight > 0 ? await seedLithosFromScript(db, floorHeight) : [];
  return fromEnv + fromChain + fromScript.length;
}

export async function listLithosRegistry(db: Db): Promise<LithosPoolReg[]> {
  const lit = lithosTokenYFromEnv();
  const r = await db.query<{
    pool_id: string;
    quote_token: string;
    symbol: string | null;
    decimals: number | null;
    existed_from: string | number | null;
  }>(
    `SELECT
       r.pool_id,
       r.quote_token,
       r.symbol,
       r.decimals,
       COALESCE(t.first_height, r.updated_height) AS existed_from
     FROM defi.pool_registry r
     LEFT JOIN tokens t ON t.token_id = r.pool_id
     WHERE r.venue = $1`,
    [LITHOS_VENUE]
  );
  return r.rows
    .filter(
      (row) =>
        HEX64.test(row.pool_id) &&
        HEX64.test(row.quote_token) &&
        !isAgeUsdBankNft(row.pool_id) &&
        !isLithosPlaceholderId(row.pool_id)
    )
    .map((row) => {
      const raw = row.existed_from;
      const n = raw == null || raw === "" ? NaN : Number(raw);
      return {
        poolId: row.pool_id.toLowerCase(),
        quoteToken: (row.quote_token || lit).toLowerCase(),
        symbol: row.symbol || "LIT",
        decimals:
          row.decimals != null && Number.isFinite(Number(row.decimals))
            ? Number(row.decimals)
            : LIT_DECIMALS,
        existedFrom: Number.isFinite(n) && n > 0 ? n : null,
      };
    });
}
