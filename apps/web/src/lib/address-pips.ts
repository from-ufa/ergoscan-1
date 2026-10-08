import {
  ADDRESS_BOOK,
  FEE_CONTRACT,
  isLiveCexAddress,
  isRejectedCex,
  lookupAddress,
} from "./address-book";
import { isP2pkAddress } from "./address-labels";
import { bandFromNano, type HolderBandId } from "./holder-bands";
import { KIND } from "./palette";

export type ListPipId = "holder" | "exchange" | "pool" | "contract" | "protocol";
export type ListEntityId = Exclude<ListPipId, "holder">;

export const LIST_ENTITY_IDS: ListEntityId[] = ["protocol", "exchange", "pool", "contract"];

export const LIST_ENTITY_INK: Record<ListEntityId, string> = {
  protocol: KIND.protocol,
  exchange: KIND.exchange,
  pool: KIND.pool,
  contract: KIND.contract,
};

export type KindCountRow = {
  id: ListEntityId;
  n: number;
  nanoerg: string;
};

/** Smart contracts with ERG. Exchange rows are wallets, so they stay out. */
export function scriptCountFromKinds(raw: unknown): number | null {
  if (!Array.isArray(raw)) return null;
  let sum = 0;
  let seen = false;
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { id?: unknown; n?: unknown };
    const id = String(rec.id ?? "");
    if (id !== "protocol" && id !== "pool" && id !== "contract") continue;
    const n = Number(rec.n);
    if (!Number.isFinite(n) || n < 0) continue;
    seen = true;
    sum += Math.round(n);
  }
  return seen ? sum : null;
}

export function mergeKinds(raw: unknown): KindCountRow[] {
  const byId = new Map<string, { n: number; nanoerg: string }>();
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const rec = row as { id?: unknown; n?: unknown; nanoerg?: unknown };
      const id = String(rec.id ?? "");
      if (!LIST_ENTITY_IDS.includes(id as ListEntityId)) continue;
      const n = Number(rec.n);
      byId.set(id, {
        n: Number.isFinite(n) && n > 0 ? Math.round(n) : 0,
        nanoerg: String(rec.nanoerg ?? "0"),
      });
    }
  }
  return LIST_ENTITY_IDS.map((id) => ({
    id,
    n: byId.get(id)?.n ?? 0,
    nanoerg: byId.get(id)?.nanoerg ?? "0",
  }));
}

export type ListPip = {
  id: ListPipId;
  band: HolderBandId | null;
  name: string | null;
  note: string | null;
};

/** Book hits that get a list pip. Built once. GET never consults this. */
const BOOK_PIP = new Map<string, Exclude<ListPipId, "holder" | "contract">>();

for (const [addr, e] of ADDRESS_BOOK) {
  if (!addr) continue;
  if (addr === FEE_CONTRACT || e.kind === "miner" || e.kind === "protocol") {
    BOOK_PIP.set(addr, "protocol");
    continue;
  }
  if (isLiveCexAddress(addr)) {
    BOOK_PIP.set(addr, "exchange");
    continue;
  }
  if (e.kind === "pool") BOOK_PIP.set(addr, "pool");
}

function isPoolScript(address: string): boolean {
  return address.startsWith("88");
}

export function listPip(address: string, nanoerg?: string | number | bigint | null): ListPip {
  const book = lookupAddress(address);
  const rejected = book != null && isRejectedCex(book);
  const name = book && !rejected ? book.name : null;
  const note = book && !rejected ? book.note ?? null : null;
  const tagged = BOOK_PIP.get(address);

  if (tagged === "protocol") return { id: "protocol", band: null, name, note };
  if (tagged === "exchange") return { id: "exchange", band: null, name, note };
  if (tagged === "pool" || isPoolScript(address)) {
    return { id: "pool", band: null, name, note };
  }
  if (!isP2pkAddress(address)) {
    return { id: "contract", band: null, name, note };
  }
  return { id: "holder", band: bandFromNano(nanoerg), name, note };
}
