/**
 * AgeUSD / SigmaUSD bank — not a Spectrum pool.
 * Mint/redeem must not land on the DEX tape. T2T detect uses the same list.
 */
import { SIGMAUSD_BANK_ADDRESS } from "./lock-addresses.js";

/** Production AgeUSD v2 bank NFT (`SUSD Bank V2 NFT`). */
export const AGEUSD_BANK_V2_NFT =
  "7d672d1def471720ca5782fd6473e47e796d9ac0c138d9911346f118b2f6d9d9";

/** SigUSD (2 decimals). */
export const SIGUSD_TOKEN_ID =
  "03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04";

/** SigRSV (0 decimals). */
export const SIGRSV_TOKEN_ID =
  "003bd19d0187117f130b62e1bcab0939929ff5c7709f843c5c4dd158949285d0";

/** Bank NFTs (v2 + earlier test / v1). Not update-ballot NFTs. */
export const AGEUSD_BANK_NFTS = [
  AGEUSD_BANK_V2_NFT,
  "027e094309e6a3055a7ddfe49238ac9d99c4fd1edaaea33d4c47f86becd1f08f",
  "1c648386f0529cc44c367cf941ede13533223f97b4560a0b31fa3ef668c3be62",
  "22d27990f062c259d2fabdbf689c5e2721ebbbd789b84b65c5f44b546915dab6",
] as const;

const BANK_NFT = new Set(AGEUSD_BANK_NFTS.map((id) => id.toLowerCase()));

export function isAgeUsdBankNft(id: string | null | undefined): boolean {
  if (!id) return false;
  return BANK_NFT.has(id.trim().toLowerCase());
}

export function isAgeUsdBankAddress(addr: string | null | undefined): boolean {
  return Boolean(addr && addr === SIGMAUSD_BANK_ADDRESS);
}

export function withoutAgeUsdBankNfts(ids: readonly string[]): string[] {
  return ids.filter((id) => !isAgeUsdBankNft(id));
}

/** Fixed EIP-4 max supply on the live V2 tokens (raw units). */
export const AGEUSD_SC_MAX_RAW = 10_000_000_000_000;
export const AGEUSD_RC_MAX_RAW = 10_000_000_000_000;
export const AGEUSD_SC_DECIMALS = 2;
/** Contract bounds (EIP-15 / bank V2). */
export const AGEUSD_MIN_RR = 400;
export const AGEUSD_MAX_RR = 800;

export function ageUsdCircRaw(inBank: number | null | undefined, maxRaw: number): number | null {
  const held = Number(inBank);
  if (!Number.isFinite(held) || held < 0 || !(maxRaw > 0)) return null;
  return Math.max(0, maxRaw - held);
}

/**
 * Reserve ratio % = (ERG reserve × ERG/USD) / circulating SigUSD × 100.
 * Circulating SigUSD is raw/100 (2 decimals).
 */
export function ageUsdReserveRatioPercent(
  reserveNano: number | string | null | undefined,
  circScRaw: number | null,
  ergUsd: number | null | undefined
): number | null {
  const nano = Number(reserveNano);
  const circ = Number(circScRaw);
  const px = Number(ergUsd);
  if (!(nano > 0) || !(circ > 0) || !(px > 0)) return null;
  const reserveUsd = (nano / 1e9) * px;
  const liabilitiesUsd = circ / 10 ** AGEUSD_SC_DECIMALS;
  if (!(reserveUsd > 0) || !(liabilitiesUsd > 0)) return null;
  return (reserveUsd / liabilitiesUsd) * 100;
}

export type AgeUsdBand = "below" | "in" | "above";

export function ageUsdBand(rr: number | null): AgeUsdBand | null {
  if (rr == null || !Number.isFinite(rr)) return null;
  if (rr < AGEUSD_MIN_RR) return "below";
  if (rr > AGEUSD_MAX_RR) return "above";
  return "in";
}

/** Current-state gates (sigmausd.io / EIP-15). Redeem SigUSD is always open. */
export function ageUsdGates(rr: number | null): {
  mintUsd: boolean;
  redeemUsd: boolean;
  mintRsv: boolean;
  redeemRsv: boolean;
} {
  if (rr == null || !Number.isFinite(rr)) {
    return { mintUsd: false, redeemUsd: true, mintRsv: false, redeemRsv: false };
  }
  return {
    mintUsd: rr >= AGEUSD_MIN_RR,
    redeemUsd: true,
    mintRsv: rr <= AGEUSD_MAX_RR,
    redeemRsv: rr >= AGEUSD_MIN_RR,
  };
}

export function ageUsdPrices(
  reserveNano: number | string | null | undefined,
  circScRaw: number | null,
  circRcRaw: number | null,
  ergUsd: number | null | undefined
): {
  sigUsdUsd: number | null;
  sigUsdErg: number | null;
  sigRsvUsd: number | null;
  sigRsvErg: number | null;
} {
  const px = Number(ergUsd);
  if (!(px > 0)) {
    return { sigUsdUsd: null, sigUsdErg: null, sigRsvUsd: null, sigRsvErg: null };
  }
  const sigUsdUsd = 1;
  const sigUsdErg = 1 / px;
  const nano = Number(reserveNano);
  const circSc = Number(circScRaw);
  const circRc = Number(circRcRaw);
  if (!(nano > 0) || !(circSc >= 0) || !(circRc > 0)) {
    return { sigUsdUsd, sigUsdErg, sigRsvUsd: null, sigRsvErg: null };
  }
  const reserveUsd = (nano / 1e9) * px;
  const liabUsd = circSc / 10 ** AGEUSD_SC_DECIMALS;
  const equityUsd = Math.max(0, reserveUsd - liabUsd);
  const sigRsvUsd = equityUsd / circRc;
  return {
    sigUsdUsd,
    sigUsdErg,
    sigRsvUsd,
    sigRsvErg: sigRsvUsd / px,
  };
}

/**
 * EIP-15 / bank V2: rate = oracle R4 / 100 (nanoERG per cent).
 * RR% = reserve × 100 / (scCirc × rate). Prices are nominal (no 2% fee).
 */
export function snapshotAgeUsdFromOracle(input: {
  reserveNano?: string | number | null;
  scCircRaw?: number | null;
  rcCircRaw?: number | null;
  nanoPerUsd?: number | null;
}): ReturnType<typeof snapshotAgeUsd> {
  const reserve = Number(input.reserveNano);
  const scCirc = Number(input.scCircRaw);
  const rcCirc = Number(input.rcCircRaw);
  const nanoPerUsd = Number(input.nanoPerUsd);
  if (!(reserve > 0) || !(scCirc > 0) || !(nanoPerUsd > 0)) {
    return snapshotAgeUsd({
      reserveNano: input.reserveNano,
      sigUsdInBank: null,
      sigRsvInBank: null,
      ergUsd: nanoPerUsd > 0 ? 1e9 / nanoPerUsd : null,
    });
  }
  const rate = nanoPerUsd / 100;
  const needed = scCirc * rate;
  const reserveRatio = needed > 0 ? (reserve * 100) / needed : null;
  const liabilities = Math.min(reserve, needed);
  const equity = Math.max(0, reserve - liabilities);
  const ergUsd = 1e9 / nanoPerUsd;
  const sigUsdErg = nanoPerUsd / 1e9;
  const sigRsvErg = rcCirc > 0 ? equity / rcCirc / 1e9 : null;
  return {
    reserveRatio,
    band: ageUsdBand(reserveRatio),
    circUsd: scCirc / 10 ** AGEUSD_SC_DECIMALS,
    circRsv: Number.isFinite(rcCirc) ? rcCirc : null,
    ...ageUsdGates(reserveRatio),
    sigUsdUsd: 1,
    sigUsdErg,
    sigRsvUsd: sigRsvErg != null ? sigRsvErg * ergUsd : null,
    sigRsvErg,
  };
}

export function snapshotAgeUsd(input: {
  reserveNano?: string | number | null;
  sigUsdInBank?: number | null;
  sigRsvInBank?: number | null;
  ergUsd?: number | null;
}): {
  reserveRatio: number | null;
  band: AgeUsdBand | null;
  circUsd: number | null;
  circRsv: number | null;
  mintUsd: boolean;
  redeemUsd: boolean;
  mintRsv: boolean;
  redeemRsv: boolean;
  sigUsdUsd: number | null;
  sigUsdErg: number | null;
  sigRsvUsd: number | null;
  sigRsvErg: number | null;
} {
  const circSc = ageUsdCircRaw(input.sigUsdInBank, AGEUSD_SC_MAX_RAW);
  const circRc = ageUsdCircRaw(input.sigRsvInBank, AGEUSD_RC_MAX_RAW);
  const reserveRatio = ageUsdReserveRatioPercent(input.reserveNano, circSc, input.ergUsd);
  const prices = ageUsdPrices(input.reserveNano, circSc, circRc, input.ergUsd);
  return {
    reserveRatio,
    band: ageUsdBand(reserveRatio),
    circUsd: circSc != null ? circSc / 10 ** AGEUSD_SC_DECIMALS : null,
    circRsv: circRc,
    ...ageUsdGates(reserveRatio),
    ...prices,
  };
}

/** Trusted hex constants only — safe in SQL IN (). */
export function sqlNotAgeUsdBankPool(column: string): string {
  if (!/^[a-z_][a-z0-9_.]*$/i.test(column)) {
    throw new Error("sqlNotAgeUsdBankPool: bad column");
  }
  const list = AGEUSD_BANK_NFTS.map((id) => `'${id}'`).join(", ");
  return `(${column} IS NULL OR lower(${column}) NOT IN (${list}))`;
}
