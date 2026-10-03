import type { Queryable } from "./db.js";

/**
 * Cooperative oracle snaps. Same Postgres, own schema.
 * Do NOT DROP. Writer only — gateway SELECT.
 * Three feeds from ORACLE_FEEDS. CoinGecko + gold live in snapshot_kv.market.
 */
export async function ensureOracleSchema(db: Queryable): Promise<void> {
  await db.query(`CREATE SCHEMA IF NOT EXISTS oracle`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS oracle.worker_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS oracle.pool_snap (
      slug TEXT PRIMARY KEY,
      pair TEXT NOT NULL,
      pool_nft TEXT NOT NULL,
      oracle_token TEXT NOT NULL,
      box_id TEXT,
      creation_height INT,
      ts_ms BIGINT,
      quote DOUBLE PRECISION,
      r4_nano TEXT,
      epoch INT,
      value_nano TEXT,
      live_operators INT NOT NULL DEFAULT 0,
      issued INT NOT NULL DEFAULT 0,
      market_erg_usd DOUBLE PRECISION,
      market_circulating DOUBLE PRECISION,
      market_volume_24h DOUBLE PRECISION,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS oracle.operator_snap (
      slug TEXT NOT NULL,
      box_id TEXT NOT NULL,
      address TEXT,
      creation_height INT,
      ts_ms BIGINT,
      quote DOUBLE PRECISION,
      r4_nano TEXT,
      epoch INT,
      value_nano TEXT,
      address_erg_nano TEXT,
      fee_nano TEXT,
      live BOOLEAN,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (slug, box_id)
    )
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS oracle_operator_slug_h
       ON oracle.operator_snap (slug, creation_height DESC NULLS LAST, box_id)`
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS oracle.ticks (
      slug TEXT NOT NULL,
      box_id TEXT NOT NULL,
      height INT NOT NULL,
      ts_ms BIGINT,
      quote DOUBLE PRECISION NOT NULL,
      epoch INT,
      market_quote DOUBLE PRECISION,
      PRIMARY KEY (slug, box_id)
    )
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS oracle_ticks_slug_h
       ON oracle.ticks (slug, height DESC, box_id)`
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS oracle.leader (
      slug TEXT NOT NULL,
      height INT NOT NULL,
      tx_id TEXT NOT NULL,
      address TEXT NOT NULL,
      PRIMARY KEY (slug, height)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS oracle.last_post (
      slug TEXT NOT NULL,
      address TEXT NOT NULL,
      epoch INT NOT NULL,
      height INT NOT NULL,
      ts_ms BIGINT,
      PRIMARY KEY (slug, address)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS oracle.leader_wins (
      slug TEXT NOT NULL,
      address TEXT NOT NULL,
      wins INT NOT NULL,
      PRIMARY KEY (slug, address)
    )
  `);
}
