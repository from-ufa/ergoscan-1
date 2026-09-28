/**
 * EIP-4 asset type (R7–R9 on the mint output) + EIP-24 v1 royalty / collection
 * on the issuer box (box_id = token_id). Hex only — no node.
 */
import { decodeRegisterMap, decodeSigmaLong } from "./registers.js";
import { ipfsPathFromHref, preferIpfsUrl } from "./ipfs-url.js";

export const NFT_KINDS = [
  "image",
  "audio",
  "video",
  "collection",
  "file",
  "membership",
] as const;

export type NftKind = (typeof NFT_KINDS)[number];

const KIND_BY_R7: Record<string, NftKind> = {
  "0101": "image",
  "0102": "audio",
  "0103": "video",
  "0104": "collection",
  "010f": "file",
  "0201": "membership",
};

export type Eip4NftMedia = {
  kind: NftKind | null;
  sha256: string | null;
  url: string | null;
  coverUrl: string | null;
  extraUrls: string[];
  ipfsCid: string | null;
};

export type Eip24Issuer = {
  royaltyPercent: number | null;
  collectionTokenId: string | null;
};

export function isNftKind(v: unknown): v is NftKind {
  return typeof v === "string" && (NFT_KINDS as readonly string[]).includes(v);
}

function hexNorm(hex: string): string {
  return hex.startsWith("0x") ? hex.slice(2).toLowerCase() : hex.toLowerCase();
}

function fromHex(hex: string): Uint8Array {
  const h = hexNorm(hex);
  const even = h.length % 2 ? h.slice(0, -1) : h;
  const out = new Uint8Array(even.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(even.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readVlq(bytes: Uint8Array, start: number): { n: number; i: number } | null {
  let n = 0;
  let shift = 0;
  let i = start;
  while (i < bytes.length) {
    const b = bytes[i]!;
    n |= (b & 0x7f) << shift;
    i += 1;
    if ((b & 0x80) === 0) return { n, i };
    shift += 7;
    if (shift > 28) return null;
  }
  return null;
}

/** Coll[Byte] payload. `0e` + unsigned VLQ length + bytes. */
export function readCollBytes(hex: string | null | undefined): Uint8Array | null {
  if (!hex) return null;
  const bytes = fromHex(hex);
  if (bytes.length < 2 || bytes[0] !== 0x0e) return null;
  const vlq = readVlq(bytes, 1);
  if (!vlq) return null;
  const { n, i } = vlq;
  if (n < 0 || i + n > bytes.length) return null;
  return bytes.slice(i, i + n);
}

function utf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/\u0000/g, "");
}

function registerHex(v: unknown): string | null {
  if (typeof v === "string" && v && !/^-?\d+$/.test(v.trim())) {
    return v.replace(/^0x/i, "");
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.serializedValue === "string") {
      return o.serializedValue.replace(/^0x/i, "");
    }
  }
  return typeof v === "string" && /^[0-9a-f]+$/i.test(v) ? v : null;
}

export function regsAsHexMap(regs: unknown): Record<string, string> {
  if (!regs || typeof regs !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(regs as Record<string, unknown>)) {
    const hex = registerHex(v);
    if (hex) out[k] = hex;
  }
  return out;
}

export function nftKindFromR7(hex: string | null | undefined): NftKind | null {
  if (!hex) return null;
  const payload = readCollBytes(hex);
  if (payload && payload.length >= 2) {
    const key = toHex(payload.slice(0, 2));
    return KIND_BY_R7[key] ?? null;
  }
  const h = hexNorm(hex).replace(/^0e0?2/, "");
  return KIND_BY_R7[h.slice(0, 4)] ?? null;
}

export function sha256FromR8(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const payload = readCollBytes(hex);
  if (payload) {
    if (payload.length === 32) return toHex(payload);
    const t = utf8(payload).trim();
    if (/^[0-9a-f]{64}$/i.test(t)) return t.toLowerCase();
  }
  const decoded = decodeRegisterMap({ R8: hex }).R8;
  const text = decoded?.text?.trim() ?? "";
  if (/^[0-9a-f]{64}$/i.test(text)) return text.toLowerCase();
  return null;
}

const MEDIA_HREF =
  /(?:ipfs:\/\/(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{40,}|bafk[a-z0-9]{40,})|https?:\/\/[^\s\x00-\x1f"'<>]{8,}|data:(?:image|audio|video)\/[a-zA-Z0-9.+-]+(?:;base64)?,[^\s\x00-\x1f"'<>]+)/gi;

function artworkHref(text: string): string | null {
  const t = text.trim().replace(/[,\]]+$/g, "");
  if (!t) return null;
  if (/^data:(?:image|audio|video)\//i.test(t)) return t;
  const ipfs = preferIpfsUrl(t);
  if (ipfs) return ipfs;
  if (/^https?:\/\//i.test(t)) return t;
  return null;
}

function hrefsFromText(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const href = artworkHref(raw);
    if (!href || seen.has(href)) return;
    seen.add(href);
    out.push(href);
  };
  // data: URLs contain commas — do not split those.
  if (/^data:/i.test(text.trim())) add(text);
  else {
    for (const part of text.split(",")) add(part);
  }
  const matches = text.match(MEDIA_HREF) ?? [];
  for (const m of matches) add(m);
  return out;
}

function collsAsUtf8(bytes: Uint8Array, start: number): string[] {
  const out: string[] = [];
  let i = start;
  while (i < bytes.length && bytes[i] === 0x0e) {
    const vlq = readVlq(bytes, i + 1);
    if (!vlq) break;
    const { n, i: j } = vlq;
    if (n < 1 || j + n > bytes.length) break;
    const t = utf8(bytes.slice(j, j + n)).trim();
    if (t) out.push(t);
    i = j + n;
  }
  // Audio R9 pair: after the typed colls, the second URL is often just VLQ+bytes.
  if (i < bytes.length && bytes[i] !== 0x0e) {
    const vlq = readVlq(bytes, i);
    if (vlq && vlq.n >= 8 && vlq.i + vlq.n <= bytes.length) {
      const t = utf8(bytes.slice(vlq.i, vlq.i + vlq.n)).trim();
      if (/^(ipfs:\/\/|https?:\/\/|data:)/i.test(t)) out.push(t);
    }
  }
  return out;
}

export function mediaHrefsFromR9(hex: string | null | undefined): string[] {
  if (!hex) return [];
  const bytes = fromHex(hex);
  const seen = new Set<string>();
  const out: string[] = [];
  const addAll = (texts: string[]) => {
    for (const t of texts) {
      for (const href of hrefsFromText(t)) {
        const cid = ipfsCidFromHref(href);
        if (cid && (/ipfs/i.test(cid) || (cid.startsWith("baf") && /[A-Z]/.test(cid)))) {
          continue;
        }
        if (seen.has(href)) continue;
        seen.add(href);
        out.push(href);
      }
    }
  };
  addAll(collsAsUtf8(bytes, 0));
  addAll(collsAsUtf8(bytes, 1));
  addAll(collsAsUtf8(bytes, 2));
  addAll([utf8(bytes)]);
  const decoded = decodeRegisterMap({ R9: hex }).R9;
  if (decoded?.text) addAll([decoded.text]);
  return out;
}

export function ipfsCidFromHref(url: string | null | undefined): string | null {
  const path = ipfsPathFromHref(url);
  if (path) return path.split("/")[0] ?? null;
  if (!url) return null;
  const t = url.trim();
  const m =
    t.match(/^ipfs:\/\/([a-zA-Z0-9]+)/i) ||
    t.match(/\/ipfs\/([a-zA-Z0-9]+)/i);
  if (m?.[1]) return m[1];
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(t) || /^baf[a-z0-9]+$/i.test(t)) {
    return t;
  }
  return null;
}

function isImageHref(url: string): boolean {
  return (
    /^data:image\//i.test(url) ||
    /\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i.test(url)
  );
}

function isAudioHref(url: string): boolean {
  return /^data:audio\//i.test(url) || /\.(mp3|ogg|wav|flac|m4a)(\?|#|$)/i.test(url);
}

function isVideoHref(url: string): boolean {
  return /^data:video\//i.test(url) || /\.(mp4|webm|mov)(\?|#|$)/i.test(url);
}

/**
 * EIP-4 R6 decimals on the issuance box. ASCII digit Coll[Byte] is often
 * one byte (`0e01` + '0'..'9'); the text decoder wants length ≥ 2.
 */
export function eip4DecimalsFromRegs(issuanceRegs: unknown): number | null {
  let raw = issuanceRegs;
  if (typeof raw === "string" && raw) {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const hexMap = regsAsHexMap(raw);
  const hex = hexMap.R6?.toLowerCase() ?? "";
  const t = decodeRegisterMap(hexMap).R6?.text?.trim() ?? "";
  if (/^\d{1,2}$/.test(t)) return Number(t);
  if (/^0e01[0-9a-f]{2}$/.test(hex)) {
    const n = parseInt(hex.slice(4), 16);
    if (n >= 0x30 && n <= 0x39) return n - 0x30;
  }
  return null;
}

export function eip4MediaFromRegs(issuanceRegs: unknown): Eip4NftMedia {
  const hex = regsAsHexMap(issuanceRegs);
  const kind = nftKindFromR7(hex.R7 ?? null);
  const sha256 = sha256FromR8(hex.R8 ?? null);
  const hrefs = mediaHrefsFromR9(hex.R9 ?? null);
  let url = hrefs[0] ?? null;
  let coverUrl: string | null = null;
  if (kind === "audio") {
    url = hrefs.find((h) => isAudioHref(h) || !isImageHref(h)) ?? hrefs[0] ?? null;
    coverUrl = hrefs.find((h) => h !== url && isImageHref(h)) ?? hrefs.find((h) => h !== url) ?? null;
  } else if (kind === "video") {
    url = hrefs.find((h) => isVideoHref(h)) ?? hrefs[0] ?? null;
    coverUrl = hrefs.find((h) => h !== url && isImageHref(h)) ?? null;
  } else if (kind === "image") {
    url = hrefs.find((h) => isImageHref(h) || !isAudioHref(h)) ?? hrefs[0] ?? null;
    coverUrl = url;
  } else if (hrefs[0]) {
    coverUrl = hrefs.find(isImageHref) ?? null;
  }
  const extraUrls = hrefs.filter((h) => h !== url && h !== coverUrl);
  return {
    kind,
    sha256,
    url,
    coverUrl,
    extraUrls,
    ipfsCid: ipfsCidFromHref(url) ?? ipfsCidFromHref(coverUrl),
  };
}

/** Preview URL for a gallery tile: cover, else image URL. */
export function eip4PreviewUrl(media: Eip4NftMedia): string | null {
  if (media.coverUrl) return media.coverUrl;
  if (media.kind === "image") return media.url;
  if (media.url && isImageHref(media.url)) return media.url;
  return null;
}

/**
 * EIP-24 v1: issuer R4 is Int, value/10 = percent (20 → 2%, 2 → 0.2%).
 * Collection token id = issuer R7 Coll[Byte] of 32 bytes. Empty coll = none.
 * Skip if we cannot read an Int / 32-byte id — do not guess.
 */
export function eip24FromIssuerRegs(issuerRegs: unknown): Eip24Issuer {
  const hex = regsAsHexMap(issuerRegs);
  let royaltyPercent: number | null = null;
  const n = decodeSigmaLong(hex.R4 ?? null);
  if (n != null && n > 0n && n <= 100_000n) {
    royaltyPercent = Number(n) / 10;
  }
  let collectionTokenId: string | null = null;
  const coll = readCollBytes(hex.R7 ?? null);
  if (coll && coll.length === 32) {
    const id = toHex(coll);
    if (/^[0-9a-f]{64}$/.test(id)) collectionTokenId = id;
  }
  return { royaltyPercent, collectionTokenId };
}
