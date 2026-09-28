import type { Db } from "./db.js";
import type { DetectedEvent, SpendUpdate } from "./detect.js";

export async function persistRosen(
  db: Db,
  events: DetectedEvent[],
  spends: SpendUpdate[]
): Promise<{ ok: boolean; n: number }> {
  if (!events.length && !spends.length) return { ok: true, n: 0 };
  const client = await db.connect();
  let n = 0;
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = 8000`);
    await client.query(`SET LOCAL lock_timeout = '2s'`);
    for (const e of events) {
      const status = e.spentTxId
        ? spends.find((s) => s.boxId === e.triggerBoxId)?.status ?? "processing"
        : "processing";
      const spend = spends.find((s) => s.boxId === e.triggerBoxId);
      const r = await client.query(
        `INSERT INTO rosen.events (
           event_id, trigger_box_id, trigger_tx_id, height, ts_ms,
           from_chain, to_chain, from_address, to_address,
           amount, bridge_fee, network_fee,
           source_chain_token_id, target_chain_token_id,
           source_tx_id, source_block_id, source_chain_height,
           rwt_id, watcher_chain, wids_count, wids_hash,
           status, spend_tx_id, spend_height, payment_tx_id,
           token_name, token_decimals, ergo_side_token_id
         ) VALUES (
           $1,$2,$3,$4,$5,
           $6,$7,$8,$9,
           $10,$11,$12,
           $13,$14,
           $15,$16,$17,
           $18,$19,$20,$21,
           $22,$23,$24,$25,
           $26,$27,$28
         )
         ON CONFLICT (event_id) DO UPDATE SET
           height = EXCLUDED.height,
           ts_ms = COALESCE(EXCLUDED.ts_ms, rosen.events.ts_ms),
           token_name = COALESCE(EXCLUDED.token_name, rosen.events.token_name),
           token_decimals = COALESCE(EXCLUDED.token_decimals, rosen.events.token_decimals),
           ergo_side_token_id = COALESCE(EXCLUDED.ergo_side_token_id, rosen.events.ergo_side_token_id),
           rwt_id = COALESCE(EXCLUDED.rwt_id, rosen.events.rwt_id),
           watcher_chain = COALESCE(EXCLUDED.watcher_chain, rosen.events.watcher_chain),
           wids_count = COALESCE(EXCLUDED.wids_count, rosen.events.wids_count),
           wids_hash = COALESCE(EXCLUDED.wids_hash, rosen.events.wids_hash),
           status = CASE
             WHEN EXCLUDED.status IN ('completed', 'fraud') THEN EXCLUDED.status
             ELSE rosen.events.status
           END,
           spend_tx_id = COALESCE(EXCLUDED.spend_tx_id, rosen.events.spend_tx_id),
           spend_height = COALESCE(EXCLUDED.spend_height, rosen.events.spend_height),
           payment_tx_id = COALESCE(EXCLUDED.payment_tx_id, rosen.events.payment_tx_id),
           updated_at = now()`,
        [
          e.eventId,
          e.triggerBoxId,
          e.triggerTxId,
          e.height,
          e.tsMs,
          e.fromChain,
          e.toChain,
          e.fromAddress,
          e.toAddress,
          e.amount,
          e.bridgeFee,
          e.networkFee,
          e.sourceChainTokenId,
          e.targetChainTokenId,
          e.sourceTxId,
          e.sourceBlockId,
          e.sourceChainHeight,
          e.rwtId,
          e.watcherChain,
          e.widsCount,
          e.widsHash,
          status,
          spend?.spendTxId ?? e.spentTxId,
          spend?.spendHeight ?? e.spentHeight,
          spend?.paymentTxId ?? null,
          e.tokenName,
          e.tokenDecimals,
          e.ergoSideTokenId,
        ]
      );
      n += r.rowCount ?? 0;
    }
    for (const s of spends) {
      if (s.status === "processing") continue;
      const u = await client.query(
        `UPDATE rosen.events
         SET status = $2,
             spend_tx_id = $3,
             spend_height = $4,
             payment_tx_id = COALESCE($5, payment_tx_id),
             updated_at = now()
         WHERE trigger_box_id = $1`,
        [s.boxId, s.status, s.spendTxId, s.spendHeight, s.paymentTxId]
      );
      n += u.rowCount ?? 0;
    }
    await client.query("COMMIT");
    return { ok: true, n };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* */
    }
    console.warn(JSON.stringify({ type: "rosen_persist_skip", err: String(e) }));
    return { ok: false, n: 0 };
  } finally {
    client.release();
  }
}
