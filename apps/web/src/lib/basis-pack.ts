import { MINERS_FEE_ADDRESS } from "@ergoscan/shared";
import { getGateway } from "./config";
import type { BasisReserve, BasisSnap } from "./list-snapshots";

type Io = { address?: string | null; value?: string | number | null };
type PoolRow = { baseId?: string; quoteId?: string; lastPrice?: number; volume?: number };

function isErgId(id: string): boolean {
  return id === "ERG" || /^0+$/.test(id);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(url: string): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.status === 429) {
        const retry = Number(r.headers.get("retry-after"));
        const sec = Number.isFinite(retry) && retry > 0 ? retry : 1 + attempt;
        await delay(Math.min(sec, 8) * 1000);
        continue;
      }
      if (!r.ok) return null;
      return (await r.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

async function runPool<T>(jobs: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const out: T[] = new Array(jobs.length);
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const i = next++;
      out[i] = await jobs[i]!();
    }
  }
  const n = Math.min(limit, jobs.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

function nanoOf(value: string | number | null | undefined): bigint {
  try {
    return BigInt(String(value ?? "0").split(".")[0] || "0");
  } catch {
    return 0n;
  }
}

/** Wallet that paid the creation transaction. The reserve script itself is not the creator. */
export function creatorFromInputs(inputs: Io[]): string | null {
  let best: { address: string; nano: bigint; p2pk: boolean } | null = null;
  for (const input of inputs) {
    const address = input.address || "";
    if (!address || address === MINERS_FEE_ADDRESS || address.length > 200) continue;
    const p2pk = address.startsWith("9") && address.length < 80;
    const nano = nanoOf(input.value);
    if (!best || (p2pk && !best.p2pk) || (p2pk === best.p2pk && nano > best.nano)) {
      best = { address, nano, p2pk };
    }
  }
  return best?.address ?? null;
}

/**
 * ERG per 1 whole token. A direct Spectrum price wins.
 * One hop is allowed: USE trades only versus CRUX, and CRUX has an ERG price.
 */
export async function ergPerToken(tokenId: string, depth = 0): Promise<number | null> {
  if (isErgId(tokenId)) return 1;
  const gw = getGateway();
  const card = await readJson(`${gw}/v1/tokens/${tokenId}`);
  const quoted = card?.price as { priceErg?: number | null } | undefined;
  if (quoted?.priceErg != null && quoted.priceErg > 0) return quoted.priceErg;
  if (depth >= 1) return null;
  const body = await readJson(`${gw}/v1/tokens/${tokenId}/pools`);
  const pools = Array.isArray(body?.pools) ? (body.pools as PoolRow[]) : [];
  const ranked = pools
    .filter((pool) => (pool.lastPrice ?? 0) > 0 && pool.baseId && pool.quoteId)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
  for (const pool of ranked) {
    const base = pool.baseId ?? "";
    const quote = pool.quoteId ?? "";
    const last = pool.lastPrice ?? 0;
    const other = base === tokenId ? quote : quote === tokenId ? base : "";
    if (!other || !(last > 0)) continue;
    const otherErg = isErgId(other) ? 1 : await ergPerToken(other, depth + 1);
    if (otherErg == null || !(otherErg > 0)) continue;
    return base === tokenId ? otherErg * last : otherErg / last;
  }
  return null;
}

function nanoAtPrice(amount: string, decimals: number, priceErg: number): string | null {
  const priceNano = BigInt(Math.round(priceErg * 1e9));
  if (priceNano <= 0n) return null;
  try {
    const raw = BigInt(amount.split(".")[0] || "0");
    const scale = 10n ** BigInt(Math.min(18, Math.max(0, Math.trunc(decimals) || 0)));
    const nano = (raw * priceNano) / scale;
    const step = 100_000n;
    return (((nano + step / 2n) / step) * step).toString();
  } catch {
    return null;
  }
}

export async function fillBasisErgValues(reserves: BasisReserve[]): Promise<BasisReserve[]> {
  const ids = [
    ...new Set(
      reserves
        .filter((row) => row.kind === "token" && row.ergValueNano == null && row.collateral?.tokenId)
        .map((row) => row.collateral!.tokenId)
    ),
  ];
  if (!ids.length) return reserves;
  const prices = new Map<string, number | null>();
  await runPool(
    ids.map((id) => async () => {
      prices.set(id, await ergPerToken(id));
    }),
    4
  );
  return reserves.map((row) => {
    if (row.kind !== "token" || row.ergValueNano != null || !row.collateral) return row;
    const price = prices.get(row.collateral.tokenId);
    if (price == null || !(price > 0)) return row;
    const nano = nanoAtPrice(row.collateral.amount, row.collateral.decimals, price);
    return nano ? { ...row, ergValueNano: nano } : row;
  });
}

/**
 * Fills creator and createdAt the public basis payload still omits.
 * A few requests at a time, so a full pack is ready before the tape is shown.
 */
export async function completeBasisPack(snap: BasisSnap | null): Promise<BasisSnap | null> {
  if (!snap?.ok || !snap.reserves?.length) return snap;
  const gw = getGateway();
  const reserves = snap.reserves.map((row) => ({ ...row }));
  const needCreator = reserves.filter((row) => row.creator === undefined);
  const heights = [
    ...new Set(
      reserves
        .filter((row) => row.createdAt == null && row.height != null)
        .map((row) => row.height as number)
    ),
  ];

  const txByBox = new Map<string, string>();
  const boxMiss = new Set<string>();
  await runPool(
    [
      ...needCreator.map((row) => async () => {
        const j = await readJson(`${gw}/v1/boxes/${row.boxId}`);
        if (!j) {
          boxMiss.add(row.boxId);
          return;
        }
        const txId = typeof j.transactionId === "string" ? j.transactionId : "";
        if (txId) txByBox.set(row.boxId, txId);
      }),
      ...heights.map((height) => async () => {
        const j = await readJson(`${gw}/v1/blocks/${height}`);
        const ts = Number(j?.timestamp);
        if (!Number.isFinite(ts)) return;
        for (const row of reserves) {
          if (row.height === height && row.createdAt == null) row.createdAt = ts;
        }
      }),
    ],
    4
  );

  const inputsByTx = new Map<string, Io[]>();
  await runPool(
    [...new Set(txByBox.values())].map((txId) => async () => {
      const j = await readJson(`${gw}/v1/transactions/${txId}`);
      if (!j) return;
      inputsByTx.set(txId, Array.isArray(j.inputs) ? (j.inputs as Io[]) : []);
    }),
    4
  );

  for (const row of needCreator) {
    if (boxMiss.has(row.boxId)) continue;
    const txId = txByBox.get(row.boxId);
    if (!txId) {
      row.creator = null;
      continue;
    }
    if (!inputsByTx.has(txId)) continue;
    row.creator = creatorFromInputs(inputsByTx.get(txId) ?? []);
  }
  return { ...snap, reserves: await fillBasisErgValues(reserves) };
}

export function basisPackReady(reserves: BasisReserve[] | undefined): boolean {
  if (!reserves?.length) return false;
  return reserves.every((row) => row.creator !== undefined);
}
