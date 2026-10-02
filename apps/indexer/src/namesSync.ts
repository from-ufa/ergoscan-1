/**
 * Load the ergo-names registry into names_* tables. Run after `node scripts/validate.mjs` passes.
 *
 *   DATABASE_URL=... npx tsx apps/indexer/src/namesSync.ts /root/ergo-names
 *   NAMES_COMMIT=<sha> NAMES_GATEWAY_ROLE=ergoscan_gateway (both optional)
 */
import { createPool } from "./db.js";
import { syncNameRegistry } from "./namesRegistry.js";

const dir = process.argv[2] ?? "/root/ergo-names";
const pool = createPool();
try {
  const out = await syncNameRegistry(pool, dir, {
    commit: process.env.NAMES_COMMIT ?? null,
    gatewayRole: process.env.NAMES_GATEWAY_ROLE ?? null,
  });
  console.log(JSON.stringify({ type: "names_sync", ...out }));
} finally {
  await pool.end();
}
