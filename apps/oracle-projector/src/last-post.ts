import {
  ORACLE_FEEDS,
  leaderAddressFromR4,
  oracleEpochFromRegisters,
  type OracleFeedSlug,
} from "@ergoscan/shared";
import { getState, setState, type Queryable } from "./db.js";

const KEY = "last_post_height";
const WINDOW = 300;
const LOOKBACK = 900;

type Row = {
  height: string | number;
  ts_ms: string | number | null;
  r4: string | null;
  r5: string | null;
  token: string;
};

export async function advanceLastPosts(db: Queryable, tip: number): Promise<number> {
  if (!Number.isFinite(tip) || tip <= 0) return 0;
  const raw = await getState(db, KEY);
  const cursor = raw != null && Number(raw) > 0 ? Number(raw) : Math.max(0, tip - LOOKBACK);
  if (cursor >= tip) return 0;
  const end = Math.min(tip, cursor + WINDOW);
  const feeds = Object.values(ORACLE_FEEDS).filter((d) => d.refreshNft);
  const tokens = feeds.map((d) => d.oracleToken);
  const slugOf = new Map<string, OracleFeedSlug>(feeds.map((d) => [d.oracleToken, d.slug]));
  const rows = await db.query<Row>(
    `SELECT b.creation_height AS height,
            blk.timestamp_ms AS ts_ms,
            b.additional_registers->>'R4' AS r4,
            b.additional_registers->>'R5' AS r5,
            encode(a.token_id, 'hex') AS token
       FROM packed.boxes b
       JOIN packed.box_assets a
         ON a.box_id = b.box_id
        AND a.amount = 1
        AND a.token_id IN (SELECT decode(x, 'hex') FROM unnest($1::text[]) AS x)
       LEFT JOIN packed.blocks blk ON blk.height = b.creation_height
      WHERE b.creation_height > $2
        AND b.creation_height <= $3
        AND b.additional_registers ? 'R5'`,
    [tokens, cursor, end]
  );
  let wrote = 0;
  for (const row of rows.rows) {
    const slug = slugOf.get(row.token);
    const address = leaderAddressFromR4(row.r4);
    const epoch = oracleEpochFromRegisters({ R5: row.r5 });
    const height = Number(row.height);
    if (!slug || !address || epoch == null || !Number.isFinite(height)) continue;
    const ts = row.ts_ms == null ? null : Number(row.ts_ms);
    const saved = await db.query(
      `INSERT INTO oracle.last_post (slug, address, epoch, height, ts_ms)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slug, address) DO UPDATE
         SET epoch = EXCLUDED.epoch,
             height = EXCLUDED.height,
             ts_ms = EXCLUDED.ts_ms
       WHERE EXCLUDED.height >= oracle.last_post.height`,
      [slug, address, epoch, height, ts != null && Number.isFinite(ts) ? ts : null]
    );
    wrote += saved.rowCount ?? 0;
  }
  await setState(db, KEY, String(end));
  return wrote;
}
