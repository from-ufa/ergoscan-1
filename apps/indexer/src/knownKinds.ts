/**
 * Protocol / exchange / pool addresses for holder-kind counts.
 * Indexer snapshot + GET list filter (`?kind=`) read this file.
 * GET never reads the web address book.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PATH = join(dirname(fileURLToPath(import.meta.url)), "known-kinds.json");

export type KnownKindLists = {
  protocol: string[];
  exchange: string[];
  pool: string[];
};

let cache: KnownKindLists | null = null;

export function knownKindLists(): KnownKindLists {
  if (cache) return cache;
  const raw = JSON.parse(readFileSync(PATH, "utf8")) as Partial<KnownKindLists>;
  cache = {
    protocol: Array.isArray(raw.protocol) ? raw.protocol : [],
    exchange: Array.isArray(raw.exchange) ? raw.exchange : [],
    pool: Array.isArray(raw.pool) ? raw.pool : [],
  };
  return cache;
}
