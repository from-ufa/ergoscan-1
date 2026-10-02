/**
 * Best-effort decode of Ergo box registers (EIP-4 / Coll[Byte] hex).
 * Not a full Sigma serializer — good enough for explorer UI.
 */

import { preferIpfsUrl } from "./ipfs-url.js";

/** Official Erg-USD / AgeUSD oracle pool NFT (explorer slug ergusd). */
export const ERG_USD_ORACLE_NFT =
  "011d3364de07e5a26f0c4eef0852cddb387039a921b7154ef3cab22c6eda887f";
/** Official Erg-USD pool token (ERGUSD-PT). Emission 15. */
export const ERGUSD_PT =
  "8c27dd9d8a35aac1e3167d58858c0a8b4059b277da790552e37eba22df9b9035";
/** Legacy v1 ERG/USD pool NFT. */
export const ERG_USD_ORACLE_NFT_V1 =
  "008a94c8c76bbaa1f0a346697d1794eb31d94b37e5533af9cc0b6932bf159339";

export const ERG_USD_ORACLE_NFTS = [ERG_USD_ORACLE_NFT, ERG_USD_ORACLE_NFT_V1];

/** USD Pool oracle token — EIP-4 name on the mint, same family as EIP-23. */
export const USD_POOL_ORACLE_NFT =
  "74fa4aee3607ceb7bdefd51a856861b5dbfa434a8f6c93bfe967de8ed1a30a78";
/** USD v2 pool NFT (explorer slug erg-usd). */
export const USD_POOL_NFT =
  "6a2b821b5727e85beb5e78b4efb9f0250d59cd48481d2ded2c23e91ba1d07c66";
/** MORACLE pool oracle NFT — EIP-4 name on the mint. */
export const MORACLE_NFT =
  "e5abaf1f0a9442123104cdf4d2d56ddd8065803e842bc6d433e712601133a9bc";
/** MORACLE pool NFT (MPOOL). */
export const MORACLE_POOL_NFT =
  "f7f008ad8fcaad4490d8e78ab6d3f11efe7213a13f7b243795818b155e1acc92";
/** XAU/ERG pool NFT (explorer slug xau-erg). */
export const GOLD_POOL_NFT =
  "3c45f29a5165b030fdb5eaf5d81f8108f9d8f507b31487dd51f4ae08fe07cf4a";
/** XAU/ERG oracle tokens, newest first. Older seats still sit in the same oracle script. */
export const GOLD_POOL_ORACLE_TOKENS = [
  "78263e5613557e129f075f0a241287e09c4204be76ad53d77d6e7feebcccb001",
  "a007e07a9d3c243e998efe1731e8be46b821109a37f1778d7e3f60ea61afeaaa",
  "6183680b1c4caaf8ede8c60dc5128e38417bc5b656321388b22baa43a9d150c2",
];

/**
 * Pool NFTs and oracle tokens of every oracle pool. Overlay matching and NFT list skip.
 * Price snapshots stay on `ERG_USD_ORACLE_NFTS` only.
 */
export const ORACLE_POOL_NFTS = [
  ...ERG_USD_ORACLE_NFTS,
  ERGUSD_PT,
  USD_POOL_NFT,
  USD_POOL_ORACLE_NFT,
  GOLD_POOL_NFT,
  ...GOLD_POOL_ORACLE_TOKENS,
  MORACLE_POOL_NFT,
  MORACLE_NFT,
];

export type RegisterKind = "empty" | "text" | "int" | "hex" | "url" | "json";

export interface DecodedRegister {
  raw: string;
  text: string | null;
  kind: RegisterKind;
}

/** Try to decode sigma-serialized Coll[Byte] / Int / Boolean hex → human string */
export function decodeRegisterHex(hex: string | null | undefined): DecodedRegister {
  if (!hex || hex === "null") return { raw: "", text: null, kind: "empty" };
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const asLong = decodeSigmaLong(h);
  if (asLong != null) return { raw: h, text: String(asLong), kind: "int" };
  // Coll[Byte]: 0e + VLQ length + bytes. Lengths over 127 are two bytes;
  // skipping only one byte leaves a stray 0x01 in front of the text.
  let bytesHex = h;
  const coll = collBytePayloadHex(h);
  if (coll != null) {
    bytesHex = coll;
  } else if (/^0c/i.test(h)) {
    bytesHex = h.slice(2);
  }
  // ensure even
  if (bytesHex.length % 2) bytesHex = bytesHex.slice(0, -1);
  try {
    const bytes = new Uint8Array(bytesHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(bytesHex.slice(i * 2, i * 2 + 2), 16);
    }
    const text = new TextDecoder("utf-8", { fatal: false })
      .decode(bytes)
      .replace(/\u0000/g, "")
      .trim();
    // Code points, not UTF-16 units — one emoji is length 2 in JS and
    // used to fail the 0.75 printable ratio (`🤡` → 1/2).
    const chars = [...text];
    const printable = chars.filter((c) => {
      const cp = c.codePointAt(0) ?? 0;
      return cp >= 32 && cp !== 127 && (cp < 128 || cp > 160);
    }).length;
    if (chars.length >= 1 && printable / chars.length > 0.75) {
      if (/^https?:\/\//i.test(text)) return { raw: h, text, kind: "url" };
      if ((text.startsWith("{") && text.endsWith("}")) || text.startsWith("[")) {
        return { raw: h, text, kind: "json" };
      }
      return { raw: h, text, kind: "text" };
    }
  } catch {
    /* */
  }
  return { raw: h, text: null, kind: "hex" };
}

function decodeVlq(bytes: number[]): bigint | null {
  let n = 0n;
  let shift = 0n;
  for (const b of bytes) {
    n |= BigInt(b & 0x7f) << shift;
    if ((b & 0x80) === 0) return n;
    shift += 7n;
    if (shift > 70n) return null;
  }
  return null;
}

function unzigzagLong(n: bigint): bigint {
  return (n >> 1n) ^ -(n & 1n);
}

/** Sigma Constant Int (04) / Long (05) + zigzag VLQ. */
export function decodeSigmaLong(hex: string | null | undefined): bigint | null {
  if (!hex) return null;
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length < 4 || h.length % 2) return null;
  const type = h.slice(0, 2).toLowerCase();
  if (type !== "04" && type !== "05") return null;
  const bytes: number[] = [];
  for (let i = 2; i < h.length; i += 2) {
    const b = parseInt(h.slice(i, i + 2), 16);
    if (!Number.isFinite(b)) return null;
    bytes.push(b);
  }
  const zig = decodeVlq(bytes);
  if (zig == null) return null;
  return unzigzagLong(zig);
}

export function flattenRegisterHex(v: unknown): string | null {
  if (typeof v === "string" && v && !/^-?\d+$/.test(v.trim())) {
    const h = v.replace(/^0x/i, "");
    return /^[0-9a-f]+$/i.test(h) ? h : null;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.serializedValue === "string") {
      const h = o.serializedValue.replace(/^0x/i, "");
      return /^[0-9a-f]+$/i.test(h) ? h : null;
    }
  }
  return typeof v === "string" && /^[0-9a-f]+$/i.test(v) ? v : null;
}

function registerHex(v: unknown): string | null {
  return flattenRegisterHex(v);
}

function hexToLongBytes(hex: string): number[] | null {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!h || h.length % 2) return null;
  const bytes: number[] = [];
  for (let i = 0; i < h.length; i += 2) {
    const b = parseInt(h.slice(i, i + 2), 16);
    if (!Number.isFinite(b)) return null;
    bytes.push(b);
  }
  return bytes;
}

function readVlqCursor(bytes: number[], cur: { at: number }): bigint | null {
  let n = 0n;
  let shift = 0n;
  while (cur.at < bytes.length) {
    const b = bytes[cur.at++]!;
    n |= BigInt(b & 0x7f) << shift;
    if ((b & 0x80) === 0) return n;
    shift += 7n;
    if (shift > 70n) return null;
  }
  return null;
}

/** Sigma Coll[Long]: `0c05` + VLQ n + n zigzag longs, or embeddable `11` (12+5). */
export function decodeSigmaCollLong(hex: string | null | undefined): bigint[] | null {
  if (!hex) return null;
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length < 4 || h.length % 2) return null;
  const bytes = hexToLongBytes(h);
  if (!bytes?.length) return null;
  let i = 0;
  if (bytes[0] === 0x0c && bytes[1] === 0x05) i = 2;
  else if (bytes[0] === 0x11) i = 1;
  else return null;
  const cur = { at: i };
  const n = readVlqCursor(bytes, cur);
  if (n == null || n < 0n || n > 32n) return null;
  const out: bigint[] = [];
  for (let k = 0; k < Number(n); k++) {
    const zig = readVlqCursor(bytes, cur);
    if (zig == null) return null;
    out.push(unzigzagLong(zig));
  }
  return out;
}

function parseLongList(raw: string): bigint[] | null {
  const s = raw.trim();
  if (!s.startsWith("[") || !s.endsWith("]")) return null;
  const inner = s.slice(1, -1).trim();
  if (!inner) return [];
  const out: bigint[] = [];
  for (const part of inner.split(",")) {
    const t = part.trim();
    if (!/^-?\d+$/.test(t)) return null;
    out.push(BigInt(t));
  }
  return out;
}

/** Node/index register that holds Coll[Long] (Lithos R6 pending, etc.). */
export function collLongFromRegister(v: unknown): bigint[] | null {
  if (Array.isArray(v)) {
    const out: bigint[] = [];
    for (const x of v) {
      if (typeof x === "bigint") out.push(x);
      else if (typeof x === "number" && Number.isFinite(x)) out.push(BigInt(Math.trunc(x)));
      else if (typeof x === "string" && /^-?\d+$/.test(x.trim())) out.push(BigInt(x.trim()));
      else return null;
    }
    return out;
  }
  if (typeof v === "string") {
    const listed = parseLongList(v);
    if (listed) return listed;
    return decodeSigmaCollLong(v);
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.renderedValue === "string") {
      const listed = parseLongList(o.renderedValue);
      if (listed) return listed;
    }
    if (Array.isArray(o.renderedValue)) return collLongFromRegister(o.renderedValue);
    const hex = registerHex(v);
    if (hex) return decodeSigmaCollLong(hex);
  }
  return null;
}

export type SigmaConstantInfo = {
  serializedValue: string;
  sigmaType: string;
  renderedValue: string;
};

function hexToBytes(hex: string): Uint8Array | null {
  const h = hex.replace(/^0x/i, "");
  if (h.length < 2 || h.length % 2) return null;
  if (!/^[0-9a-fA-F]+$/.test(h)) return null;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    const n = parseInt(h.slice(i * 2, i * 2 + 2), 16);
    if (!Number.isFinite(n)) return null;
    out[i] = n;
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** `0e` + VLQ length + payload. Null when the register is not that shape. */
function collBytePayloadHex(hex: string): string | null {
  if (!/^0e/i.test(hex) || hex.length < 4) return null;
  const bytes = hexToBytes(hex);
  if (!bytes || bytes[0] !== 0x0e) return null;
  const len = readVlq(bytes, 1);
  if (!len || len.n < 0) return null;
  const end = len.next + len.n;
  if (end > bytes.length) return null;
  return bytesToHex(bytes.subarray(len.next, end));
}

function readVlq(bytes: Uint8Array, start: number): { n: number; next: number } | null {
  let n = 0;
  let shift = 0;
  let i = start;
  while (i < bytes.length) {
    const b = bytes[i]!;
    n |= (b & 0x7f) << shift;
    i += 1;
    if ((b & 0x80) === 0) return { n, next: i };
    shift += 7;
    if (shift > 28) return null;
  }
  return null;
}

function signedBytesList(bytes: Uint8Array): string {
  return `Coll(${[...bytes].map((b) => (b > 127 ? b - 256 : b)).join(",")})`;
}

/** Typed Sigma constant from hex. Not a full serializer — explorer UI + tests. */
export function decodeSigmaConstant(hex: string | null | undefined): SigmaConstantInfo | null {
  const raw = flattenRegisterHex(hex);
  if (!raw) return null;
  const bytes = hexToBytes(raw);
  if (!bytes || bytes.length < 1) return null;
  const tag = bytes[0]!;

  if (tag === 0x01 && bytes.length === 2) {
    return {
      serializedValue: raw,
      sigmaType: "SBoolean",
      renderedValue: bytes[1] === 1 ? "true" : "false",
    };
  }
  if (tag === 0x04 || tag === 0x05) {
    const n = decodeSigmaLong(raw);
    if (n == null) return null;
    return {
      serializedValue: raw,
      sigmaType: tag === 0x04 ? "SInt" : "SLong",
      renderedValue: n.toString(),
    };
  }
  const ge = groupElementFromRegister(raw);
  if (ge && tag === 0x07) {
    return { serializedValue: raw, sigmaType: "SGroupElement", renderedValue: ge };
  }
  if (tag === 0x08 && bytes.length >= 34) {
    const rest = bytesToHex(bytes.subarray(1));
    const pk =
      groupElementFromRegister(rest) ??
      (/^(02|03)[0-9a-f]{64}$/i.test(rest.slice(-66)) ? rest.slice(-66) : null);
    return {
      serializedValue: raw,
      sigmaType: "SSigmaProp",
      renderedValue: pk ?? rest,
    };
  }
  // Coll[Coll[SByte]] — official R4/R5: 1a01 + len + bytes
  if (tag === 0x1a && bytes.length >= 3 && bytes[1] === 0x01) {
    const len = readVlq(bytes, 2);
    if (len && len.next + len.n === bytes.length) {
      const inner = bytes.subarray(len.next);
      return {
        serializedValue: raw,
        sigmaType: "Coll[Coll[SByte]]",
        renderedValue: `[${bytesToHex(inner)}]`,
      };
    }
  }
  // Coll[SByte] 0e + VLQ len + bytes
  if (tag === 0x0e && bytes.length >= 2) {
    const len = readVlq(bytes, 1);
    if (len && len.next + len.n === bytes.length) {
      const payload = bytes.subarray(len.next);
      return {
        serializedValue: raw,
        sigmaType: "Coll[SByte]",
        renderedValue: bytesToHex(payload),
      };
    }
  }
  return {
    serializedValue: raw,
    sigmaType: "Hex",
    renderedValue: raw,
  };
}

export function decodeSigmaConstantMap(
  regs: Record<string, unknown> | null | undefined
): Record<string, SigmaConstantInfo> {
  const out: Record<string, SigmaConstantInfo> = {};
  if (!regs) return out;
  for (const [k, v] of Object.entries(regs)) {
    const info = decodeSigmaConstant(flattenRegisterHex(v));
    if (info) out[k] = info;
  }
  return out;
}

/** Sigma GroupElement (07) → 33-byte compressed pubkey hex. */
export function groupElementFromRegister(v: unknown): string | null {
  const hex = registerHex(v)?.toLowerCase();
  if (!hex) return null;
  if (hex.startsWith("07") && /^(02|03)[0-9a-f]{64}$/.test(hex.slice(2))) {
    return hex.slice(2);
  }
  if (/^(02|03)[0-9a-f]{64}$/.test(hex)) return hex;
  return null;
}

/** Node register: hex, `{ serializedValue, renderedValue }`, or decimal string. */
export function longFromRegister(v: unknown): bigint | null {
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));
  if (typeof v === "bigint") return v;
  if (typeof v === "string") {
    const s = v.trim();
    // "0430" is Sigma Int 24 (type 04 + zigzag VLQ), not decimal 430.
    const sigma = decodeSigmaLong(s);
    if (sigma != null) return sigma;
    if (/^-?\d+$/.test(s)) return BigInt(s);
    return null;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.renderedValue === "string" && /^-?\d+$/.test(o.renderedValue.trim())) {
      return BigInt(o.renderedValue.trim());
    }
    const hex = registerHex(v);
    if (hex) return decodeSigmaLong(hex);
  }
  return null;
}

/**
 * ERG/USD oracle pool box: R4 = nanoERG per 1 USD.
 * USD per ERG = 1e9 / R4.
 */
export function ergUsdFromOracleRegisters(regs: unknown): number | null {
  if (!regs || typeof regs !== "object" || Array.isArray(regs)) return null;
  const r4 = (regs as Record<string, unknown>).R4;
  const nanoPerUsd = longFromRegister(r4);
  if (nanoPerUsd == null || nanoPerUsd <= 0n) return null;
  const usd = 1e9 / Number(nanoPerUsd);
  if (!(usd >= 0.05) || usd > 50) return null;
  return usd;
}

export function decodeRegisterMap(
  regs: Record<string, string | null | undefined>
): Record<string, DecodedRegister> {
  const out: Record<string, DecodedRegister> = {};
  for (const [k, v] of Object.entries(regs)) {
    out[k] = decodeRegisterHex(v ?? null);
  }
  return out;
}

/** Heuristic: single-unit, 0 decimals EIP-4 → NFT-like */
export function isLikelyNft(meta: {
  decimals?: number | null;
  emissionAmount?: number | string | null;
  name?: string | null;
}): boolean {
  const dec = Number(meta.decimals ?? 0);
  const em = meta.emissionAmount == null ? null : Number(meta.emissionAmount);
  if (dec === 0 && em != null && em > 0 && em <= 100) return true;
  if (dec === 0 && em === 1) return true;
  return false;
}

function artworkHref(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  if (/^data:image\//i.test(t)) return t;
  const ipfs = preferIpfsUrl(t);
  if (ipfs) return ipfs;
  if (/^https?:\/\//i.test(t)) return t;
  return null;
}

export function pickArtworkUrl(
  decoded: Record<string, { text: string | null; kind: string }>
): string | null {
  for (const key of ["R9", "R8", "R7", "R5"]) {
    const d = decoded[key];
    if (!d?.text) continue;
    const href = artworkHref(d.text);
    if (href) return href;
  }
  for (const key of ["R9", "R5"]) {
    const d = decoded[key];
    if (d?.kind === "json" && d.text) {
      try {
        const j = JSON.parse(d.text) as Record<string, unknown>;
        const u = j.url || j.image || j.media || j.link;
        if (typeof u === "string") {
          const href = artworkHref(u);
          if (href) return href;
        }
      } catch {
        /* */
      }
    }
  }
  return null;
}
