import { isAgeUsdBankNft } from "@ergoscan/shared";
import type { Db } from "./db.js";
import { getState, setState } from "./db.js";
import {
  droppedSwapEvents,
  ergFromNano,
  listSpectrumPools,
  readPoolBoxes,
  readTraders,
  wholeTokens,
  type PoolRow,
} from "./lp-history.js";

const DONE = "swap_gap_v1";
const CURSOR = "swap_gap_pool";
const ERG = "0".repeat(64);

/**
 * Large swaps the half-pool filter dropped. Insert only.
 * A row that is already stored is left as it is. scan_height* is not moved.
 * Volume tiles recompute from defi.swaps, so this does not add the amount twice.
 */
export async function backfillSwapGap(db: Db): Promise<void> {
  if (await getState(db, DONE)) return;
  const cursor = (await getState(db, CURSOR)) || "";
  const pools = await listSpectrumPools(db, cursor);
  console.log(JSON.stringify({ type: "swap_gap_start", from: cursor || null, pools: pools.length }));
  let n = 0;
  let done = 0;
  for (const pool of pools) {
    if (isAgeUsdBankNft(pool.poolId)) {
      await setState(db, CURSOR, pool.poolId);
      done += 1;
      continue;
    }
    const saved = await fillPool(db, pool);
    if (!saved.ok) {
      console.warn(JSON.stringify({ type: "swap_gap_retry", pool: pool.poolId, done, n }));
      return;
    }
    n += saved.n;
    done += 1;
    await setState(db, CURSOR, pool.poolId);
    if (done % 25 === 0) {
      console.log(JSON.stringify({ type: "swap_gap", pool: pool.poolId, done, n, added: saved.n }));
    }
  }
  await setState(db, DONE, String(Date.now()));
  console.log(JSON.stringify({ type: "swap_gap_done", pools: done, n }));
}

async function fillPool(db: Db, pool: PoolRow): Promise<{ ok: boolean; n: number }> {
  const boxes = await readPoolBoxes(db, pool);
  if (!boxes) return { ok: false, n: 0 };
  const events = droppedSwapEvents(pool.venue, boxes);
  if (!events.length) return { ok: true, n: 0 };
  const traders = await readTraders(db, events.map((ev) => ev.txId));
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = 20000");
    let n = 0;
    for (const ev of events) {
      const tokenAmount = wholeTokens(ev.tokenRaw, pool.quoteDec);
      const baseAmount =
        pool.venue === "spectrum_cfmm" ? ergFromNano(ev.baseRaw) : wholeTokens(ev.baseRaw, pool.baseDec);
      if (!(tokenAmount > 0) || !(baseAmount > 0) || !Number.isFinite(tokenAmount) || !Number.isFinite(baseAmount)) {
        continue;
      }
      const price = baseAmount / tokenAmount;
      const baseId = pool.venue === "spectrum_cfmm" ? ERG : pool.base;
      const trader = traders.get(ev.txId) ?? null;
      const ts = ev.tsMs > 0 ? ev.tsMs : 0;
      const inserted = await client.query(
        `INSERT INTO defi.swaps
           (tx_id, height, ts_ms, venue, pool_id, token_id, base_id, side,
            token_amount, base_amount, price, trader, event_kind, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'swap','confirmed')
         ON CONFLICT (tx_id, pool_id, event_kind) DO NOTHING`,
        [
          ev.txId,
          ev.height,
          ts > 0 ? ts : null,
          pool.venue,
          pool.poolId,
          pool.quote,
          baseId,
          ev.side,
          tokenAmount,
          baseAmount,
          Number.isFinite(price) ? price : null,
          trader,
        ]
      );
      n += inserted.rowCount ?? 0;
      await client.query(
        `INSERT INTO defi.trades
           (tx_id, box_id, token_id, base_id, side, token_amount, base_amount,
            price, trader, pool_id, height, ts_ms, source)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'projector')
         ON CONFLICT (tx_id, token_id, side) DO NOTHING`,
        [
          ev.txId,
          pool.quote,
          baseId,
          ev.side,
          tokenAmount,
          baseAmount,
          Number.isFinite(price) ? price : null,
          trader,
          pool.poolId,
          ev.height,
          ts,
        ]
      );
      if (pool.venue === "spectrum_n2n") {
        const back = baseAmount > 0 ? tokenAmount / baseAmount : null;
        await client.query(
          `INSERT INTO defi.trades
             (tx_id, box_id, token_id, base_id, side, token_amount, base_amount,
              price, trader, pool_id, height, ts_ms, source)
           VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'projector')
           ON CONFLICT (tx_id, token_id, side) DO NOTHING`,
          [
            ev.txId,
            pool.base,
            pool.quote,
            ev.baseSide,
            baseAmount,
            tokenAmount,
            back != null && Number.isFinite(back) ? back : null,
            trader,
            pool.poolId,
            ev.height,
            ts,
          ]
        );
      }
    }
    await client.query("COMMIT");
    return { ok: true, n };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.warn(JSON.stringify({ type: "swap_gap_skip", pool: pool.poolId, err: String(e) }));
    return { ok: false, n: 0 };
  } finally {
    client.release();
  }
}
