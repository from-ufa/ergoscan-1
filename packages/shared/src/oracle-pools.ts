import { blake2b } from "@noble/hashes/blake2.js";
import {
  ERGUSD_PT,
  ERG_USD_ORACLE_NFT,
  groupElementFromRegister,
  longFromRegister,
} from "./registers.js";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function b58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  let n = 0n;
  for (const b of bytes) n = (n << 8n) + BigInt(b);
  let s = "";
  while (n > 0n) {
    s = `${B58[Number(n % 58n)]}${s}`;
    n /= 58n;
  }
  return `${"1".repeat(zeros)}${s}`;
}

/** Mainnet P2PK from a compressed secp256k1 pubkey. */
export function p2pkAddressFromCompressedPubkey(pubHex: string): string | null {
  const hex = pubHex.toLowerCase().replace(/^0x/, "");
  if (!/^(02|03)[0-9a-f]{64}$/.test(hex)) return null;
  const content = hexToBytes(hex);
  const payload = new Uint8Array(1 + content.length);
  payload[0] = 0x01;
  payload.set(content, 1);
  const digest = blake2b(payload, { dkLen: 32 });
  const raw = new Uint8Array(payload.length + 4);
  raw.set(payload);
  raw.set(digest.subarray(0, 4), payload.length);
  const addr = b58Encode(raw);
  return addr.startsWith("9") && addr.length >= 50 && addr.length <= 60 ? addr : null;
}

export type OracleFeedSlug = "ergusd" | "erg-usd" | "xau-erg";

export function isOracleFeedSlug(s: string): s is OracleFeedSlug {
  return s === "ergusd" || s === "erg-usd" || s === "xau-erg";
}

export type OracleFeedDef = {
  slug: OracleFeedSlug;
  pair: string;
  quote: "usd" | "xau";
  poolNft: string;
  oracleToken: string;
  /** Min blocks between pool refresh. Live: official USD=6, coop USD=6, XAU=30. */
  epochLength: number;
  minDataPoints: number;
  /** Refresh-contract constant 15. Spread cap among collected datapoints, not a Chainlink trigger. */
  maxDeviationPercent: number;
  issued: number;
  market: boolean;
};

/** Nominal Ergo block time used for oracle “ago” / heartbeat copy. */
export const ORACLE_BLOCK_MS = 120_000;

/** Official Erg-USD + cooperative USD + official gold. Writer owns all three. */
export const ORACLE_FEEDS: Record<OracleFeedSlug, OracleFeedDef> = {
  ergusd: {
    slug: "ergusd",
    pair: "ERG/USD",
    quote: "usd",
    poolNft: ERG_USD_ORACLE_NFT,
    oracleToken: ERGUSD_PT,
    epochLength: 6,
    minDataPoints: 4,
    maxDeviationPercent: 5,
    issued: 15,
    market: true,
  },
  "erg-usd": {
    slug: "erg-usd",
    pair: "ERG/USD",
    quote: "usd",
    poolNft: "6a2b821b5727e85beb5e78b4efb9f0250d59cd48481d2ded2c23e91ba1d07c66",
    oracleToken: "74fa4aee3607ceb7bdefd51a856861b5dbfa434a8f6c93bfe967de8ed1a30a78",
    epochLength: 6,
    minDataPoints: 8,
    maxDeviationPercent: 5,
    issued: 30,
    market: true,
  },
  "xau-erg": {
    slug: "xau-erg",
    pair: "XAU/ERG",
    quote: "xau",
    poolNft: "3c45f29a5165b030fdb5eaf5d81f8108f9d8f507b31487dd51f4ae08fe07cf4a",
    oracleToken: "78263e5613557e129f075f0a241287e09c4204be76ad53d77d6e7feebcccb001",
    epochLength: 30,
    minDataPoints: 8,
    maxDeviationPercent: 5,
    issued: 32,
    market: true,
  },
};

/** Quote units per 1 ERG when R4 is nanoERG per 1 quote unit. */
export function oracleQuoteFromR4(r4: bigint | null | undefined): number | null {
  if (r4 == null || r4 <= 0n) return null;
  const q = 1e9 / Number(r4);
  if (!Number.isFinite(q) || q <= 0) return null;
  return q;
}

export function oracleQuoteFromRegisters(regs: unknown): number | null {
  if (!regs || typeof regs !== "object" || Array.isArray(regs)) return null;
  return oracleQuoteFromR4(longFromRegister((regs as Record<string, unknown>).R4));
}

export function oracleEpochFromRegisters(regs: unknown): number | null {
  if (!regs || typeof regs !== "object" || Array.isArray(regs)) return null;
  const n = longFromRegister((regs as Record<string, unknown>).R5);
  if (n == null || n < 0n || n > 10_000_000n) return null;
  return Number(n);
}

export type OracleOperatorId = {
  pubKey: string | null;
  address: string | null;
  quote: number | null;
  r6Nano: string | null;
};

/** Datapoint box: R4 = oracle pubkey, R6 = nanoERG per quote unit. Not the P2S box address. */
export function oracleOperatorFromRegisters(regs: unknown): OracleOperatorId {
  const empty: OracleOperatorId = { pubKey: null, address: null, quote: null, r6Nano: null };
  if (!regs || typeof regs !== "object" || Array.isArray(regs)) return empty;
  const o = regs as Record<string, unknown>;
  const pubKey = groupElementFromRegister(o.R4);
  const address = pubKey ? p2pkAddressFromCompressedPubkey(pubKey) : null;
  const r6 = longFromRegister(o.R6);
  return {
    pubKey,
    address,
    quote: oracleQuoteFromR4(r6),
    r6Nano: r6 != null ? String(r6) : null,
  };
}

/**
 * R5 is either a numeric epoch (`n:`) or USD v1's 32-byte round id (`h:`).
 * A Coll[Byte] round id is not a Sigma long, so the height window must not decide it.
 */
export function oracleRoundKey(r5: unknown): string | null {
  const hex =
    typeof r5 === "string"
      ? r5.trim().toLowerCase()
      : r5 && typeof r5 === "object" && !Array.isArray(r5) &&
          typeof (r5 as { serializedValue?: unknown }).serializedValue === "string"
        ? (r5 as { serializedValue: string }).serializedValue.trim().toLowerCase()
        : "";
  if (/^0e20[0-9a-f]{64}$/.test(hex)) return `h:${hex.slice(4)}`;
  const n = longFromRegister(r5);
  if (n != null && n >= 0n && n <= 10_000_000n) return `n:${n.toString()}`;
  return null;
}

/** Hash rounds follow the newest seated box. Numeric rounds follow the pool epoch. */
export function oracleCurrentRound(
  seats: readonly { round: string | null; height: number | null }[],
  poolEpoch: number | null
): string | null {
  let best: { round: string; height: number } | null = null;
  for (const seat of seats) {
    if (!seat.round?.startsWith("h:")) continue;
    const height = seat.height ?? -1;
    if (!best || height > best.height) best = { round: seat.round, height };
  }
  if (best) return best.round;
  if (poolEpoch != null && Number.isFinite(poolEpoch) && poolEpoch >= 0) {
    return `n:${Math.floor(poolEpoch)}`;
  }
  return null;
}

/**
 * A known round id must match the current round.
 * A box with no round id falls back to the heartbeat height window.
 */
export function oracleSeatLive(
  round: string | null,
  current: string | null,
  fallback: {
    opEpoch: number | null;
    poolEpoch: number | null;
    opHeight: number | null;
    poolHeight: number | null;
    epochLength: number;
  }
): boolean | null {
  if (round) return current != null && round === current;
  return oracleOperatorLive(fallback);
}

/** Epoch match when both sides have it. Else: posted inside the pool's heartbeat window. */
export function oracleOperatorLive(input: {
  opEpoch: number | null;
  poolEpoch: number | null;
  opHeight: number | null;
  poolHeight: number | null;
  epochLength: number;
}): boolean | null {
  if (input.poolEpoch != null && input.opEpoch != null) {
    return input.opEpoch === input.poolEpoch;
  }
  if (input.opHeight == null || input.poolHeight == null) return null;
  if (!Number.isFinite(input.opHeight) || !Number.isFinite(input.poolHeight)) return null;
  const window = Math.max(1, Math.floor(input.epochLength) || 1);
  return Math.floor(input.opHeight) >= Math.floor(input.poolHeight) - window;
}

export function oracleAgeBlocks(
  tip: number | null | undefined,
  poolHeight: number | null | undefined
): number | null {
  if (tip == null || poolHeight == null) return null;
  if (!Number.isFinite(tip) || !Number.isFinite(poolHeight)) return null;
  if (tip < 0 || poolHeight < 0) return null;
  return Math.max(0, Math.floor(tip) - Math.floor(poolHeight));
}

/** Blocks until refresh is allowed. 0 = window open. */
export function oracleWindowLeft(
  epochLength: number,
  ageBlocks: number | null
): number | null {
  if (ageBlocks == null || !Number.isFinite(epochLength) || epochLength < 0) return null;
  return Math.max(0, Math.floor(epochLength) - ageBlocks);
}

export function tokenAmountOnBox(
  assets: { tokenId?: string; amount?: string | number }[] | undefined,
  tokenId: string
): bigint {
  const want = tokenId.toLowerCase();
  let sum = 0n;
  for (const a of assets ?? []) {
    if (String(a.tokenId ?? "").toLowerCase() !== want) continue;
    try {
      sum += BigInt(String(a.amount ?? "0"));
    } catch {
      /* */
    }
  }
  return sum;
}
