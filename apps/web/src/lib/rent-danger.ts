/** Priced or protocol tokens short on ERG. Written into snapshot_kv.rent. */

export type RentDangerRow = {
  boxId: string;
  address: string | null;
  tokenId: string;
  name: string | null;
  amount: string;
  decimals: number | null;
  priceUsd: number;
  valueNano: string;
  rentNano: string;
  shortfallNano: string;
  blocksUntilRent: number;
};

const HEX64 = /^[0-9a-f]{64}$/;

/** `null` when the field is missing. `[]` when the snapshot knows the list is empty. */
export function parseRentDanger(raw: unknown): RentDangerRow[] | null {
  if (!Array.isArray(raw)) return null;
  const out: RentDangerRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const boxId = typeof rec.boxId === "string" ? rec.boxId.trim().toLowerCase() : "";
    const tokenId = typeof rec.tokenId === "string" ? rec.tokenId.trim().toLowerCase() : "";
    if (!HEX64.test(boxId) || !HEX64.test(tokenId)) continue;
    const amount = rec.amount == null ? "" : String(rec.amount);
    if (!/^\d+$/.test(amount)) continue;
    const blocks = Math.trunc(Number(rec.blocksUntilRent));
    const price = Number(rec.priceUsd);
    const decRaw = rec.decimals == null ? null : Math.trunc(Number(rec.decimals));
    const decimals =
      decRaw != null && Number.isFinite(decRaw) && decRaw >= 0 && decRaw <= 18 ? decRaw : null;
    out.push({
      boxId,
      address: typeof rec.address === "string" && rec.address.trim() ? rec.address.trim() : null,
      tokenId,
      name: typeof rec.name === "string" && rec.name.trim() ? rec.name.trim() : null,
      amount,
      decimals,
      priceUsd: Number.isFinite(price) && price > 0 ? price : 0,
      valueNano: typeof rec.valueNano === "string" ? rec.valueNano : "0",
      rentNano: typeof rec.rentNano === "string" ? rec.rentNano : "0",
      shortfallNano: typeof rec.shortfallNano === "string" ? rec.shortfallNano : "0",
      blocksUntilRent: Number.isFinite(blocks) && blocks >= 0 ? blocks : 0,
    });
  }
  return out;
}

/** Token amount × price. Zero when the row has no price. */
export function dangerHoldingUsd(row: Pick<RentDangerRow, "amount" | "decimals" | "priceUsd">): number {
  if (!(row.priceUsd > 0)) return 0;
  const dec = row.decimals != null && row.decimals > 0 ? Math.min(18, row.decimals) : 0;
  try {
    const raw = BigInt(row.amount || "0");
    const base = 10n ** BigInt(dec);
    return (Number(raw / base) + Number(raw % base) / Number(base || 1n)) * row.priceUsd;
  } catch {
    return 0;
  }
}
