/**
 * `/v1/page/addresses` band/kind WHERE.
 * Same CASE as indexer `queryHolderBands` / `queryHolderKinds`.
 * GET reads generated `known-kinds.json` (mtime), not the web address book.
 * Selected tiles are OR (union). Empty set = All.
 */
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ADDRESS_BANDS = ["dust", "stacker", "believer", "guardian", "overlord"] as const;
export type AddressBand = (typeof ADDRESS_BANDS)[number];

export const ADDRESS_KINDS = ["protocol", "exchange", "pool", "contract"] as const;
export type AddressKind = (typeof ADDRESS_KINDS)[number];

/** Exclusive hi, nanoERG. Same literals as indexer `queryHolderBands`. */
export const BAND_SQL: Record<AddressBand, string> = {
  dust: "s.nanoerg < 100000000000",
  stacker: "s.nanoerg >= 100000000000 AND s.nanoerg < 1000000000000",
  believer: "s.nanoerg >= 1000000000000 AND s.nanoerg < 10000000000000",
  guardian: "s.nanoerg >= 10000000000000 AND s.nanoerg < 100000000000000",
  overlord: "s.nanoerg >= 100000000000000",
};

const P2PK = "(s.address LIKE '9%' AND length(s.address) < 70)";

export type KnownKindLists = {
  protocol: string[];
  exchange: string[];
  pool: string[];
};

let kindsCache: KnownKindLists | null = null;
let kindsMtime = Number.NaN;

function kindsPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../../../indexer/src/known-kinds.json");
}

export function knownKindLists(): KnownKindLists {
  const path = kindsPath();
  try {
    const mtime = statSync(path).mtimeMs;
    if (kindsCache && mtime === kindsMtime) return kindsCache;
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<KnownKindLists>;
    kindsCache = {
      protocol: Array.isArray(raw.protocol) ? raw.protocol : [],
      exchange: Array.isArray(raw.exchange) ? raw.exchange : [],
      pool: Array.isArray(raw.pool) ? raw.pool : [],
    };
    kindsMtime = mtime;
    return kindsCache;
  } catch {
    if (kindsCache) return kindsCache;
    kindsCache = { protocol: [], exchange: [], pool: [] };
    return kindsCache;
  }
}

function parts(raw: unknown): string[] {
  if (raw == null) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(",");
  return list.map((v) => String(v ?? "").trim().toLowerCase()).filter(Boolean);
}

export function parseAddressBand(raw: unknown): AddressBand | null {
  const s = String(raw ?? "").trim().toLowerCase();
  return (ADDRESS_BANDS as readonly string[]).includes(s) ? (s as AddressBand) : null;
}

export function parseAddressKind(raw: unknown): AddressKind | null {
  const s = String(raw ?? "").trim().toLowerCase();
  return (ADDRESS_KINDS as readonly string[]).includes(s) ? (s as AddressKind) : null;
}

/** Canonical order, unique. Does not collapse five bands — that needs kinds (see normalize). */
export function parseAddressBandList(raw: unknown): AddressBand[] {
  const hit = new Set(parts(raw).filter((s) => (ADDRESS_BANDS as readonly string[]).includes(s)));
  return ADDRESS_BANDS.filter((id) => hit.has(id));
}

export function parseAddressKindList(raw: unknown): AddressKind[] {
  const hit = new Set(parts(raw).filter((s) => (ADDRESS_KINDS as readonly string[]).includes(s)));
  return ADDRESS_KINDS.filter((id) => hit.has(id));
}

export function joinAddressFilter(ids: readonly string[]): string | null {
  return ids.length ? ids.join(",") : null;
}

/** Five bands already partition nanoERG>0; ∪ kind is the catalog. Empty = All. */
export function normalizeAddressFilter(
  bands: AddressBand[],
  kinds: AddressKind[]
): { bands: AddressBand[]; kinds: AddressKind[] } {
  if (bands.length === ADDRESS_BANDS.length) return { bands: [], kinds: [] };
  return { bands, kinds };
}

function asBands(opts: {
  bands?: AddressBand[] | null;
  band?: AddressBand | AddressBand[] | null;
}): AddressBand[] {
  if (opts.bands != null) return parseAddressBandList(opts.bands);
  return parseAddressBandList(opts.band ?? null);
}

function asKinds(opts: {
  kinds?: AddressKind[] | null;
  kind?: AddressKind | AddressKind[] | null;
}): AddressKind[] {
  if (opts.kinds != null) return parseAddressKindList(opts.kinds);
  return parseAddressKindList(opts.kind ?? null);
}

function kindPredicate(
  kind: AddressKind,
  lists: KnownKindLists,
  ph: (v: unknown) => string
): string {
  if (kind === "protocol") {
    return `s.address = ANY(${ph(lists.protocol)}::text[])`;
  }
  if (kind === "exchange") {
    const protocol = ph(lists.protocol);
    const exchange = ph(lists.exchange);
    return `(s.address = ANY(${exchange}::text[]) AND NOT (s.address = ANY(${protocol}::text[])))`;
  }
  if (kind === "pool") {
    const protocol = ph(lists.protocol);
    const exchange = ph(lists.exchange);
    const pool = ph(lists.pool);
    return `((s.address LIKE '88%' OR s.address = ANY(${pool}::text[])) AND NOT (s.address = ANY(${protocol}::text[])) AND NOT (s.address = ANY(${exchange}::text[])))`;
  }
  const protocol = ph(lists.protocol);
  const exchange = ph(lists.exchange);
  const pool = ph(lists.pool);
  return `(NOT ${P2PK} AND NOT (s.address = ANY(${protocol}::text[])) AND NOT (s.address = ANY(${exchange}::text[])) AND NOT (s.address LIKE '88%' OR s.address = ANY(${pool}::text[])))`;
}

export function addressListWhere(opts: {
  p2pkOnly?: boolean;
  bands?: AddressBand[] | null;
  kinds?: AddressKind[] | null;
  band?: AddressBand | AddressBand[] | null;
  kind?: AddressKind | AddressKind[] | null;
}): {
  sql: string;
  params: unknown[];
  bands: AddressBand[];
  kinds: AddressKind[];
} {
  const { bands, kinds } = normalizeAddressFilter(asBands(opts), asKinds(opts));
  const clauses = ["s.nanoerg > 0"];
  const params: unknown[] = [];
  const ph = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  if (opts.p2pkOnly) clauses.push(P2PK);

  const or: string[] = [];
  for (const id of bands) or.push(`(${BAND_SQL[id]})`);
  if (kinds.length) {
    const lists = knownKindLists();
    for (const id of kinds) or.push(kindPredicate(id, lists, ph));
  }
  if (or.length) clauses.push(`(${or.join(" OR ")})`);

  return { sql: clauses.join(" AND "), params, bands, kinds };
}

function snapN(rows: { id: string; n: number }[] | undefined, id: string): number {
  const n = Number(rows?.find((r) => r.id === id)?.n);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** Snapshot n only. Mixed band+kind → null (overlap, not a COUNT). Empty → null (All uses catalog). */
export function holderFilterTotal(
  bandsSnap:
    | {
        all?: { id: string; n: number }[];
        kinds?: { id: string; n: number }[];
      }
    | null
    | undefined,
  bands: AddressBand[],
  kinds: AddressKind[]
): number | null {
  if (!bandsSnap) return null;
  if (bands.length && kinds.length) return null;
  if (bands.length) {
    return bands.reduce((n, id) => n + snapN(bandsSnap.all, id), 0);
  }
  if (kinds.length) {
    return kinds.reduce((n, id) => n + snapN(bandsSnap.kinds, id), 0);
  }
  return null;
}
