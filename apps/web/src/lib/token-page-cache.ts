import { getGateway } from "./config";
import type { TokenHoldersPage } from "./list-snapshots";

const TTL_MS = 30_000;
const MAX = 24;
const PACK = 25;

type Entry = { data: TokenHoldersPage; at: number };

const map = new Map<string, Entry>();
const inflight = new Map<string, Promise<void>>();

function key(tokenId: string): string {
  return tokenId.toLowerCase();
}

export function peekTokenHolders(tokenId: string): TokenHoldersPage | null {
  const k = key(tokenId);
  const e = map.get(k);
  if (!e) return null;
  if (Date.now() - e.at > TTL_MS) {
    map.delete(k);
    return null;
  }
  map.delete(k);
  map.set(k, e);
  return e.data;
}

export function putTokenHolders(tokenId: string, data: TokenHoldersPage): void {
  if (!data || !Array.isArray(data.holders)) return;
  const k = key(tokenId);
  map.delete(k);
  map.set(k, { data, at: Date.now() });
  while (map.size > MAX) {
    const first = map.keys().next().value;
    if (first == null) break;
    map.delete(first);
  }
}

export function prefetchTokenHolders(tokenId: string): void {
  const id = (tokenId ?? "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(id)) return;
  if (peekTokenHolders(id)) return;
  if (inflight.has(id)) return;
  const params = new URLSearchParams({
    limit: String(PACK),
    offset: "0",
    dir: "desc",
  });
  const p = fetch(`${getGateway()}/v1/tokens/${id}/holders?${params}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  })
    .then(async (r) => {
      if (!r.ok) return;
      const j = (await r.json()) as TokenHoldersPage;
      putTokenHolders(id, j);
    })
    .catch(() => undefined)
    .finally(() => {
      inflight.delete(id);
    });
  inflight.set(id, p);
}
