import { longFromRegister, collLongFromRegister } from "./registers.js";

/**
 * LithosDex on Ergo — one N2T ERG↔LIT pool, miner-filled orders.
 *
 * The Solidity repo (LithosDex/lithos-smart-contracts) is a different chain.
 * IDs here are from Lithos-Client `LDHelpers` / `LFSMHelpers`.
 *
 * Mainnet pool / vault / provision NFTs in the client are placeholders until
 * genesis. Do not treat `1111…` / `2222…` / `3333…` as live. Discover the pool
 * by box shape + LIT, or set `LITHOS_POOL_NFT` after the real singleton exists.
 *
 * Pool registers: R4 remaining LP (Long), R5 feeParams Coll[Long] 3,
 * R6 pending Coll[Long] `[pendingX nanoERG, pendingY LIT raw]`,
 * R7/R8 accumulator 1e27. Box `value` = reservesX + pendingX;
 * LIT amount = reservesY + pendingY. TVL uses reserves, not pending.
 */
export const LITHOS_DEX_VENUE = "lithos_dex";

/** Mainnet LIT — real. 9 decimals (`LIT_DECIMALS = 1e9` in Lithos-Client). */
export const LIT_TOKEN_ID_MAINNET =
  "c1980d829988229516430a47a5eca376060b6ce859616db0936e78ab25cb6de7";

export const LIT_TOKEN_ID_TESTNET =
  "7b728ca02a23085f1f7093e949535938c55307ab1b61e848008201c5109bd18b";

export const LIT_DECIMALS = 9;

/** Client filler until genesis. Not a mainnet box. */
export const LITHOS_POOL_NFT_PLACEHOLDER =
  "1111111111111111111111111111111111111111111111111111111111111111";
export const LITHOS_VAULT_NFT_PLACEHOLDER =
  "2222222222222222222222222222222222222222222222222222222222222222";
export const LITHOS_PROV_TOKEN_PLACEHOLDER =
  "3333333333333333333333333333333333333333333333333333333333333333";

/** Testnet pool NFT from LDHelpers — real on testnet, not mainnet. */
export const LITHOS_POOL_NFT_TESTNET =
  "feecf867f715dc6539401736a02bd7145648b4ebe70d23205165a38e792b32a1";

/** LD_LiquidityPool CONST_LOCKED_LP. Supply is this minus R4. */
export const LITHOS_LOCKED_LP = 0x7fffffffffffffffn;

/**
 * Shared head of the live pool ErgoTree. Constants (token ids) differ after
 * this, so full trees are not equal. Used to seek new pools without a LIT id.
 */
export const LITHOS_POOL_TREE_HEAD = "1bbe10650400040204020404";

const HEX64 = /^[0-9a-f]{64}$/;

const PLACEHOLDERS = new Set([
  LITHOS_POOL_NFT_PLACEHOLDER,
  LITHOS_VAULT_NFT_PLACEHOLDER,
  LITHOS_PROV_TOKEN_PLACEHOLDER,
  "0".repeat(64),
]);

export function isLithosPlaceholderId(id: string | null | undefined): boolean {
  if (!id) return false;
  return PLACEHOLDERS.has(id.trim().toLowerCase());
}

export function isLitTokenId(id: string | null | undefined): boolean {
  const t = String(id || "")
    .trim()
    .toLowerCase();
  return t === LIT_TOKEN_ID_MAINNET || t === LIT_TOKEN_ID_TESTNET;
}

export function lithosTokenYFromEnv(
  raw: string | null | undefined = process.env.LITHOS_TOKEN_Y
): string {
  const id = String(raw || "")
    .trim()
    .toLowerCase();
  if (HEX64.test(id) && !isLithosPlaceholderId(id)) return id;
  return LIT_TOKEN_ID_MAINNET;
}

/**
 * Real singleton after genesis. Rejects placeholders and junk.
 * Empty / unset → caller must discover by LIT + 3-asset pool shape.
 */
export function lithosPoolNftFromEnv(
  raw: string | null | undefined = process.env.LITHOS_POOL_NFT
): string | null {
  const id = String(raw || "")
    .trim()
    .toLowerCase();
  if (!HEX64.test(id) || isLithosPlaceholderId(id)) return null;
  return id;
}

export function lithosEnabledFromEnv(
  raw: string | null | undefined = process.env.LITHOS_ENABLED
): boolean {
  const v = String(raw ?? "1")
    .trim()
    .toLowerCase();
  return v !== "0" && v !== "false" && v !== "off";
}

/** Raw token / nano amounts. LIT emission is 1e18 — above Number.MAX_SAFE_INTEGER. */
export function asLithosBigInt(v: unknown): bigint | null {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));
  if (typeof v === "string") {
    const s = v.trim();
    if (/^-?\d+$/.test(s)) return BigInt(s);
  }
  return null;
}

/** Whole + frac so a 1e18 raw amount does not go through Number() first. */
export function lithosRawToDecimal(raw: bigint, decimals: number): number {
  const d = Math.max(0, Math.min(18, Math.floor(decimals)));
  const base = 10n ** BigInt(d);
  const neg = raw < 0n;
  const n = neg ? -raw : raw;
  const whole = n / base;
  const frac = n % base;
  const x = Number(whole) + Number(frac) / Number(base);
  return neg ? -x : x;
}

export function lithosNanoToErg(nano: bigint): number {
  return lithosRawToDecimal(nano, 9);
}

export type LithosAsset = {
  tokenId: string;
  amount: number | string | bigint;
  emission?: number | null;
};

export type LithosPoolParts = {
  nft: string;
  lit: string;
  prov: string;
};

/**
 * Pool box: tokens(0) NFT amt=1, tokens(1) LIT, tokens(2) provision.
 * `box_assets` has no index, so match by amount / LIT id, not token order.
 */
export function pickLithosPoolAssets(
  assets: readonly LithosAsset[],
  litId: string = LIT_TOKEN_ID_MAINNET
): LithosPoolParts | null {
  const lit = litId.trim().toLowerCase();
  if (!HEX64.test(lit)) return null;
  const rows = assets
    .map((a) => ({
      tokenId: String(a.tokenId || "")
        .trim()
        .toLowerCase(),
      amount: asLithosBigInt(a.amount) ?? -1n,
      emission: a.emission == null ? null : Number(a.emission),
    }))
    .filter((a) => HEX64.test(a.tokenId) && a.amount > 0n);
  if (rows.length !== 3) return null;
  const ids = new Set(rows.map((a) => a.tokenId));
  if (ids.size !== 3) return null;

  const litRow = rows.find((a) => a.tokenId === lit);
  if (!litRow || !(litRow.amount > 1n)) return null;

  const nftRow =
    rows.find(
      (a) =>
        a.tokenId !== lit &&
        a.amount === 1n &&
        (a.emission == null || a.emission === 1)
    ) ?? null;
  if (!nftRow || isLithosPlaceholderId(nftRow.tokenId)) return null;

  const provRow = rows.find(
    (a) => a.tokenId !== lit && a.tokenId !== nftRow.tokenId
  );
  if (!provRow || !(provRow.amount > 1n)) return null;
  if (isLithosPlaceholderId(provRow.tokenId)) return null;

  return { nft: nftRow.tokenId, lit, prov: provRow.tokenId };
}

/**
 * Any Lithos N2T pool: NFT + quote reserve + provision.
 * LIT boxes stay on `pickLithosPoolAssets`. Other quotes: the token that still
 * holds most of its own emission on the box is provision, the other is the quote.
 */
export function pickLithosPoolShape(
  assets: readonly LithosAsset[]
): LithosPoolParts | null {
  const asLit = pickLithosPoolAssets(assets);
  if (asLit) return asLit;
  const rows = assets
    .map((a) => ({
      tokenId: String(a.tokenId || "")
        .trim()
        .toLowerCase(),
      amount: asLithosBigInt(a.amount) ?? -1n,
      emission: asLithosBigInt(a.emission),
    }))
    .filter((a) => HEX64.test(a.tokenId) && a.amount > 0n);
  if (rows.length !== 3) return null;
  const ids = new Set(rows.map((a) => a.tokenId));
  if (ids.size !== 3) return null;
  const nftRow =
    rows.find(
      (a) => a.amount === 1n && (a.emission == null || a.emission === 1n)
    ) ?? null;
  if (!nftRow || isLithosPlaceholderId(nftRow.tokenId)) return null;
  const rest = rows.filter((a) => a.tokenId !== nftRow.tokenId && a.amount > 1n);
  if (rest.length !== 2) return null;
  const [x, y] = rest;
  if (!x || !y) return null;
  const xShare = emissionShare(x.amount, x.emission);
  const yShare = emissionShare(y.amount, y.emission);
  const prov = xShare >= yShare ? x : y;
  const quote = prov === x ? y : x;
  if (isLithosPlaceholderId(prov.tokenId) || isLithosPlaceholderId(quote.tokenId)) {
    return null;
  }
  return { nft: nftRow.tokenId, lit: quote.tokenId, prov: prov.tokenId };
}

function emissionShare(amount: bigint, emission: bigint | null): number {
  if (emission == null || emission <= 0n) return Number(amount);
  const whole = amount / emission;
  const frac = amount % emission;
  return Number(whole) + Number(frac) / Number(emission > 0n ? emission : 1n);
}

export type LithosPoolSnap = {
  reservesX: bigint;
  reservesY: bigint;
  pendingX: bigint;
  pendingY: bigint;
  supply: bigint;
};

export type LithosPending = {
  pendingX: bigint;
  pendingY: bigint;
};

/**
 * R6 Coll[Long] `[pendingX, pendingY]`. Fees sitting in the box, not LP reserves.
 * Missing / short / negative → null (caller keeps full box value as ERG side).
 */
export function lithosPendingFromRegs(regs: unknown): LithosPending | null {
  if (!regs || typeof regs !== "object" || Array.isArray(regs)) return null;
  const coll = collLongFromRegister((regs as Record<string, unknown>).R6);
  if (!coll || coll.length < 2) return null;
  const pendingX = coll[0]!;
  const pendingY = coll[1]!;
  if (pendingX < 0n || pendingY < 0n) return null;
  return { pendingX, pendingY };
}

/**
 * Reserves + LP supply from the spent/created pool box.
 * Needs R4 (remaining LP). Missing R4 → null, caller uses box-delta + provision.
 */
export function lithosPoolSnapFromBox(
  valueNano: bigint | number | string,
  litRaw: bigint | number | string,
  regs: unknown
): LithosPoolSnap | null {
  const x = asLithosBigInt(valueNano);
  const y = asLithosBigInt(litRaw);
  if (x == null || y == null || x < 0n || y < 0n) return null;
  if (!regs || typeof regs !== "object" || Array.isArray(regs)) return null;
  const r4 = longFromRegister((regs as Record<string, unknown>).R4);
  if (r4 == null || r4 < 0n || r4 > LITHOS_LOCKED_LP) return null;
  const pending = lithosPendingFromRegs(regs);
  const pendingX = pending?.pendingX ?? 0n;
  const pendingY = pending?.pendingY ?? 0n;
  if (pendingX > x || pendingY > y) return null;
  return {
    reservesX: x - pendingX,
    reservesY: y - pendingY,
    pendingX,
    pendingY,
    supply: LITHOS_LOCKED_LP - r4,
  };
}

export type LithosSwap = {
  ergIn: boolean;
  amountIn: bigint;
  amountOut: bigint;
};

/**
 * Lithos-Client `LDBoxes.classifySwap`: supply unchanged + opposite reserves.
 * `amountIn` is the reserve increase plus pending fee on that side.
 */
export function classifyLithosSwap(
  prev: LithosPoolSnap,
  next: LithosPoolSnap
): LithosSwap | null {
  const dX = next.reservesX - prev.reservesX;
  const dY = next.reservesY - prev.reservesY;
  if (next.supply !== prev.supply) return null;
  if (dX > 0n && dY < 0n) {
    return {
      ergIn: true,
      amountIn: dX + (next.pendingX - prev.pendingX),
      amountOut: -dY,
    };
  }
  if (dY > 0n && dX < 0n) {
    return {
      ergIn: false,
      amountIn: dY + (next.pendingY - prev.pendingY),
      amountOut: -dX,
    };
  }
  return null;
}

/**
 * Box-balance form when registers are not decoded.
 * Swap: opposite ERG/LIT, provision token unchanged (deposit/redeem move it).
 * On a swap the fee sits on the input side, so the incoming box-balance
 * increase equals Lithos `amountIn`.
 */
export function classifyLithosBoxDelta(
  dErgNano: bigint | number | string,
  dLit: bigint | number | string,
  dProv: bigint | number | string
): LithosSwap | null {
  const dErg = asLithosBigInt(dErgNano);
  const dY = asLithosBigInt(dLit);
  const dP = asLithosBigInt(dProv);
  if (dErg == null || dY == null || dP == null) return null;
  if (dP !== 0n) return null;
  if (!(dErg !== 0n && dY !== 0n)) return null;
  if (dErg > 0n === dY > 0n) return null;
  if (dErg > 0n && dY < 0n) {
    return { ergIn: true, amountIn: dErg, amountOut: -dY };
  }
  return { ergIn: false, amountIn: dY, amountOut: -dErg };
}

/** Prefer register classify; fall back to box Δ when R4 is missing. */
export function classifyLithosFill(
  prevBox: {
    valueNano: bigint | number | string;
    litRaw: bigint | number | string;
    regs: unknown;
  },
  nextBox: {
    valueNano: bigint | number | string;
    litRaw: bigint | number | string;
    regs: unknown;
  },
  dProv: bigint | number | string
): LithosSwap | null {
  const prev = lithosPoolSnapFromBox(prevBox.valueNano, prevBox.litRaw, prevBox.regs);
  const next = lithosPoolSnapFromBox(nextBox.valueNano, nextBox.litRaw, nextBox.regs);
  if (prev && next) return classifyLithosSwap(prev, next);
  const dErg = (asLithosBigInt(nextBox.valueNano) ?? 0n) - (asLithosBigInt(prevBox.valueNano) ?? 0n);
  const dLit = (asLithosBigInt(nextBox.litRaw) ?? 0n) - (asLithosBigInt(prevBox.litRaw) ?? 0n);
  return classifyLithosBoxDelta(dErg, dLit, dProv);
}

export type LithosOutBox = {
  boxId: string;
  address: string | null;
  valueNano: bigint | number | string;
  litRaw: bigint | number | string;
};

function isP2pk(addr: string | null | undefined): addr is string {
  return !!addr && addr.startsWith("9") && addr.length >= 50 && addr.length <= 60;
}

/**
 * Miner-filled Lithos tx: first P2PK in address_tx is often the miner.
 * Trader is the P2PK output that received the out asset (LIT on buy, ERG on sell),
 * closest to `amountOut`, not the new pool box.
 */
export function pickLithosCounterparty(opts: {
  poolOutBox: string;
  ergIn: boolean;
  amountOut: bigint | number | string;
  outputs: readonly LithosOutBox[];
}): string | null {
  const target = asLithosBigInt(opts.amountOut);
  if (target == null || target <= 0n) return null;
  const pool = String(opts.poolOutBox || "");
  const scored: Array<{ address: string; delta: bigint }> = [];
  for (const o of opts.outputs) {
    if (!o || o.boxId === pool || !isP2pk(o.address)) continue;
    const got = opts.ergIn ? asLithosBigInt(o.litRaw) : asLithosBigInt(o.valueNano);
    if (got == null || got <= 0n) continue;
    const delta = got > target ? got - target : target - got;
    scored.push({ address: o.address, delta });
  }
  scored.sort((a, b) => (a.delta < b.delta ? -1 : a.delta > b.delta ? 1 : 0));
  const best = scored[0];
  if (!best) return null;
  if (best.delta > target) return null;
  return best.address;
}
