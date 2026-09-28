import { getGateway } from "./config";
import type { AddressPageData } from "./list-snapshots";

const TTL_MS = 30_000;
const MAX = 24;

type Entry = { data: AddressPageData; at: number };

const map = new Map<string, Entry>();
const inflight = new Map<string, Promise<void>>();

export function peekAddressPageCache(address: string): AddressPageData | null {
  const e = map.get(address);
  if (!e) return null;
  if (Date.now() - e.at > TTL_MS) {
    map.delete(address);
    return null;
  }
  map.delete(address);
  map.set(address, e);
  return e.data;
}

export function putAddressPageCache(address: string, data: { address: string }): void {
  map.delete(address);
  map.set(address, { data: data as AddressPageData, at: Date.now() });
  while (map.size > MAX) {
    const first = map.keys().next().value;
    if (first == null) break;
    map.delete(first);
  }
}

export function prefetchAddressPage(address: string): void {
  if (!address || peekAddressPageCache(address)) return;
  if (inflight.has(address)) return;
  const p = fetch(
    `${getGateway()}/v1/page/address/${encodeURIComponent(address)}`,
    { cache: "no-store", headers: { Accept: "application/json" } }
  )
    .then(async (r) => {
      if (!r.ok) return;
      const j = (await r.json()) as AddressPageData;
      if (j && typeof j.address === "string") putAddressPageCache(j.address, j);
    })
    .catch(() => undefined)
    .finally(() => {
      inflight.delete(address);
    });
  inflight.set(address, p);
}
