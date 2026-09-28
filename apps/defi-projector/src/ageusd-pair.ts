import { SIGRSV_TOKEN_ID, SIGUSD_TOKEN_ID } from "@ergoscan/shared";

export const AGEUSD_VENUE = "ageusd_bank";
export const AGEUSD_FROM_HEIGHT = 427_920;

export type BankOp = {
  tokenId: string;
  side: "mint" | "redeem";
  eventKind: "mint_usd" | "redeem_usd" | "mint_rsv" | "redeem_rsv";
  tokenRaw: number;
  ergNano: number;
};

/**
 * Bank-box deltas (created − spent). Mint: bank loses token, gains ERG.
 * Redeem: bank gains token, loses ERG. Oracle-only / mixed junk → [].
 */
export function classifyAgeUsdBankDelta(
  dErgNano: number,
  dUsd: number,
  dRsv: number
): BankOp[] {
  if (!(dUsd !== 0 || dRsv !== 0)) return [];
  if (dUsd !== 0 && dRsv !== 0 && dUsd > 0 !== dRsv > 0) return [];

  const out: BankOp[] = [];
  if (dUsd !== 0 && dErgNano !== 0) {
    const mint = dUsd < 0 && dErgNano > 0;
    const redeem = dUsd > 0 && dErgNano < 0;
    if (mint || redeem) {
      out.push({
        tokenId: SIGUSD_TOKEN_ID,
        side: mint ? "mint" : "redeem",
        eventKind: mint ? "mint_usd" : "redeem_usd",
        tokenRaw: Math.abs(dUsd),
        ergNano: Math.abs(dErgNano),
      });
    }
  }
  if (dRsv !== 0 && dErgNano !== 0) {
    const mint = dRsv < 0 && dErgNano > 0;
    const redeem = dRsv > 0 && dErgNano < 0;
    if (mint || redeem) {
      out.push({
        tokenId: SIGRSV_TOKEN_ID,
        side: mint ? "mint" : "redeem",
        eventKind: mint ? "mint_rsv" : "redeem_rsv",
        tokenRaw: Math.abs(dRsv),
        ergNano: Math.abs(dErgNano),
      });
    }
  }
  return out;
}
