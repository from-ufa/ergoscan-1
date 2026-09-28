import { getGateway } from "./config";
import { SNAPSHOT_FETCH } from "./keyed-enter";
import {
  BLOCK_TX_PACK,
  parseBlockCard,
  type BlockCard,
  type BlockListItem,
} from "./list-snapshots";

const byId = new Map<string, BlockListItem>();
const byHeight = new Map<number, BlockListItem>();
const cards = new Map<string, BlockCard>();
const inflight = new Map<string, Promise<void>>();

export function putBlockWindow(rows: BlockListItem[]): void {
  for (const row of rows) {
    if (!row?.id) continue;
    byId.set(row.id, row);
    if (Number.isFinite(row.height)) byHeight.set(row.height, row);
  }
}

export function peekBlockRow(idOrHeight: string): BlockListItem | null {
  const key = String(idOrHeight ?? "").trim();
  if (!key) return null;
  if (/^\d{1,12}$/.test(key)) return byHeight.get(Number(key)) ?? null;
  return byId.get(key) ?? byId.get(key.toLowerCase()) ?? null;
}

export function peekBlockAtHeight(height: number): BlockListItem | null {
  if (!Number.isFinite(height)) return null;
  return byHeight.get(height) ?? null;
}

export function matchBlockRow(row: BlockListItem, key: string): boolean {
  const k = String(key ?? "").trim();
  if (!k) return false;
  return row.id === k || row.id.toLowerCase() === k.toLowerCase() || String(row.height) === k;
}

export function putBlockCard(card: BlockCard): void {
  if (!card?.id) return;
  cards.set(card.id, card);
  cards.set(card.id.toLowerCase(), card);
  if (Number.isFinite(card.height)) cards.set(String(card.height), card);
}

export function peekBlockCard(idOrHeight: string): BlockCard | null {
  const key = String(idOrHeight ?? "").trim();
  if (!key) return null;
  return cards.get(key) ?? cards.get(key.toLowerCase()) ?? null;
}

export function prefetchBlockCard(id: string): void {
  const key = String(id ?? "").trim();
  if (!key || peekBlockCard(key)) return;
  if (inflight.has(key)) return;
  const p = fetch(
    `${getGateway()}/v1/blocks/${encodeURIComponent(key)}?limit=${BLOCK_TX_PACK}&offset=0`,
    SNAPSHOT_FETCH
  )
    .then(async (r) => {
      if (!r.ok) return;
      const next = parseBlockCard(await r.json());
      if (next) putBlockCard(next);
    })
    .catch(() => undefined)
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
}
