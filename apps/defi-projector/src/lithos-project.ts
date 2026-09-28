import { isAgeUsdBankNft } from "@ergoscan/shared";
import type { Db } from "./db.js";
import type { DetectedSwap } from "./detect.js";
import { LITHOS_VENUE } from "./lithos-registry.js";

export async function persistLithosSwaps(
  db: Db,
  swaps: DetectedSwap[]
): Promise<{ ok: boolean; n: number }> {
  if (!swaps.length) return { ok: true, n: 0 };
  const client = await db.connect();
  let n = 0;
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = 8000`);
    for (const s of swaps) {
      if (isAgeUsdBankNft(s.poolId)) continue;
      await client.query(
        `INSERT INTO defi.swaps
          (tx_id, height, ts_ms, venue, pool_id, token_id, base_id, side,
           token_amount, base_amount, price, trader, event_kind, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'swap','confirmed')
         ON CONFLICT (tx_id, pool_id, event_kind) DO UPDATE SET
           height = EXCLUDED.height,
           ts_ms = EXCLUDED.ts_ms,
           side = EXCLUDED.side,
           token_amount = EXCLUDED.token_amount,
           base_amount = EXCLUDED.base_amount,
           price = EXCLUDED.price,
           trader = COALESCE(EXCLUDED.trader, defi.swaps.trader),
           token_id = EXCLUDED.token_id,
           venue = EXCLUDED.venue`,
        [
          s.txId,
          s.height,
          s.tsMs,
          LITHOS_VENUE,
          s.poolId,
          s.tokenId,
          s.baseId,
          s.side,
          s.tokenAmount,
          s.baseAmount,
          s.price,
          s.trader,
        ]
      );
      await client.query(
        `INSERT INTO defi.trades
          (tx_id, box_id, token_id, base_id, side, token_amount, base_amount,
           price, trader, pool_id, height, ts_ms, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'projector')
         ON CONFLICT (tx_id, token_id, side) DO UPDATE SET
           token_amount = EXCLUDED.token_amount,
           base_amount = EXCLUDED.base_amount,
           price = EXCLUDED.price,
           trader = COALESCE(EXCLUDED.trader, defi.trades.trader),
           pool_id = EXCLUDED.pool_id,
           height = EXCLUDED.height,
           box_id = EXCLUDED.box_id,
           ts_ms = EXCLUDED.ts_ms,
           source = 'projector'`,
        [
          s.txId,
          s.outBox,
          s.tokenId,
          s.baseId,
          s.side,
          s.tokenAmount,
          s.baseAmount,
          s.price,
          s.trader,
          s.poolId,
          s.height,
          s.tsMs,
        ]
      );
      n += 1;
    }
    await client.query("COMMIT");
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.warn(JSON.stringify({ type: "persist_skip", pair: "lithos", err: String(e) }));
    return { ok: false, n: 0 };
  } finally {
    client.release();
  }
  return { ok: true, n };
}
