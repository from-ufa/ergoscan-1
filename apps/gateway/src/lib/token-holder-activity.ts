/**
 * Token page holders tape: txs / first / last are this token, not address_summary.
 * Pack join address_tx ∩ token_tx_seen. Skip long P2S and address-wide whales
 * (hash join of their address_tx vs a fat token_tx_seen times out).
 */
export const TOKEN_HOLDER_ADDR_BTREE = 200;
/**
 * Pack COUNT nestloops address_tx → token_tx_seen PK. Above this, one mixer
 * (Lambo 78k / 448k) makes the whole tape time out and blanks every Txs cell.
 */
export const TOKEN_HOLDER_ADDR_TX_CAP = 12_000;

export function leanTokenHolderAddresses(
  addresses: string[],
  addrTxCount: ReadonlyMap<string, number>
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of addresses) {
    const a = raw.trim();
    if (!a || seen.has(a)) continue;
    seen.add(a);
    if (a.length > TOKEN_HOLDER_ADDR_BTREE) continue;
    const n = addrTxCount.get(a);
    if (n != null && n >= TOKEN_HOLDER_ADDR_TX_CAP) continue;
    out.push(a);
  }
  return out;
}

/** Long P2S and address-wide whales: no GET COUNT. First/last fall back to token_balances heights. */
export function skippedTokenHolderAddresses(
  addresses: string[],
  addrTxCount: ReadonlyMap<string, number>
): string[] {
  const lean = new Set(leanTokenHolderAddresses(addresses, addrTxCount));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of addresses) {
    const a = raw.trim();
    if (!a || seen.has(a) || lean.has(a)) continue;
    seen.add(a);
    out.push(a);
  }
  return out;
}
