import {
  classifyLithosFill,
  ergoTokenDecimals,
  isAgeUsdBankNft,
  isLithosPlaceholderId,
  lithosNanoToErg,
  lithosRawToDecimal,
  lithosTokenYFromEnv,
  pickLithosCounterparty,
  type LithosOutBox,
} from "@ergoscan/shared";
import type { Db } from "./db.js";
import { ERG_ZERO, type DetectedSwap, type DetectResult } from "./detect.js";
import { nftsForDetect } from "./registry.js";
import { registryForWindow, type LithosPoolReg } from "./lithos-registry.js";

const DETECT_TIMEOUT_MS = Number(process.env.DETECT_TIMEOUT_MS || 8_000);
const MAX_TRADE_ERG = Number(process.env.MAX_TRADE_ERG || 25_000);
const HEX64 = /^[0-9a-f]{64}$/;

/**
 * LithosDex N2T: spent pool-NFT box → new box in the same tx (`creation_tx_id`).
 * Do not pair on `creation_height`: Ergo creationHeight lags inclusion (often >2).
 * Prefer R4/R6 reserve classify; box Δ + unchanged provision is the fallback.
 * Token ids are stored lowercase — equality uses `box_assets_token_idx`.
 * Timeout / SQL error → `ok: false` so `scan_height_lithos` retries the window.
 * Spectrum cursors never read this result.
 */
export async function detectLithosSwaps(
  db: Db,
  fromH: number,
  toH: number,
  registry: LithosPoolReg[]
): Promise<DetectResult> {
  if (fromH > toH || !registry.length) return { ok: true, swaps: [] };
  const live = registryForWindow(registry, toH).filter(
    (r) =>
      HEX64.test(r.poolId) &&
      !isAgeUsdBankNft(r.poolId) &&
      !isLithosPlaceholderId(r.poolId)
  );
  if (!live.length) return { ok: true, swaps: [] };

  const byNft = new Map(live.map((r) => [r.poolId, r]));
  const liveIds = live.map((r) => r.poolId);
  const active = await activeNftsInWindow(db, fromH, toH, liveIds);
  const nfts = nftsForDetect(liveIds, active);
  if (!nfts.length) return { ok: true, swaps: [] };

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = ${DETECT_TIMEOUT_MS}`);
    const lit = lithosTokenYFromEnv();
    const quotes = nfts.map((id) => byNft.get(id)?.quoteToken || lit);
    const r = await client.query<{
      tx_id: string;
      height: string | number;
      pool_id: string;
      in_erg: string;
      out_erg: string;
      out_box: string;
      timestamp_ms: string | number | null;
      y_in: string | null;
      y_out: string | null;
      p_in: string | null;
      p_out: string | null;
      in_regs: unknown;
      out_regs: unknown;
      outs: unknown;
      token_decimals: number | null;
    }>(
      `
      WITH pools AS (
        SELECT pool_id, quote_id
        FROM unnest($1::text[], $4::text[]) AS u(pool_id, quote_id)
      ),
      spent AS (
        SELECT
          b.spent_tx_id AS tx_id,
          b.spent_height AS height,
          p.pool_id,
          b.box_id,
          b.value_nano,
          b.additional_registers
        FROM pools p
        JOIN packed.box_assets ba ON ba.token_id = packed.hex32(p.pool_id) AND ba.amount = 1
        JOIN packed.boxes b ON b.box_id = ba.box_id
        WHERE b.spent_height >= $2 AND b.spent_height <= $3
          AND b.spent_tx_id IS NOT NULL
      ),
      created AS (
        SELECT
          s.tx_id,
          s.pool_id,
          b.box_id,
          b.value_nano,
          b.additional_registers
        FROM spent s
        JOIN packed.boxes b ON b.creation_tx_id = s.tx_id AND b.box_id <> s.box_id
        JOIN packed.box_assets ba
          ON ba.box_id = b.box_id AND ba.token_id = packed.hex32(s.pool_id) AND ba.amount = 1
      ),
      paired AS (
        SELECT DISTINCT ON (s.tx_id, s.pool_id)
          s.tx_id, s.height, s.pool_id, q.quote_id,
          s.box_id AS in_box, s.value_nano AS in_erg, s.additional_registers AS in_regs,
          c.box_id AS out_box, c.value_nano AS out_erg, c.additional_registers AS out_regs
        FROM spent s
        JOIN pools q ON q.pool_id = s.pool_id
        JOIN created c ON c.tx_id = s.tx_id AND c.pool_id = s.pool_id
        ORDER BY s.tx_id, s.pool_id, s.height DESC, s.box_id
      )
      SELECT
        encode(p.tx_id, 'hex') AS tx_id, p.height, p.pool_id,
        encode(p.out_box, 'hex') AS out_box,
        p.in_erg::text, p.out_erg::text,
        p.in_regs, p.out_regs,
        t.timestamp_ms,
        yin.amount::text AS y_in,
        yout.amount::text AS y_out,
        pin.amount::text AS p_in,
        pout.amount::text AS p_out,
        tok.decimals AS token_decimals,
        (
          SELECT coalesce(json_agg(json_build_object(
            'boxId', encode(b.box_id, 'hex'),
            'address', ad.address,
            'valueNano', b.value_nano::text,
            'litRaw', coalesce(lit.amount::text, '0')
          )), '[]'::json)
          FROM packed.boxes b
          JOIN packed.addr ad ON ad.id = b.addr_id
          LEFT JOIN packed.box_assets lit
            ON lit.box_id = b.box_id AND lit.token_id = packed.hex32(p.quote_id)
          WHERE b.creation_tx_id = p.tx_id
            AND b.box_id <> p.out_box
            AND ad.address LIKE '9%'
            AND length(ad.address) BETWEEN 50 AND 60
        ) AS outs
      FROM paired p
      LEFT JOIN packed.transactions t ON t.id = p.tx_id
      LEFT JOIN packed.box_assets yin
        ON yin.box_id = p.in_box AND yin.token_id = packed.hex32(p.quote_id)
      LEFT JOIN packed.box_assets yout
        ON yout.box_id = p.out_box AND yout.token_id = packed.hex32(p.quote_id)
      LEFT JOIN LATERAL (
        SELECT ba.token_id, ba.amount
        FROM packed.box_assets ba
        WHERE ba.box_id = p.in_box
          AND ba.token_id IS DISTINCT FROM packed.hex32(p.pool_id)
          AND ba.token_id IS DISTINCT FROM packed.hex32(p.quote_id)
        LIMIT 1
      ) pin ON true
      LEFT JOIN packed.box_assets pout
        ON pout.box_id = p.out_box
       AND pout.token_id = pin.token_id
      LEFT JOIN tokens tok ON tok.token_id = p.quote_id
      `,
      [nfts, fromH, toH, quotes]
    );
    await client.query("COMMIT");

    const out: DetectedSwap[] = [];
    for (const row of r.rows) {
      const poolId = String(row.pool_id || "").toLowerCase();
      if (!HEX64.test(poolId) || isAgeUsdBankNft(poolId) || isLithosPlaceholderId(poolId)) {
        continue;
      }
      const reg = byNft.get(poolId);
      const tokenId = String(reg?.quoteToken || lit).toLowerCase();
      let dProvRaw = "0";
      try {
        dProvRaw = String(BigInt(row.p_out ?? "0") - BigInt(row.p_in ?? "0"));
      } catch {
        dProvRaw = "0";
      }
      const hit = classifyLithosFill(
        { valueNano: row.in_erg, litRaw: row.y_in ?? "0", regs: row.in_regs },
        { valueNano: row.out_erg, litRaw: row.y_out ?? "0", regs: row.out_regs },
        dProvRaw
      );
      if (!hit) continue;

      const baseNano = hit.ergIn ? hit.amountIn : hit.amountOut;
      const tokenRaw = hit.ergIn ? hit.amountOut : hit.amountIn;
      const baseAmount = lithosNanoToErg(baseNano);
      if (!(baseAmount > 0 && baseAmount <= MAX_TRADE_ERG)) continue;

      const known = ergoTokenDecimals(tokenId);
      const dec =
        known != null
          ? known
          : reg?.decimals != null && Number.isFinite(reg.decimals)
            ? Number(reg.decimals)
            : row.token_decimals != null
              ? Number(row.token_decimals)
              : 9;
      const tokenAmount = lithosRawToDecimal(tokenRaw, dec);
      if (!(tokenAmount > 0) || tokenAmount > 1e12) continue;

      const side: "buy" | "sell" = hit.ergIn ? "buy" : "sell";
      const trader = pickLithosCounterparty({
        poolOutBox: String(row.out_box),
        ergIn: hit.ergIn,
        amountOut: hit.amountOut,
        outputs: parseOuts(row.outs),
      });
      out.push({
        txId: String(row.tx_id).toLowerCase(),
        height: Number(row.height) || fromH,
        tsMs: Number(row.timestamp_ms) || Date.now(),
        poolId,
        tokenId,
        baseId: ERG_ZERO,
        side,
        tokenAmount,
        baseAmount,
        price: tokenAmount > 0 && baseAmount > 0 ? baseAmount / tokenAmount : null,
        trader,
        outBox: String(row.out_box),
        decimals: dec,
        symbol: reg?.symbol ?? "LIT",
      });
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
        pair: "lithos",
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

async function activeNftsInWindow(
  db: Db,
  fromH: number,
  toH: number,
  nfts: string[]
): Promise<string[] | null> {
  if (!nfts.length) return [];
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = ${DETECT_TIMEOUT_MS}`);
    const r = await client.query<{ pool_id: string }>(
      `
      SELECT DISTINCT encode(ba.token_id, 'hex') AS pool_id
      FROM unnest($1::text[]) AS p(pool_id)
      JOIN packed.box_assets ba ON ba.token_id = packed.hex32(p.pool_id) AND ba.amount = 1
      JOIN packed.boxes b ON b.box_id = ba.box_id
      WHERE b.spent_height >= $2 AND b.spent_height <= $3
        AND b.spent_tx_id IS NOT NULL
      `,
      [nfts, fromH, toH]
    );
    await client.query("COMMIT");
    return r.rows.map((row) => row.pool_id).filter((id) => HEX64.test(id));
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.warn(
      JSON.stringify({
        type: "detect_active_skip",
        pair: "lithos",
        from: fromH,
        to: toH,
        err: String(e),
      })
    );
    return null;
  } finally {
    client.release();
  }
}

function parseOuts(raw: unknown): LithosOutBox[] {
  if (!raw) return [];
  const rows = typeof raw === "string" ? safeJson(raw) : raw;
  if (!Array.isArray(rows)) return [];
  const out: LithosOutBox[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const boxId = String(o.boxId || o.box_id || "");
    if (!boxId) continue;
    out.push({
      boxId,
      address: typeof o.address === "string" ? o.address : null,
      valueNano: asField(o.valueNano ?? o.value_nano),
      litRaw: asField(o.litRaw ?? o.lit_raw),
    });
  }
  return out;
}

function asField(v: unknown): string | number | bigint {
  if (typeof v === "bigint" || typeof v === "number" || typeof v === "string") return v;
  return "0";
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
