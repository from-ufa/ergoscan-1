import {
  AGEUSD_BANK_NFTS,
  AGEUSD_BANK_V2_NFT,
  SIGRSV_TOKEN_ID,
  SIGUSD_TOKEN_ID,
  ergoTokenDecimals,
  isAgeUsdBankNft,
} from "@ergoscan/shared";
import type { Db } from "./db.js";
import { ERG_ZERO, type DetectedSwap, type DetectResult } from "./detect.js";
import { classifyAgeUsdBankDelta } from "./ageusd-pair.js";

const DETECT_TIMEOUT_MS = Number(process.env.DETECT_TIMEOUT_MS || 8_000);
const NFTS = [...AGEUSD_BANK_NFTS];

export async function detectAgeUsdBank(
  db: Db,
  fromH: number,
  toH: number
): Promise<DetectResult> {
  if (fromH > toH) return { ok: true, swaps: [] };
  const nfts = fromH >= 452_138 ? [AGEUSD_BANK_V2_NFT] : NFTS;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = ${DETECT_TIMEOUT_MS}`);
    // One NFT pass, then height filters. MATERIALIZED so PG does not
    // inline and merge-join every spent×created box in the window.
    const r = await client.query<{
      tx_id: string;
      height: string | number;
      pool_id: string;
      out_box: string;
      in_erg: string;
      out_erg: string;
      timestamp_ms: string | number | null;
      trader: string | null;
      usd_in: string | null;
      usd_out: string | null;
      rsv_in: string | null;
      rsv_out: string | null;
    }>(
      `
      WITH bank AS MATERIALIZED (
        SELECT ba.box_id, encode(ba.token_id, 'hex') AS pool_id
        FROM packed.box_assets ba
        WHERE ba.token_id IN (SELECT decode(lower(x), 'hex') FROM unnest($1::text[]) AS x)
          AND ba.amount = 1
      ),
      spent AS MATERIALIZED (
        SELECT
          b.spent_tx_id AS tx_id,
          b.spent_height AS height,
          k.pool_id,
          b.box_id,
          b.value_nano
        FROM packed.boxes b
        JOIN bank k ON k.box_id = b.box_id
        WHERE b.spent_height >= $2 AND b.spent_height <= $3
          AND b.spent_tx_id IS NOT NULL
      ),
      created AS MATERIALIZED (
        SELECT
          b.creation_tx_id AS tx_id,
          k.pool_id,
          b.box_id,
          b.value_nano
        FROM packed.boxes b
        JOIN bank k ON k.box_id = b.box_id
        WHERE b.creation_height >= $2 - 2 AND b.creation_height <= $3
          AND b.creation_tx_id IS NOT NULL
      ),
      paired AS (
        SELECT DISTINCT ON (s.tx_id, s.pool_id)
          s.tx_id, s.height, s.pool_id,
          s.box_id AS in_box, s.value_nano AS in_erg,
          c.box_id AS out_box, c.value_nano AS out_erg
        FROM spent s
        JOIN created c ON c.tx_id = s.tx_id AND c.pool_id = s.pool_id
        ORDER BY s.tx_id, s.pool_id
      )
      SELECT
        encode(p.tx_id, 'hex') AS tx_id, p.height, p.pool_id,
        encode(p.out_box, 'hex') AS out_box,
        p.in_erg::text, p.out_erg::text,
        t.timestamp_ms,
        trader.address AS trader,
        uin.amount::text AS usd_in,
        uout.amount::text AS usd_out,
        rin.amount::text AS rsv_in,
        rout.amount::text AS rsv_out
      FROM paired p
      LEFT JOIN packed.transactions t ON t.id = p.tx_id
      LEFT JOIN packed.box_assets uin
        ON uin.box_id = p.in_box AND uin.token_id = decode(lower($4), 'hex')
      LEFT JOIN packed.box_assets uout
        ON uout.box_id = p.out_box AND uout.token_id = decode(lower($4), 'hex')
      LEFT JOIN packed.box_assets rin
        ON rin.box_id = p.in_box AND rin.token_id = decode(lower($5), 'hex')
      LEFT JOIN packed.box_assets rout
        ON rout.box_id = p.out_box AND rout.token_id = decode(lower($5), 'hex')
      LEFT JOIN LATERAL (
        SELECT ad.address
        FROM packed.address_tx a
        JOIN packed.addr ad ON ad.id = a.addr_id
        WHERE a.tx_id = p.tx_id
          AND ad.address LIKE '9%'
          AND length(ad.address) BETWEEN 50 AND 60
        ORDER BY length(ad.address) ASC, ad.address
        LIMIT 1
      ) trader ON true
      `,
      [nfts, fromH, toH, SIGUSD_TOKEN_ID, SIGRSV_TOKEN_ID]
    );
    await client.query("COMMIT");

    const out: DetectedSwap[] = [];
    for (const row of r.rows) {
      const nft = String(row.pool_id || "").toLowerCase();
      if (!isAgeUsdBankNft(nft)) continue;
      const dErg = num(row.out_erg) - num(row.in_erg);
      const dUsd = num(row.usd_out) - num(row.usd_in);
      const dRsv = num(row.rsv_out) - num(row.rsv_in);
      const ops = classifyAgeUsdBankDelta(dErg, dUsd, dRsv);
      const ts = Number(row.timestamp_ms) || Date.now();
      const height = Number(row.height) || fromH;
      const trader =
        typeof row.trader === "string" && row.trader.startsWith("9")
          ? row.trader
          : null;
      const outBox = String(row.out_box);
      for (const op of ops) {
        const dec = ergoTokenDecimals(op.tokenId) ?? (op.tokenId === SIGUSD_TOKEN_ID ? 2 : 0);
        const tokenAmount = op.tokenRaw / 10 ** Math.max(0, Math.min(18, dec));
        const baseAmount = op.ergNano / 1e9;
        if (!(tokenAmount > 0 && baseAmount > 0)) continue;
        out.push({
          txId: String(row.tx_id).toLowerCase(),
          height,
          tsMs: ts,
          poolId: nft,
          tokenId: op.tokenId,
          baseId: ERG_ZERO,
          side: op.side,
          eventKind: op.eventKind,
          tokenAmount,
          baseAmount,
          price: tokenAmount > 0 ? baseAmount / tokenAmount : null,
          trader,
          outBox,
          decimals: dec,
          symbol: op.tokenId === SIGUSD_TOKEN_ID ? "SigUSD" : "SigRSV",
        });
      }
    }
    return { ok: true, swaps: out };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.warn(
      JSON.stringify({
        type: "detect_skip",
        pair: "ageusd",
        from: fromH,
        to: toH,
        err: String(e),
      })
    );
    return { ok: false, swaps: [] };
  } finally {
    client.release();
  }
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
