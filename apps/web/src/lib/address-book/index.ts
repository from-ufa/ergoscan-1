import exchanges from "./exchanges.json";
import overrides from "./overrides.json";
import pools from "./pools.json";
import protocol from "./protocol.json";

/**
 * Address book. Layers, in order:
 *
 * protocol.json  — consensus boxes.
 * exchanges.json — CEX mains we own (seeded from ergo.watch).
 * pools.json     — named miner-reward P2S / payout wallets. Prefix 88 is shape.
 * overrides.json — our names; always win on the same address.
 */

export type BookKind =
  | "wallet"
  | "contract"
  | "exchange"
  | "pool"
  | "miner"
  | "protocol"
  | "unknown";

export type BookEntry = {
  address: string;
  name: string;
  kind: BookKind;
  url?: string;
  note?: string;
  source?: string;
};

type BookFile = { entries?: BookEntry[] };

type CexEntry = {
  address?: string;
  role?: string;
  confidence?: string;
  source?: string;
  note?: string;
};

type CexVenue = {
  id?: string;
  name?: string;
  url?: string;
  status?: string;
  entries?: CexEntry[];
};

type CexRejected = {
  address?: string;
  name?: string;
  kind?: BookKind;
  source?: string;
  reason?: string;
};

type CexFile = {
  venues?: CexVenue[];
  rejected?: CexRejected[];
};

type PoolEntry = { address?: string; role?: string; note?: string };
type PoolVenue = { name?: string; url?: string; entries?: PoolEntry[] };
type PoolFile = { venues?: PoolVenue[] };

/** Protocol miners-fee contract. */
export const FEE_CONTRACT = protocol.fee;

const CEX_LIVE_SET = new Set<string>();
const CEX_REJECTED_SET = new Set<string>();

function venueNote(venue: CexVenue, entry: CexEntry): string | undefined {
  const bits = [
    venue.status === "dead" ? "Dead venue" : null,
    entry.confidence === "inferred" ? "Inferred" : null,
    entry.note,
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : undefined;
}

function applyExchanges(m: Map<string, BookEntry>, file: CexFile): void {
  for (const venue of file.venues ?? []) {
    const live = venue.status === "live";
    for (const entry of venue.entries ?? []) {
      const address = entry.address?.trim();
      if (!address || !venue.name) continue;
      if (live) CEX_LIVE_SET.add(address);
      m.set(address, {
        address,
        name: venue.name,
        kind: "exchange",
        url: venue.url,
        note: venueNote(venue, entry),
        source: entry.source ?? "stage",
      });
    }
  }
  for (const row of file.rejected ?? []) {
    const address = row.address?.trim();
    if (!address) continue;
    CEX_REJECTED_SET.add(address);
    m.set(address, {
      address,
      name: row.name ?? "Not a CEX main",
      kind: row.kind ?? "wallet",
      note: row.reason,
      source: row.source ?? "stage",
    });
  }
}

function applyPools(m: Map<string, BookEntry>, file: PoolFile): void {
  for (const venue of file.venues ?? []) {
    for (const entry of venue.entries ?? []) {
      const address = entry.address?.trim();
      if (!address || !venue.name) continue;
      const bits = [
        entry.role === "payout" ? "Payout wallet" : "Miner reward P2S",
        entry.note,
      ].filter(Boolean);
      m.set(address, {
        address,
        name: venue.name,
        kind: "pool",
        url: venue.url,
        note: bits.join(" · ") || undefined,
        source: "stage",
      });
    }
  }
}

function buildMap(): Map<string, BookEntry> {
  const m = new Map<string, BookEntry>();
  for (const e of protocol.entries ?? []) {
    if (!e?.address) continue;
    m.set(e.address, {
      address: e.address,
      name: e.name,
      kind: "protocol",
      note: e.note,
      source: "protocol",
    });
  }
  applyExchanges(m, exchanges as CexFile);
  applyPools(m, pools as PoolFile);
  for (const e of (overrides as BookFile).entries ?? []) {
    if (e?.address) m.set(e.address, e);
  }
  return m;
}

export const ADDRESS_BOOK = buildMap();

/** Live CEX mains. Dead venues are named on the card but omitted here. */
export const CEX_LIVE = CEX_LIVE_SET;

export function isLiveCexAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  return CEX_LIVE_SET.has(address);
}

export function lookupAddress(address: string | null | undefined): BookEntry | null {
  if (!address) return null;
  return ADDRESS_BOOK.get(address) ?? null;
}

const BOOK_NAME_MIN = 2;
const BOOK_ADDR_PREFIX = 8;
const BOOK_SEARCH_CAP = 8;

/** Client palette search. Does not hit `/v1`. */
export function searchAddressBook(q: string, limit = BOOK_SEARCH_CAP): BookEntry[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < BOOK_NAME_MIN) return [];
  const byName: BookEntry[] = [];
  const byAddr: BookEntry[] = [];
  for (const e of ADDRESS_BOOK.values()) {
    if (isRejectedCex(e)) continue;
    if (needle.length >= BOOK_ADDR_PREFIX && e.address.toLowerCase().startsWith(needle)) {
      byAddr.push(e);
      continue;
    }
    if (e.name.toLowerCase().includes(needle)) byName.push(e);
  }
  byName.sort((a, b) => {
    const sa = nameScore(a.name.toLowerCase(), needle);
    const sb = nameScore(b.name.toLowerCase(), needle);
    return sa - sb || a.name.length - b.name.length || a.name.localeCompare(b.name);
  });
  const seen = new Set<string>();
  const out: BookEntry[] = [];
  for (const e of [...byAddr, ...byName]) {
    if (seen.has(e.address)) continue;
    seen.add(e.address);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

function nameScore(name: string, needle: string): number {
  if (name === needle) return 0;
  if (name.startsWith(needle)) return 1;
  return 2;
}

export type BookDirectoryKind = "protocol" | "exchange" | "pool" | "contract" | "wallet";

export const BOOK_DIRECTORY_KINDS: BookDirectoryKind[] = [
  "protocol",
  "exchange",
  "pool",
  "contract",
  "wallet",
];

export function isRejectedCex(e: BookEntry): boolean {
  return CEX_REJECTED_SET.has(e.address) || e.name === "Not a CEX main";
}

export function directoryKind(e: BookEntry): BookDirectoryKind | null {
  if (isRejectedCex(e)) return null;
  if (e.kind === "protocol" || e.kind === "miner") return "protocol";
  if (e.kind === "exchange" || e.kind === "pool" || e.kind === "contract" || e.kind === "wallet") {
    return e.kind;
  }
  return null;
}

export type BookKindCounts = Record<"all" | BookDirectoryKind, number>;

export function countBookKinds(): BookKindCounts {
  const out: BookKindCounts = {
    all: 0,
    protocol: 0,
    exchange: 0,
    pool: 0,
    contract: 0,
    wallet: 0,
  };
  for (const e of ADDRESS_BOOK.values()) {
    const dk = directoryKind(e);
    if (!dk) continue;
    out.all += 1;
    out[dk] += 1;
  }
  return out;
}

/** Named directory for `/names`. Skips rejected CEX. Does not hit `/v1`. */
export function listBookEntries(opts?: {
  kind?: BookDirectoryKind | "all";
  q?: string;
  dir?: "asc" | "desc";
}): BookEntry[] {
  const kind = opts?.kind ?? "all";
  const q = opts?.q?.trim().toLowerCase() ?? "";
  const mul = opts?.dir === "desc" ? -1 : 1;
  const rows: BookEntry[] = [];
  for (const e of ADDRESS_BOOK.values()) {
    const dk = directoryKind(e);
    if (!dk) continue;
    if (kind !== "all" && dk !== kind) continue;
    if (q) {
      const nameHit = e.name.toLowerCase().includes(q);
      const addrHit = q.length >= BOOK_ADDR_PREFIX && e.address.toLowerCase().startsWith(q);
      if (!nameHit && !addrHit) continue;
    }
    rows.push(e);
  }
  rows.sort((a, b) => {
    const c = a.name.localeCompare(b.name) * mul;
    return c || a.address.localeCompare(b.address);
  });
  return rows;
}

export function isFeeAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  if (address === FEE_CONTRACT) return true;
  return ADDRESS_BOOK.get(address)?.kind === "miner";
}
