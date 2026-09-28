import type { Db } from "./db.js";

export async function refreshKpis(
  db: Db,
  scanHeight: number,
  tipHeight: number
): Promise<void> {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  await db.query(
    `UPDATE rosen.kpis SET
       events_total = s.total,
       events_24h = s.h24,
       completed_total = s.completed,
       processing_total = s.processing,
       fraud_total = s.fraud,
       route_count = s.routes,
       scan_height = $2,
       tip_height = $3,
       updated_at_ms = $4,
       source = 'projector'
     FROM (
       SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE ts_ms IS NOT NULL AND ts_ms >= $1)::int AS h24,
         count(*) FILTER (WHERE status = 'completed')::int AS completed,
         count(*) FILTER (WHERE status = 'processing')::int AS processing,
         count(*) FILTER (WHERE status = 'fraud')::int AS fraud,
         count(DISTINCT (from_chain, to_chain))::int AS routes
       FROM rosen.events
     ) s
     WHERE rosen.kpis.id = 1`,
    [cutoff, scanHeight, tipHeight, Date.now()]
  );
}
