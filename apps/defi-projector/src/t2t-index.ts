/**
 * Isolated T2T / N2N walker — emergency / history-only.
 * Tip-follow is `ergoscan-defi-projector` (unified N2T+T2T). Do not run this
 * unit next to the unified writer. Own cursor (`scan_height_t2t`). No ranks.
 * AgeUSD bank is denylisted. No Spectrum HTTP.
 *
 *   DEFI_T2T_ISOLATED=1         required — refuse otherwise
 *   DEFI_HISTORY=1
 *   DEFI_FROM_HEIGHT=633000
 *   BATCH_HEIGHTS=80
 *   HEALTH_PORT=8795
 */
import { createPool, getState, setState } from "./db.js";
import { ensureProjectorSchema } from "./schema.js";
import { detectT2tSwaps } from "./t2t-detect.js";
import { persistT2tSwaps } from "./t2t-project.js";
import { listT2tRegistry, seedT2tFromUnspent } from "./t2t-registry.js";
import { startHealthServer, type HealthSnap } from "./health.js";
import {
  clampCursorIfNeeded,
  fromHeightFromEnv,
  historyFromEnv,
  initCursor,
  liveIndexerLag,
  nextBatch,
  planDefiTick,
} from "./policy.js";

const ENABLED =
  process.env.PROJECTOR_ENABLED === "1" ||
  process.env.PROJECTOR_ENABLED === "true";
const HISTORY = historyFromEnv(process.env.DEFI_HISTORY);
const FROM_HEIGHT = fromHeightFromEnv(process.env.DEFI_FROM_HEIGHT || "633000");
const PAUSE_AT = Number(process.env.DEFI_INDEXER_PAUSE_LAG || 2);
const POLL_MS = Number(process.env.POLL_MS || 200);
const BATCH = Number(process.env.BATCH_HEIGHTS || 80);
const TRAIL = Number(process.env.TRAIL_RESCAN || 16);
const TIP_LAG_SAFE = Number(process.env.TIP_LAG_SAFE || 2);
const REGISTRY_MS = Number(process.env.REGISTRY_REFRESH_MS || 86_400_000);
const HEALTH_PORT = Number(process.env.HEALTH_PORT || 8795);
const REWIND_ON_START = Number(process.env.REWIND_BLOCKS || 2_000);
const CURSOR_KEY = process.env.DEFI_CURSOR_KEY || "scan_height_t2t";

const health: HealthSnap = {
  kind: "t2t",
  ok: true,
  enabled: ENABLED,
  mode: "idle",
  scanHeight: null,
  tipHeight: null,
  lag: null,
  indexerLag: null,
  registryN: 0,
  insertedSession: 0,
  lastScanAt: null,
  lastRanksAt: null,
  lastError: null,
};

async function chainSnap(db: ReturnType<typeof createPool>): Promise<{
  tip: number;
  indexerLag: number | null;
}> {
  const r = await db.query<{ tip: number | null; last_h: number | null }>(
    `SELECT
       (SELECT max(height)::int FROM packed.blocks) AS tip,
       (SELECT value FROM indexer_state WHERE key = 'last_height')::int AS last_h`
  );
  const tip = Number(r.rows[0]?.tip) || 0;
  return { tip, indexerLag: liveIndexerLag(tip, r.rows[0]?.last_h ?? null) };
}

async function loop(): Promise<void> {
  if (!ENABLED) {
    console.log(JSON.stringify({ type: "disabled", pair: "t2t" }));
    return;
  }
  const isolated =
    process.env.DEFI_T2T_ISOLATED === "1" ||
    process.env.DEFI_T2T_ISOLATED === "true";
  if (!isolated) {
    console.log(
      JSON.stringify({
        type: "disabled",
        pair: "t2t",
        hint: "tip-follow is unified; set DEFI_T2T_ISOLATED=1 only for a solo T2T walk",
      })
    );
    return;
  }

  const db = createPool();
  startHealthServer(HEALTH_PORT, () => ({ ...health }));

  await ensureProjectorSchema(db);
  let seeded = 0;
  try {
    seeded = await seedT2tFromUnspent(db);
  } catch (e) {
    console.warn(JSON.stringify({ type: "registry_seed_skip", pair: "t2t", err: String(e) }));
  }
  console.log(JSON.stringify({ type: "registry_seed", pair: "t2t", upserts: seeded }));

  const { tip, indexerLag: idx0 } = await chainSnap(db);
  let indexerLag = idx0;
  const stored = Number((await getState(db, CURSOR_KEY)) || 0);
  let cursor = initCursor(stored, tip, REWIND_ON_START, HISTORY, FROM_HEIGHT);
  const clamped = clampCursorIfNeeded(cursor, tip, REWIND_ON_START, HISTORY);
  cursor = clamped.cursor;
  if (cursor !== stored) {
    await setState(db, CURSOR_KEY, String(cursor));
    console.log(
      JSON.stringify({ type: "cursor_init", pair: "t2t", cursor, tip, history: HISTORY })
    );
  }

  let lastRegistry = Date.now();
  let batch = BATCH;
  let registry = await listT2tRegistry(db);
  health.registryN = registry.length;
  health.scanHeight = cursor;
  health.tipHeight = tip;
  health.indexerLag = indexerLag;

  console.log(
    JSON.stringify({
      type: "start",
      pair: "t2t",
      cursor,
      tip,
      history: HISTORY,
      from: FROM_HEIGHT,
      batch: BATCH,
      registry: registry.length,
      healthPort: HEALTH_PORT,
      cursorKey: CURSOR_KEY,
    })
  );

  for (;;) {
    let hold = false;
    try {
      const snap = await chainSnap(db);
      const tipNow = snap.tip;
      indexerLag = snap.indexerLag;
      health.tipHeight = tipNow;
      health.indexerLag = indexerLag;
      const safeTip = Math.max(0, tipNow - TIP_LAG_SAFE);
      const floor = HISTORY ? FROM_HEIGHT : 0;
      const plan = planDefiTick({
        cursor,
        safeTip,
        batch,
        trail: TRAIL,
        floor,
        indexerLag,
        pauseAt: PAUSE_AT,
      });
      if (plan.nextCursor !== cursor && plan.from == null) {
        cursor = plan.nextCursor;
        await setState(db, CURSOR_KEY, String(cursor));
      }
      health.mode = plan.mode;
      health.scanHeight = cursor;
      health.lag = Math.max(0, safeTip - cursor);

      if (Date.now() - lastRegistry > REGISTRY_MS) {
        try {
          seeded = await seedT2tFromUnspent(db);
          registry = await listT2tRegistry(db);
          health.registryN = registry.length;
          lastRegistry = Date.now();
          console.log(
            JSON.stringify({
              type: "registry_refresh",
              pair: "t2t",
              n: registry.length,
              seed: seeded,
            })
          );
        } catch (e) {
          lastRegistry = Date.now();
          console.warn(
            JSON.stringify({ type: "registry_refresh_skip", pair: "t2t", err: String(e) })
          );
        }
      }

      if (plan.mode === "tip_hold") {
        hold = true;
        health.lastError = "indexer_lag";
      } else if (registry.length && plan.from != null && plan.to != null) {
        const detected = await detectT2tSwaps(db, plan.from, plan.to, registry);
        if (!detected.ok) {
          batch = nextBatch(batch, BATCH, true);
          health.lastError = "detect_timeout";
          console.warn(
            JSON.stringify({
              type: "detect_timeout",
              pair: "t2t",
              from: plan.from,
              to: plan.to,
              batch,
            })
          );
        } else {
          batch = nextBatch(batch, BATCH, false);
          const persisted = await persistT2tSwaps(db, detected.swaps);
          if (!persisted.ok) {
            health.lastError = "persist_skip";
          } else {
            cursor = plan.nextCursor;
            await setState(db, CURSOR_KEY, String(cursor));
            health.scanHeight = cursor;
            health.insertedSession += persisted.n;
            health.lastScanAt = Date.now();
            health.lag = Math.max(0, safeTip - cursor);
            health.lastError = null;
            console.log(
              JSON.stringify({
                type: "scan",
                pair: "t2t",
                mode: plan.mode,
                from: plan.from,
                to: plan.to,
                pairs: detected.swaps.length,
                inserted: persisted.n,
                cursor,
                tip: tipNow,
                registry: registry.length,
              })
            );
          }
        }
      }

      if (!health.lastError || hold) health.ok = true;
    } catch (e) {
      health.ok = false;
      health.lastError = String(e);
      console.warn(JSON.stringify({ type: "tick_err", pair: "t2t", err: String(e) }));
    }

    await sleep(
      hold || health.lastError === "detect_timeout" ? POLL_MS * 2 : POLL_MS
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

loop().catch((e) => {
  console.error(e);
  process.exit(1);
});
