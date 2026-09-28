import {
  AGEUSD_BANK_NFTS,
  SIGMAUSD_BANK_ADDRESS,
  isAgeUsdBankNft,
} from "@ergoscan/shared";
import type { Db } from "./db.js";

const BANK_NFTS = [...AGEUSD_BANK_NFTS];

const HEX64 = /^[0-9a-f]{64}$/;

export type PoolReg = {
  poolId: string;
  quoteToken: string;
  symbol: string | null;
  decimals: number | null;
  /** Issuance box creation_height, else tokens.first_height. Null = keep in every window. */
  existedFrom: number | null;
};

/** Window [fromH, toH] only sees NFTs that already existed at toH. Missing height → keep. */
export function registryForWindow(registry: PoolReg[], toH: number): PoolReg[] {
  return registry.filter(
    (r) => r.existedFrom == null || r.existedFrom <= toH
  );
}

/**
 * Detect only NFTs that had a spent pool box in the height window.
 * `active == null` = prefilter failed → keep the full live list (do not drop history).
 */
export function nftsForDetect(allNfts: string[], active: string[] | null): string[] {
  if (active == null) return allNfts;
  const set = new Set(active);
  return allNfts.filter((id) => set.has(id));
}

/**
 * Seed / refresh registry from leftover pool_snap (NFT ≠ token) and tokens meta.
 * No Spectrum HTTP — Stage + leftover snap only.
 */
export async function seedRegistryFromPoolSnap(db: Db): Promise<number> {
  const r = await db.query(
    `
    INSERT INTO defi.pool_registry (pool_id, venue, quote_token, base_token, symbol, decimals, updated_height, updated_at)
    SELECT
      lower(ps.pool_id),
      'spectrum_cfmm',
      lower(ps.token_id),
      repeat('0', 64),
      NULLIF(ps.symbol, ''),
      tok.decimals,
      NULL,
      now()
    FROM defi.pool_snap ps
    LEFT JOIN tokens tok ON tok.token_id = lower(ps.token_id)
    WHERE length(ps.pool_id) = 64
      AND length(ps.token_id) = 64
      AND lower(ps.pool_id) <> lower(ps.token_id)
      AND ps.pool_id ~ '^[0-9a-fA-F]{64}$'
      AND ps.token_id ~ '^[0-9a-fA-F]{64}$'
      AND lower(ps.pool_id) <> ALL($1::text[])
    ON CONFLICT (pool_id) DO UPDATE SET
      quote_token = EXCLUDED.quote_token,
      symbol = COALESCE(EXCLUDED.symbol, defi.pool_registry.symbol),
      decimals = COALESCE(EXCLUDED.decimals, defi.pool_registry.decimals),
      updated_at = now()
    WHERE defi.pool_registry.quote_token IS DISTINCT FROM EXCLUDED.quote_token
       OR defi.pool_registry.symbol IS DISTINCT FROM EXCLUDED.symbol
       OR defi.pool_registry.decimals IS DISTINCT FROM EXCLUDED.decimals
  `,
    [BANK_NFTS]
  );
  return r.rowCount ?? 0;
}

/** Live unspent 3-asset pool boxes that match known quote tokens → reinforce NFT. */
export async function reinforceRegistryFromUnspent(db: Db, tip: number): Promise<number> {
  // Cheap: only touch quotes already in registry / pool_snap — discover NFT from tip-ish boxes.
  const r = await db.query(
    `
    WITH quotes AS (
      SELECT DISTINCT quote_token AS token_id FROM defi.pool_registry
      UNION
      SELECT DISTINCT lower(token_id) FROM defi.pool_snap
      WHERE length(token_id) = 64 AND token_id ~ '^[0-9a-fA-F]{64}$'
    ),
    cand AS (
      SELECT
        encode(nft.token_id, 'hex') AS pool_id,
        encode(y.token_id, 'hex') AS quote_token,
        b.value_nano,
        b.creation_height
      FROM packed.boxes b
      JOIN packed.addr ad ON ad.id = b.addr_id
      JOIN packed.box_assets nft ON nft.box_id = b.box_id AND nft.amount = 1
      JOIN packed.box_assets y
        ON y.box_id = b.box_id
       AND y.token_id <> nft.token_id
       AND y.amount > 1
      JOIN quotes q ON q.token_id = encode(y.token_id, 'hex')
      WHERE b.spent_tx_id IS NULL
        AND b.creation_height >= GREATEST(0, $1 - 80000)
        AND encode(nft.token_id, 'hex') <> ALL($2::text[])
        AND ad.address IS DISTINCT FROM $3
        AND NOT (
          b.additional_registers ? 'R6'
          AND b.additional_registers ? 'R7'
          AND b.additional_registers ? 'R8'
        )
        AND encode(nft.token_id, 'hex') NOT IN (
          SELECT pool_id FROM defi.pool_registry WHERE venue = 'lithos_dex'
        )
        AND (SELECT count(*) FROM packed.box_assets ba WHERE ba.box_id = b.box_id) BETWEEN 2 AND 4
    ),
    best AS (
      SELECT DISTINCT ON (quote_token)
        pool_id, quote_token, creation_height
      FROM cand
      ORDER BY quote_token, value_nano DESC
    )
    INSERT INTO defi.pool_registry (pool_id, venue, quote_token, base_token, updated_height, updated_at)
    SELECT pool_id, 'spectrum_cfmm', quote_token, repeat('0', 64), creation_height, now()
    FROM best
    WHERE pool_id <> quote_token
      AND pool_id <> ALL($2::text[])
    ON CONFLICT (pool_id) DO UPDATE SET
      quote_token = EXCLUDED.quote_token,
      updated_height = GREATEST(COALESCE(defi.pool_registry.updated_height, 0), EXCLUDED.updated_height),
      updated_at = now()
    `,
    [tip, BANK_NFTS, SIGMAUSD_BANK_ADDRESS]
  );
  return r.rowCount ?? 0;
}

export async function listRegistryNfts(db: Db): Promise<PoolReg[]> {
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
       COALESCE(b.creation_height, t.first_height) AS existed_from
     FROM defi.pool_registry r
     LEFT JOIN tokens t ON t.token_id = r.pool_id
     LEFT JOIN packed.boxes b ON b.box_id = packed.hex32(r.pool_id)
     WHERE r.venue = 'spectrum_cfmm'`
  );
  return r.rows
    .filter(
      (row) =>
        HEX64.test(row.pool_id) &&
        HEX64.test(row.quote_token) &&
        !isAgeUsdBankNft(row.pool_id)
    )
    .map((row) => {
      const raw = row.existed_from;
      const n = raw == null || raw === "" ? NaN : Number(raw);
      return {
        poolId: row.pool_id.toLowerCase(),
        quoteToken: row.quote_token.toLowerCase(),
        symbol: row.symbol,
        decimals: row.decimals,
        existedFrom: Number.isFinite(n) && n > 0 ? n : null,
      };
    });
}
