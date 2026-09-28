export const ADDR_TOKEN_TAPE = 80;

/** Same rule as address NFT tape: EIP-4 emission=1, or a single 0-decimal unit. */
export function nftHeldByBalance(
  emission: number | null | undefined,
  decimals: number | null | undefined,
  amount: string
): boolean {
  let qty = 0n;
  try {
    qty = BigInt(amount.split(".")[0] || "0");
  } catch {
    return false;
  }
  if (qty <= 0n) return false;
  if (emission === 1) return true;
  const em = emission ?? 1;
  const dec = decimals ?? 0;
  return em === 1 && dec === 0 && qty === 1n;
}

export type AddrTokenTapeRow = {
  tokenId: string;
  amount: string;
  amountUi: number | null;
  name: string | null;
  decimals: number;
  emission: number | null;
  artworkUrl: string | null;
  priceUsd: number | null;
  valueUsd: number | null;
  firstHeight: number | null;
  lastHeight: number | null;
  firstTs: number | null;
  lastTs: number | null;
};

export function sortAddrTokenTape(rows: AddrTokenTapeRow[]): AddrTokenTapeRow[] {
  return [...rows].sort((a, b) => {
    const av = a.valueUsd != null && a.valueUsd > 0 ? a.valueUsd : -1;
    const bv = b.valueUsd != null && b.valueUsd > 0 ? b.valueUsd : -1;
    if (av !== bv) return bv - av;
    if (a.amountUi != null && b.amountUi != null && a.amountUi !== b.amountUi) {
      return b.amountUi - a.amountUi;
    }
    try {
      const na = BigInt(a.amount);
      const nb = BigInt(b.amount);
      if (na !== nb) return na > nb ? -1 : 1;
    } catch {
      /* */
    }
    return a.tokenId.localeCompare(b.tokenId);
  });
}
