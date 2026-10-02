/**
 * Names from the public ergo-names registry, loaded hourly into names_* by the indexer's namesSync.
 * Address → exact or NFT-anchor row; else a P2S address → its ErgoTree template.
 */
import { getIndexPool } from "./indexDb.js";
import { ergoTreeFromAddress } from "./ergoAddress.js";
import { ergoTreeTemplateHash } from "./ergoTree.js";

export const NAMES_REGISTRY_URL = "https://github.com/kayolo-ergoscan/ergo-names";

export type AddressName = {
  name: string;
  kind: string;
  project: { id: string; name: string; category: string };
  by: "project" | "ergoscan";
  via: "address" | "token" | "template";
  current: boolean;
  until: number | null;
  file: string;
  fileUrl: string;
};

type NameRow = {
  name: string;
  kind: string;
  project_id: string;
  project_name: string;
  category: string;
  by_whom: string;
  via: string;
  current: boolean | null;
  until_height: string | null;
  file: string;
};

export function registryFileUrl(file: string): string {
  return `${NAMES_REGISTRY_URL}/blob/main/projects/${encodeURIComponent(file)}`;
}

export function nameFromRow(r: NameRow): AddressName {
  return {
    name: r.name,
    kind: r.kind,
    project: { id: r.project_id, name: r.project_name, category: r.category },
    by: r.by_whom === "project" ? "project" : "ergoscan",
    via: r.via === "token" ? "token" : r.via === "template" ? "template" : "address",
    current: r.current !== false,
    until: r.until_height == null ? null : Number(r.until_height),
    file: r.file,
    fileUrl: registryFileUrl(r.file),
  };
}

/** P2PK trees share one template, so a wallet is never named by template. */
export function templateTreeOf(address: string): string | null {
  const tree = ergoTreeFromAddress(address);
  if (!tree || tree.startsWith("0008cd")) return null;
  return tree;
}

const ROW_COLS = `r.name, r.kind, r.project_id, r.project_name, r.category, r.by_whom,
                  r.until_height::text AS until_height, r.file`;

async function rows<T>(sql: string, params: unknown[]): Promise<T[]> {
  const pool = getIndexPool();
  if (!pool) return [];
  try {
    return (await pool.query(sql, params)).rows as T[];
  } catch {
    return [];
  }
}

export async function addressName(address: string): Promise<AddressName | null> {
  const direct = await rows<NameRow>(
    `SELECT ${ROW_COLS}, n.match_kind AS via, n.current
       FROM names_address n
       JOIN names_registry r ON r.match_kind = n.match_kind AND r.match_value = n.match_value
      WHERE n.address = $1`,
    [address]
  );
  if (direct[0]) return nameFromRow(direct[0]);
  const tree = templateTreeOf(address);
  if (!tree) return null;
  const hash = await ergoTreeTemplateHash(tree);
  if (!hash) return null;
  const tpl = await rows<NameRow>(
    `SELECT ${ROW_COLS}, 'template' AS via, true AS current
       FROM names_registry r
      WHERE r.match_kind = 'template' AND r.match_value = $1`,
    [hash.toLowerCase()]
  );
  return tpl[0] ? nameFromRow(tpl[0]) : null;
}

export type NamesBook = {
  commit: string | null;
  syncedAt: string | null;
  items: (AddressName & { address: string })[];
};

let bookCache: { at: number; book: NamesBook } | null = null;
const BOOK_TTL_MS = 60_000;

/** Every named address (exact and anchor). Templates are not listed: they name unbounded sets. */
export async function namesBook(): Promise<NamesBook | null> {
  if (bookCache && Date.now() - bookCache.at < BOOK_TTL_MS) return bookCache.book;
  const pool = getIndexPool();
  if (!pool) return bookCache?.book ?? null;
  try {
    const [list, meta] = await Promise.all([
      pool.query<NameRow & { address: string }>(
        `SELECT n.address, ${ROW_COLS}, n.match_kind AS via, n.current
           FROM names_address n
           JOIN names_registry r ON r.match_kind = n.match_kind AND r.match_value = n.match_value
          ORDER BY n.address`
      ),
      pool.query<{ key: string; value: string | null; updated_at: Date }>(
        `SELECT key, value, updated_at FROM names_meta WHERE key = 'commit'`
      ),
    ]);
    const book: NamesBook = {
      commit: meta.rows[0]?.value ?? null,
      syncedAt: meta.rows[0]?.updated_at ? new Date(meta.rows[0].updated_at).toISOString() : null,
      items: list.rows.map((r) => ({ address: r.address, ...nameFromRow(r) })),
    };
    bookCache = { at: Date.now(), book };
    return book;
  } catch {
    return bookCache?.book ?? null;
  }
}
