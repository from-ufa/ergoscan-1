/**
 * Contract names from the public registry (github.com/kayolo-ergoscan/ergo-names).
 * The registry's own scripts/validate.mjs runs before this; here we only shape rows and resolve anchors.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type pg from "pg";

export type NameEntry = {
  matchKind: "address" | "template" | "token";
  matchValue: string;
  name: string;
  kind: "contract" | "wallet";
  projectId: string;
  projectName: string;
  category: string;
  by: "project" | "ergoscan";
  source: string;
  note: string | null;
  until: number | null;
  file: string;
};

export type AnchorHolder = {
  address: string;
  firstHeight: number | null;
  lastHeight: number | null;
  current: boolean;
};

export type NameAddressRow = {
  address: string;
  matchKind: "address" | "token";
  matchValue: string;
  firstHeight: number | null;
  lastHeight: number | null;
  current: boolean;
};

const MATCH_KINDS = ["address", "template", "token"] as const;

export function isP2pkAddress(address: string): boolean {
  return address.length === 51 && address.startsWith("9");
}

export function readNameRegistry(dir: string): NameEntry[] {
  const out: NameEntry[] = [];
  const projectsDir = join(dir, "projects");
  for (const file of readdirSync(projectsDir).filter((f) => f.endsWith(".json")).sort()) {
    const p = JSON.parse(readFileSync(join(projectsDir, file), "utf8")) as Record<string, unknown>;
    for (const raw of (p.contracts as Record<string, unknown>[] | undefined) ?? []) {
      const match = (raw.match ?? {}) as Record<string, unknown>;
      const matchKind = MATCH_KINDS.find((k) => typeof match[k] === "string");
      if (!matchKind) continue;
      out.push({
        matchKind,
        matchValue: String(match[matchKind]),
        name: String(raw.name),
        kind: raw.kind === "wallet" ? "wallet" : "contract",
        projectId: String(p.id),
        projectName: String(p.name),
        category: String(p.category),
        by: p.by === "project" ? "project" : "ergoscan",
        source: String(raw.source),
        note: typeof raw.note === "string" ? raw.note : null,
        until: Number.isInteger(raw.until) ? Number(raw.until) : null,
        file,
      });
    }
  }
  return out;
}

/** Exact addresses win. A token anchor names contracts only, never a P2PK that once held the NFT. */
export function resolveNameAddresses(
  entries: NameEntry[],
  anchors: Map<string, AnchorHolder[]>
): NameAddressRow[] {
  const rows = new Map<string, NameAddressRow>();
  for (const e of entries) {
    if (e.matchKind !== "address") continue;
    rows.set(e.matchValue, {
      address: e.matchValue,
      matchKind: "address",
      matchValue: e.matchValue,
      firstHeight: null,
      lastHeight: null,
      current: true,
    });
  }
  for (const e of entries) {
    if (e.matchKind !== "token") continue;
    for (const h of anchors.get(e.matchValue) ?? []) {
      if (isP2pkAddress(h.address) || rows.has(h.address)) continue;
      rows.set(h.address, {
        address: h.address,
        matchKind: "token",
        matchValue: e.matchValue,
        firstHeight: h.firstHeight,
        lastHeight: h.lastHeight,
        current: h.current,
      });
    }
  }
  return [...rows.values()].sort((a, b) => a.address.localeCompare(b.address));
}

export const NAMES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS names_registry (
  match_kind   TEXT NOT NULL CHECK (match_kind IN ('address', 'template', 'token')),
  match_value  TEXT NOT NULL,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL,
  project_id   TEXT NOT NULL,
  project_name TEXT NOT NULL,
  category     TEXT NOT NULL,
  by_whom      TEXT NOT NULL,
  source       TEXT NOT NULL,
  note         TEXT,
  until_height BIGINT,
  file         TEXT NOT NULL,
  PRIMARY KEY (match_kind, match_value)
);
CREATE TABLE IF NOT EXISTS names_address (
  address      TEXT PRIMARY KEY,
  match_kind   TEXT NOT NULL,
  match_value  TEXT NOT NULL,
  first_height BIGINT,
  last_height  BIGINT,
  current      BOOLEAN NOT NULL
);
CREATE TABLE IF NOT EXISTS names_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

const ANCHOR_SQL = `
SELECT ad.address, min(b.creation_height) AS first_h, max(b.creation_height) AS last_h,
       bool_or(b.spent_tx_id IS NULL) AS current
  FROM packed.box_assets a
  JOIN packed.boxes b ON b.box_id = a.box_id
  JOIN packed.addr ad ON ad.id = b.addr_id
 WHERE a.token_id = decode($1, 'hex')
 GROUP BY ad.address`;

/** Every address that held this NFT. A token with emission above 1 is not an anchor: it also sits in wallets. */
async function anchorHolders(
  pool: pg.Pool,
  tokenId: string,
  warn: (msg: string) => void
): Promise<AnchorHolder[]> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN READ ONLY");
    await c.query("SET LOCAL statement_timeout = '60s'");
    const em = await c.query<{ emission: string | null }>(`SELECT emission::text AS emission FROM tokens WHERE token_id = $1`, [tokenId]);
    if (em.rows[0]?.emission !== "1") {
      warn(`token ${tokenId.slice(0, 12)}: emission ${em.rows[0]?.emission ?? "unknown"}, not an NFT anchor`);
      return [];
    }
    const r = await c.query<{ address: string; first_h: string | null; last_h: string | null; current: boolean }>(ANCHOR_SQL, [tokenId]);
    return r.rows.map((x) => ({
      address: x.address,
      firstHeight: x.first_h == null ? null : Number(x.first_h),
      lastHeight: x.last_h == null ? null : Number(x.last_h),
      current: x.current === true,
    }));
  } catch (e) {
    warn(`token ${tokenId.slice(0, 12)}: ${String(e).slice(0, 120)}`);
    return [];
  } finally {
    await c.query("ROLLBACK").catch(() => {});
    c.release();
  }
}

export async function syncNameRegistry(
  pool: pg.Pool,
  dir: string,
  opts: { commit?: string | null; gatewayRole?: string | null; warn?: (msg: string) => void } = {}
): Promise<{ entries: number; addresses: number; anchors: number; templates: number }> {
  const warn = opts.warn ?? ((msg: string) => console.warn(`[names] ${msg}`));
  const entries = readNameRegistry(dir);
  await pool.query(NAMES_SCHEMA_SQL);
  const role = opts.gatewayRole ?? null;
  if (role && /^[a-z_][a-z0-9_]{0,62}$/.test(role)) {
    const has = await pool.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [role]);
    if (has.rowCount) await pool.query(`GRANT SELECT ON names_registry, names_address, names_meta TO ${role}`);
  }
  const anchors = new Map<string, AnchorHolder[]>();
  for (const e of entries) {
    if (e.matchKind === "token" && !anchors.has(e.matchValue)) {
      anchors.set(e.matchValue, await anchorHolders(pool, e.matchValue, warn));
    }
  }
  const rows = resolveNameAddresses(entries, anchors);
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("DELETE FROM names_registry");
    await c.query(
      `INSERT INTO names_registry (match_kind, match_value, name, kind, project_id, project_name, category,
                                   by_whom, source, note, until_height, file)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[],
                            $8::text[], $9::text[], $10::text[], $11::bigint[], $12::text[])`,
      [
        entries.map((e) => e.matchKind),
        entries.map((e) => e.matchValue),
        entries.map((e) => e.name),
        entries.map((e) => e.kind),
        entries.map((e) => e.projectId),
        entries.map((e) => e.projectName),
        entries.map((e) => e.category),
        entries.map((e) => e.by),
        entries.map((e) => e.source),
        entries.map((e) => e.note),
        entries.map((e) => e.until),
        entries.map((e) => e.file),
      ]
    );
    await c.query("DELETE FROM names_address");
    await c.query(
      `INSERT INTO names_address (address, match_kind, match_value, first_height, last_height, current)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::bigint[], $5::bigint[], $6::boolean[])`,
      [
        rows.map((r) => r.address),
        rows.map((r) => r.matchKind),
        rows.map((r) => r.matchValue),
        rows.map((r) => r.firstHeight),
        rows.map((r) => r.lastHeight),
        rows.map((r) => r.current),
      ]
    );
    await c.query(
      `INSERT INTO names_meta (key, value, updated_at)
       SELECT k, v, now() FROM unnest($1::text[], $2::text[]) AS t(k, v)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [
        ["commit", "entries", "addresses"],
        [opts.commit ?? null, String(entries.length), String(rows.length)],
      ]
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  return {
    entries: entries.length,
    addresses: rows.length,
    anchors: rows.filter((r) => r.matchKind === "token").length,
    templates: entries.filter((e) => e.matchKind === "template").length,
  };
}
