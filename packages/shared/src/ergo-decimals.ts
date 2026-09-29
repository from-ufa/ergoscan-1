/**
 * EIP-4 decimals for Ergo hex-64 token ids.
 * Prefer the Rosen map (and its ergo-side ids), then a small DEX extra list.
 * Returns null when unknown — callers keep DB / registry / 0 fallbacks.
 */
import { ROSEN_TOKENS, lookupRosenToken } from "./rosen-tokens.js";

const HEX64 = /^[0-9a-f]{64}$/;

/** Well-known CFMM tokens that are not in the Rosen map (Spectrum list). */
const EXTRA: Readonly<Record<string, number>> = {
  "472c3d4ecaa08fb7392ff041ee2e6af75f4a558810a74b28600549d5392810e8": 6, // NETA
  "d71693c49a84fbbecd4908c94813b46514b18b67a99952dc1e6e4791556de413": 2, // Ergopad
  "007fd64d1ee54d78dd269c8930a38286caa28d3f29d27cadcb796418ab15c283": 4, // EXLE
  "00b1e236b60b95c2c6f8007a9d89bc460fc9e78f98b09faec9449007b40bccf3": 4, // EGIO
  "00b42b41cb438c41d0139aa8432eb5eeb70d5a02d3df891f880d5fe08670c365": 4, // CRUX
  "01ddcc3d0205c2da8a067ffe047a2ccfc3e8241bc3fcc6f6ebc96b7f7363bb36": 6, // $PROXIE
  "02f31739e2e4937bb9afb552943753d1e3e9cdd1a5e5661949cb0cef93f907ea": 4, // Terahertz
  "1465c9b9de602bd75f8f38df83118e2c8b1d5b2f5518514dd1438149053652a8": 6, // DErdoge
  "7a51950e5f548549ec1aa63ffdc38279505b11e7e803d01bcf8347e0123c88b0": 8, // rsBTC
  "ba553573f83c61be880d79db0f4068177fa75ab7c250ce3543f7e7aeb471a9d2": 7, // $bass
  "cbd75cfe1a4f37f9a22eaee516300e36ea82017073036f07a09c1d2e10277cda": 9, // hodlERG3
  "e8b20745ee9d18817305f32eb21015831a48f02d40980de6e849f886dca7f807": 8, // Flux
  "c1980d829988229516430a47a5eca376060b6ce859616db0936e78ab25cb6de7": 9, // LIT
};

const EXTRA_NAMES: Readonly<Record<string, string>> = {
  "472c3d4ecaa08fb7392ff041ee2e6af75f4a558810a74b28600549d5392810e8": "NETA",
  "d71693c49a84fbbecd4908c94813b46514b18b67a99952dc1e6e4791556de413": "Ergopad",
  "36aba4b4a97b65be491cf9ebddadeca3d1d3219b6b48e6f9b60d5ae4fbb07e86": "Erdoge",
  "7ba2a85fdb302a181578b1f64cb4a533d89b3f8de4159efece75da41041537f9": "GORT",
  "d4f0192622b440afc09711aa0545eacd04d78ad3f8a063523f451e10d3d0e6ef": "MEOW",
  "0779ec04f2fae64e87418a1ad917639d4668f78484f45df962b0dec14a2591d2": "MiGoreng",
  "ae399fcb751e8e247d0da8179a2bcca2aa5119fff9c85721ffab9cdc9a3cb2dd": "DORT",
  "c1980d829988229516430a47a5eca376060b6ce859616db0936e78ab25cb6de7": "LIT",
  "e8b20745ee9d18817305f32eb21015831a48f02d40980de6e849f886dca7f807": "Flux",
  "f0cac602d618081f46db086726d3c4da53006b646b50e382989054dcf3c93bd8": "Faku",
};

export function ergoTokenDecimals(
  tokenId: string | null | undefined
): number | null {
  const id = String(tokenId || "")
    .trim()
    .toLowerCase();
  if (!HEX64.test(id)) return null;
  const extra = EXTRA[id];
  if (extra != null && Number.isFinite(extra)) return extra;
  const hit =
    ROSEN_TOKENS[id] ??
    lookupRosenToken("ergo", id) ??
    lookupRosenToken(null, id);
  if (hit && Number.isFinite(hit.decimals)) return hit.decimals;
  return null;
}

/**
 * Market ticker for a known Ergo id. Rosen `ergo:` / bare hex-64 only —
 * not a foreign-chain `rs*` prefix and not R4 from a watcher box.
 */
export function knownErgoTokenName(
  tokenId: string | null | undefined
): string | null {
  const id = String(tokenId || "")
    .trim()
    .toLowerCase();
  if (!HEX64.test(id)) return null;
  const extra = EXTRA_NAMES[id];
  if (extra) return extra;
  const hit = lookupRosenToken("ergo", id) ?? ROSEN_TOKENS[id];
  const name = hit?.name?.trim();
  return name || null;
}

export function displayErgoTokenName(
  tokenId: string | null | undefined,
  fallback?: string | null
): string | null {
  return knownErgoTokenName(tokenId) || String(fallback || "").trim() || null;
}

/** Every hex-64 id we can resolve, including decimals = 0. */
export function knownErgoTokenDecimals(): Map<string, number> {
  const out = new Map<string, number>();
  for (const [k, v] of Object.entries(ROSEN_TOKENS)) {
    if (!Number.isFinite(v.decimals)) continue;
    if (HEX64.test(k)) out.set(k, v.decimals);
    const side = (v.ergoSideTokenId || "").toLowerCase();
    if (HEX64.test(side) && !out.has(side)) out.set(side, v.decimals);
  }
  for (const [k, d] of Object.entries(EXTRA)) out.set(k, d);
  return out;
}
