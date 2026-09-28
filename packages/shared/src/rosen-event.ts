/**
 * Decode a Rosen Event Trigger box (R4 / R5 / R7) the same way
 * @rosen-bridge/watcher-data-extractor does. Writer-only; GET reads columns.
 */
import { blake2b } from "@noble/hashes/blake2.js";
import { decodeSigmaLong, longFromRegister } from "./registers.js";
import { lookupRosenToken, type RosenTokenInfo } from "./rosen-tokens.js";

export type RosenEventStatus = "processing" | "completed" | "fraud";

export type ExtractedRosenEvent = {
  eventId: string;
  sourceTxId: string;
  fromChain: string;
  toChain: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  bridgeFee: string;
  networkFee: string;
  sourceChainTokenId: string;
  targetChainTokenId: string;
  sourceBlockId: string;
  sourceChainHeight: number | null;
  widsHash: string;
  widsCount: number | null;
};

function hexToBytes(hex: string): Uint8Array | null {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!h || h.length % 2) return null;
  if (!/^[0-9a-f]+$/i.test(h)) return null;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

/** Unsigned VLQ (collection lengths). */
export function readVlq(bytes: Uint8Array, start: number): { n: number; i: number } | null {
  let n = 0;
  let shift = 0;
  let i = start;
  while (i < bytes.length) {
    const b = bytes[i]!;
    n |= (b & 0x7f) << shift;
    i += 1;
    if ((b & 0x80) === 0) return { n, i };
    shift += 7;
    if (shift > 35) return null;
  }
  return null;
}

function utf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function decFromBytes(bytes: Uint8Array): string {
  if (!bytes.length) return "0";
  return BigInt("0x" + bytesToHex(bytes)).toString(10);
}

/**
 * Sigma Coll[Coll[Byte]]: `0c 0e` + VLQ count + (VLQ len + bytes)*n
 * Some node dumps use a single `1a` type byte for the same shape.
 */
export function parseCollCollByte(hex: string): Uint8Array[] | null {
  const raw = hexToBytes(hex);
  if (!raw || raw.length < 2) return null;
  let i = 0;
  if (raw[0] === 0x0c && raw[1] === 0x0e) i = 2;
  else if (raw[0] === 0x1a) i = 1;
  else if (raw[0] === 0x0e) return null;
  const count = readVlq(raw, i);
  if (!count || count.n > 64) return null;
  i = count.i;
  const out: Uint8Array[] = [];
  for (let k = 0; k < count.n; k++) {
    const len = readVlq(raw, i);
    if (!len || len.n > 4096 || i + (len.i - i) + len.n > raw.length) return null;
    i = len.i;
    out.push(raw.slice(i, i + len.n));
    i += len.n;
  }
  return out;
}

function registerHex(v: unknown): string | null {
  if (typeof v === "string" && /^[0-9a-f]+$/i.test(v.replace(/^0x/i, ""))) {
    return v.replace(/^0x/i, "");
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.serializedValue === "string") {
      return o.serializedValue.replace(/^0x/i, "");
    }
  }
  return null;
}

/** Node sometimes renders Coll[Coll[Byte]] as nested hex / number arrays. */
function renderedCollColl(v: unknown): Uint8Array[] | null {
  if (!v || typeof v !== "object") return null;
  const rendered = (v as { renderedValue?: unknown }).renderedValue;
  if (!Array.isArray(rendered) || rendered.length < 12) return null;
  const out: Uint8Array[] = [];
  for (const part of rendered) {
    if (typeof part === "string") {
      const asUtf = new TextEncoder().encode(part);
      if (/^[0-9a-f]+$/i.test(part) && part.length % 2 === 0 && part.length >= 8) {
        out.push(hexToBytes(part) ?? asUtf);
      } else {
        out.push(asUtf);
      }
      continue;
    }
    if (Array.isArray(part) && part.every((n) => typeof n === "number")) {
      out.push(Uint8Array.from(part as number[]));
      continue;
    }
    return null;
  }
  return out;
}

function r5Slots(regs: Record<string, unknown>): Uint8Array[] | null {
  const r5 = regs.R5 ?? regs.r5;
  const rendered = renderedCollColl(r5);
  if (rendered && rendered.length >= 12) return rendered;
  const hex = registerHex(r5);
  if (!hex) return null;
  const parsed = parseCollCollByte(hex);
  return parsed && parsed.length >= 12 ? parsed : null;
}

export function eventIdFromSourceTx(sourceTxId: string): string {
  const digest = blake2b(new TextEncoder().encode(sourceTxId), { dkLen: 32 });
  return bytesToHex(digest);
}

export function extractEventFromRegisters(regs: unknown): ExtractedRosenEvent | null {
  if (!regs || typeof regs !== "object" || Array.isArray(regs)) return null;
  const rec = regs as Record<string, unknown>;
  const slots = r5Slots(rec);
  if (!slots) return null;
  const sourceTxId = utf8(slots[0]!).trim();
  if (!sourceTxId) return null;
  const fromChain = utf8(slots[1]!).trim();
  const toChain = utf8(slots[2]!).trim();
  const fromAddress = utf8(slots[3]!).trim();
  const toAddress = utf8(slots[4]!).trim();
  if (!fromChain || !toChain) return null;
  const widsHash = extractWidsHash(rec) ?? "";
  return {
    eventId: eventIdFromSourceTx(sourceTxId),
    sourceTxId,
    fromChain,
    toChain,
    fromAddress,
    toAddress,
    amount: decFromBytes(slots[5]!),
    bridgeFee: decFromBytes(slots[6]!),
    networkFee: decFromBytes(slots[7]!),
    sourceChainTokenId: utf8(slots[8]!).trim(),
    targetChainTokenId: utf8(slots[9]!).trim(),
    sourceBlockId: utf8(slots[10]!).trim(),
    sourceChainHeight: Number(decFromBytes(slots[11]!)) || null,
    widsHash,
    widsCount: extractWidsCount(rec),
  };
}

export function extractWidsHash(regs: Record<string, unknown>): string | null {
  const r4 = regs.R4 ?? regs.r4;
  const hex = registerHex(r4);
  if (!hex) return null;
  const raw = hexToBytes(hex);
  if (!raw) return null;
  // Coll[Byte] 0e + VLQ + bytes, or raw 32-byte hash.
  if (raw[0] === 0x0e && raw.length > 2) {
    const len = readVlq(raw, 1);
    if (len && len.n > 0 && len.i + len.n <= raw.length) {
      return bytesToHex(raw.slice(len.i, len.i + len.n));
    }
  }
  return bytesToHex(raw);
}

export function extractWidsCount(regs: Record<string, unknown>): number | null {
  const r7 = regs.R7 ?? regs.r7;
  const n = longFromRegister(r7) ?? decodeSigmaLong(registerHex(r7));
  if (n == null) return null;
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 && v < 10_000 ? v : null;
}

/**
 * Reward-distribution box R4 holds the dest-chain payment tx id (utf8).
 * Empty → payment and reward are the same Ergo tx (X → Ergo).
 */
export function paymentTxIdFromRegisters(
  regs: unknown,
  spendTxId: string
): string {
  if (!regs || typeof regs !== "object" || Array.isArray(regs)) return spendTxId;
  const rec = regs as Record<string, unknown>;
  const r4 = rec.R4 ?? rec.r4;
  const hex = registerHex(r4);
  if (!hex) return spendTxId;
  const raw = hexToBytes(hex);
  if (!raw) return spendTxId;
  let bytes = raw;
  if (raw[0] === 0x0e && raw.length >= 2) {
    const len = readVlq(raw, 1);
    if (len && len.i + len.n <= raw.length) bytes = raw.slice(len.i, len.i + len.n);
  }
  let txId = utf8(bytes).replace(/\u0000/g, "").trim();
  if (!txId) return spendTxId;
  if (!/^[0-9a-zA-Z\-_.]+$/.test(txId)) {
    txId = bytesToHex(bytes);
  }
  return txId || spendTxId;
}

export function formatRosenAmount(raw: string, decimals: number): string {
  const neg = raw.startsWith("-");
  const s = (neg ? raw.slice(1) : raw).trim();
  const d = Math.max(0, Math.min(18, Number(decimals) || 0));
  if (!/^\d+$/.test(s)) return raw;
  if (d === 0) return (neg ? "-" : "") + s.replace(/^0+(?=\d)/, "");
  const pad = s.padStart(d + 1, "0");
  const i = pad.length - d;
  const whole = pad.slice(0, i).replace(/^0+(?=\d)/, "") || "0";
  const frac = pad.slice(i).replace(/0+$/, "");
  return (neg ? "-" : "") + (frac ? `${whole}.${frac}` : whole);
}

export function tokenMetaForEvent(
  fromChain: string,
  sourceChainTokenId: string
): RosenTokenInfo | null {
  return lookupRosenToken(fromChain, sourceChainTokenId);
}

/** Stored columns win when present; official map fills nulls (GET + backfill). */
export function resolveRosenTokenDisplay(
  fromChain: string,
  sourceChainTokenId: string,
  storedName?: string | null,
  storedDecimals?: number | string | null
): { name: string | null; decimals: number | null; ergoSideTokenId: string | null } {
  const meta = lookupRosenToken(fromChain, sourceChainTokenId);
  const n = storedDecimals == null || storedDecimals === "" ? NaN : Number(storedDecimals);
  const name = (storedName ?? "").trim() || meta?.name || null;
  return {
    name,
    decimals: Number.isFinite(n) ? n : (meta?.decimals ?? null),
    ergoSideTokenId: meta?.ergoSideTokenId ?? null,
  };
}
