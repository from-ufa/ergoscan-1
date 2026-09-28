/**
 * ErgoScan Rosen projector.
 *
 * Separate process. Reads public.* only. Writes rosen.events.
 * Default off — enable after the index window reaches genesis.
 * Same Postgres as the indexer and the DeFi projector. After genesis
 * this is a history-then-tip walker: same bite as DeFi (40), yield
 * when indexer tip lag rises, back off on timeout.
 *
 * Env:
 *   DATABASE_URL
 *   ROSEN_ENABLED=0
 *   ROSEN_REQUIRE_GENESIS=1   (0 = walk now, leaves a hole below min_height)
 *   ROSEN_INDEXER_PAUSE_LAG=2
 *   POLL_MS=4000
 *   BATCH_HEIGHTS=40
 *   TRAIL_RESCAN=16
 *   TIP_LAG_SAFE=2
 *   ROSEN_FROM_HEIGHT=989400
 *   KPI_MS=30000
 *   HEALTH_PORT=8794
 */
import { createPool, getState, setState } from "./db.js";
import { applyLateSpends, detectRosenWindow } from "./detect.js";
import { startHealthServer, type HealthSnap } from "./health.js";
import { refreshKpis } from "./kpis.js";
import { persistRosen } from "./persist.js";
import {
  batchForLag,
  liveIndexerLag,
  nextBatch,
  planRosenTick,
  requireGenesisFromEnv,
  shouldApplyLateSpends,
  shouldRefreshKpis,
  tickSleepMs,
} from "./policy.js";
import { ensureRosenSchema } from "./schema.js";

const ENABLED =
  process.env.ROSEN_ENABLED === "1" || process.env.ROSEN_ENABLED === "true";
const REQUIRE_GENESIS = requireGenesisFromEnv(process.env.ROSEN_REQUIRE_GENESIS);
const PAUSE_AT = Number(process.env.ROSEN_INDEXER_PAUSE_LAG || 2);
const POLL_MS = Number(process.env.POLL_MS || 4_000);
const BATCH = Number(process.env.BATCH_HEIGHTS || 40);
const TRAIL = Number(process.env.TRAIL_RESCAN || 16);
const TIP_LAG_SAFE = Number(process.env.TIP_LAG_SAFE || 2);
const FROM_HEIGHT = Number(process.env.ROSEN_FROM_HEIGHT || 989_400);
const KPI_MS = Number(process.env.KPI_MS || 30_000);
const HEALTH_PORT = Number(process.env.HEALTH_PORT || 8794);

const health: HealthSnap = {
  ok: true,
  enabled: ENABLED,
  mode: "idle",
  scanHeight: null,
  tipHeight: null,
  minHeight: null,
  lag: null,
  indexerLag: null,
  batch: null,
  insertedSession: 0,
  lastScanAt: null,
  lastError: null,
};

async function chainSnap(db: ReturnType<typeof createPool>): Promise<{
  tip: number;
  minH: number;
  indexerLag: number | null;
}> {
  const r = await db.query<{
    tip: number | null;
    min_h: number | null;
    last_h: number | null;
    snap_lag: number | null;
  }>(
    `SELECT
       (SELECT max(height)::int FROM packed.blocks) AS tip,
       COALESCE(
         (SELECT value::int FROM indexer_state WHERE key = 'min_height' LIMIT 1),
         (SELECT (payload->>'minHeight')::int FROM snapshot_kv WHERE key = 'indexer_status' LIMIT 1),
         (SELECT min(height)::int FROM packed.blocks)
       ) AS min_h,
       (SELECT value::int FROM indexer_state WHERE key = 'last_height' LIMIT 1) AS last_h,
       (SELECT (payload->>'lag')::int FROM snapshot_kv WHERE key = 'indexer_status' LIMIT 1) AS snap_lag`
  );
  const tip = Number(r.rows[0]?.tip) || 0;
  const minH = Number(r.rows[0]?.min_h) || 0;
  const lastRaw = r.rows[0]?.last_h;
  const lastH = lastRaw == null ? null : Number(lastRaw);
  const snapRaw = r.rows[0]?.snap_lag;
  const snapLag = snapRaw == null ? null : Number(snapRaw);
  return {
    tip,
    minH,
    indexerLag: liveIndexerLag(tip, lastH, snapLag),
  };
}

async function catchupSpends(db: ReturnType<typeof createPool>): Promise<void> {
  const late = await applyLateSpends(db);
  if (!late.length) return;
  const persisted = await persistRosen(db, [], late);
  if (persisted.ok && persisted.n) {
    health.lastScanAt = Date.now();
    health.lastError = null;
    console.log(
      JSON.stringify({ type: "spend_catchup", spends: late.length, upserts: persisted.n })
    );
  }
}

async function loop(): Promise<void> {
  const db = createPool();
  startHealthServer(HEALTH_PORT, () => ({ ...health }));

  if (!ENABLED) {
    console.log(
      JSON.stringify({
        type: "disabled",
        hint: "ROSEN_ENABLED=1 after genesis. Health on 8794. Not writing.",
      })
    );
    for (;;) await new Promise((r) => setTimeout(r, 60_000));
  }

  await ensureRosenSchema(db);

  let { tip, minH, indexerLag } = await chainSnap(db);
  health.tipHeight = tip;
  health.minHeight = minH;
  health.indexerLag = indexerLag;

  let cursor = Number((await getState(db, "scan_height")) || 0);
  if (!Number.isFinite(cursor) || cursor <= 0) {
    cursor = Math.max(0, FROM_HEIGHT - 1);
    await setState(db, "scan_height", String(cursor));
    console.log(JSON.stringify({ type: "cursor_init", cursor, tip, from: FROM_HEIGHT }));
  }

  health.scanHeight = cursor;
  console.log(
    JSON.stringify({
      type: "start",
      cursor,
      tip,
      from: FROM_HEIGHT,
      requireGenesis: REQUIRE_GENESIS,
      pauseAt: PAUSE_AT,
      batch: BATCH,
      healthPort: HEALTH_PORT,
    })
  );

  let holdLogged = "";
  let batch = BATCH;
  let lastKpis = 0;

  for (;;) {
    let timedOut = false;
    try {
      ({ tip, minH, indexerLag } = await chainSnap(db));
      health.tipHeight = tip;
      health.minHeight = minH;
      health.indexerLag = indexerLag;
      const safeTip = Math.max(0, tip - TIP_LAG_SAFE);
      const floor = Math.max(FROM_HEIGHT, minH);
      const sized = batchForLag(batch, indexerLag);
      health.batch = sized;
      const plan = planRosenTick({
        minHeight: minH,
        requireGenesis: REQUIRE_GENESIS,
        indexerLag,
        pauseAt: PAUSE_AT,
        cursor,
        safeTip,
        batch: sized,
        trail: TRAIL,
        floor,
      });
      if (plan.nextCursor !== cursor && !plan.advanceCursor) {
        cursor = plan.nextCursor;
        await setState(db, "scan_height", String(cursor));
      }
      health.mode = plan.mode;
      health.lag = Math.max(0, safeTip - cursor);
      health.scanHeight = cursor;

      if (plan.mode !== holdLogged && (plan.mode === "genesis_hold" || plan.mode === "tip_hold")) {
        console.log(
          JSON.stringify({
            type: plan.mode,
            minH,
            indexerLag,
            cursor,
            hint:
              plan.mode === "genesis_hold"
                ? "not walking address_tx until min_height=0"
                : "indexer tip lag; yielding public.*",
          })
        );
        holdLogged = plan.mode;
      }
      if (plan.mode === "history" || plan.mode === "tip") holdLogged = "";

      if (plan.detect) {
        const { from, to } = plan.detect;
        const detected = await detectRosenWindow(db, from, to);
        if (!detected.ok) {
          timedOut = true;
          batch = nextBatch(batch, BATCH, true);
          health.lastError = "detect_timeout";
          health.batch = batch;
        } else {
          batch = nextBatch(batch, BATCH, false);
          health.batch = batch;
          const late = shouldApplyLateSpends(plan.mode) ? await applyLateSpends(db) : [];
          const persisted = await persistRosen(db, detected.events, [
            ...detected.spends,
            ...late,
          ]);
          if (!persisted.ok) {
            health.lastError = "persist_skip";
          } else {
            if (plan.advanceCursor) {
              cursor = plan.nextCursor;
              await setState(db, "scan_height", String(cursor));
              health.scanHeight = cursor;
            }
            health.insertedSession += persisted.n;
            health.lastScanAt = Date.now();
            health.lastError = null;
            if (detected.events.length || detected.spends.length || late.length) {
              console.log(
                JSON.stringify({
                  type: "scan",
                  from,
                  to,
                  events: detected.events.length,
                  spends: detected.spends.length + late.length,
                  upserts: persisted.n,
                  mode: health.mode,
                  batch,
                })
              );
            }
          }
        }
      } else if (shouldApplyLateSpends(plan.mode)) {
        await catchupSpends(db);
      }

      const now = Date.now();
      if (shouldRefreshKpis(plan.mode, lastKpis, now, KPI_MS)) {
        try {
          await refreshKpis(db, cursor, tip);
          lastKpis = now;
        } catch (e) {
          console.warn(JSON.stringify({ type: "kpis_skip", err: String(e) }));
        }
      }

      await new Promise((r) => setTimeout(r, tickSleepMs(POLL_MS, plan.mode, timedOut)));
    } catch (e) {
      health.lastError = String(e);
      health.ok = true;
      console.error(JSON.stringify({ type: "tick_err", err: String(e) }));
      await new Promise((r) => setTimeout(r, POLL_MS * 2));
    }
  }
}

void loop().catch((e) => {
  console.error(JSON.stringify({ type: "fatal", err: String(e) }));
  process.exit(1);
});
