import type { Db } from "./db.js";

/**
 * Rosen event tape. Same Postgres, own schema.
 * Do NOT DROP. Writer only — gateway SELECT.
 */
export async function ensureRosenSchema(db: Db): Promise<void> {
  await db.query(`CREATE SCHEMA IF NOT EXISTS rosen`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS rosen.events (
      event_id TEXT PRIMARY KEY,
      trigger_box_id TEXT NOT NULL UNIQUE,
      trigger_tx_id TEXT NOT NULL,
      height INT NOT NULL,
      ts_ms BIGINT,
      from_chain TEXT NOT NULL,
      to_chain TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      amount TEXT NOT NULL,
      bridge_fee TEXT NOT NULL,
      network_fee TEXT NOT NULL,
      source_chain_token_id TEXT NOT NULL,
      target_chain_token_id TEXT NOT NULL,
      source_tx_id TEXT NOT NULL,
      source_block_id TEXT,
      source_chain_height INT,
      rwt_id TEXT,
      watcher_chain TEXT,
      wids_count INT,
      wids_hash TEXT,
      status TEXT NOT NULL DEFAULT 'processing',
      spend_tx_id TEXT,
      spend_height INT,
      payment_tx_id TEXT,
      token_name TEXT,
      token_decimals INT,
      ergo_side_token_id TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (status IN ('processing', 'completed', 'fraud'))
    )
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS rosen_events_ts ON rosen.events (ts_ms DESC NULLS LAST, event_id DESC)`
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS rosen_events_height ON rosen.events (height DESC, event_id DESC)`
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS rosen_events_status_ts ON rosen.events (status, ts_ms DESC NULLS LAST)`
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS rosen_events_processing_box
       ON rosen.events (trigger_box_id)
     WHERE status = 'processing'`
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS rosen.worker_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS rosen.kpis (
      id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      events_total INT NOT NULL DEFAULT 0,
      events_24h INT NOT NULL DEFAULT 0,
      completed_total INT NOT NULL DEFAULT 0,
      processing_total INT NOT NULL DEFAULT 0,
      fraud_total INT NOT NULL DEFAULT 0,
      route_count INT NOT NULL DEFAULT 0,
      scan_height INT,
      tip_height INT,
      updated_at_ms BIGINT,
      source TEXT NOT NULL DEFAULT 'projector'
    )
  `);
  await db.query(
    `INSERT INTO rosen.kpis (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
  );
}
