/** Off unless the operator turns it on. Live indexer must not create or write packed tables by accident. */
export function packedWriteEnabled(): boolean {
  const v = process.env.PACKED_WRITE;
  return v === "1" || v === "true";
}

/**
 * Text copies of boxes, box_assets, tx_inputs, address_tx.
 * Default on. TEXT_CHAIN_BOXES=0 keeps blocks, transactions, tokens,
 * token_balances, and address_summary. Packed rows for the height must
 * already exist before this is turned off.
 */
export function textChainBoxesEnabled(): boolean {
  const v = process.env.TEXT_CHAIN_BOXES;
  if (v === "0" || v === "false") return false;
  return true;
}

/** Text copies of blocks and transactions. Default on. TEXT_CHAIN_HEADERS=0 keeps the catalogs. */
export function textChainHeadersEnabled(): boolean {
  const v = process.env.TEXT_CHAIN_HEADERS;
  if (v === "0" || v === "false") return false;
  return true;
}

/** Historical chunk copy. Separate from the live unit. Refuses to run without both flags. */
export function packedCopyEnabled(): boolean {
  const v = process.env.PACKED_COPY;
  return (v === "1" || v === "true") && packedWriteEnabled();
}

/** Optional tablespace name. Empty means the packed tables land in the default tablespace. */
export function packedTablespace(): string | null {
  const raw = (process.env.PACKED_TABLESPACE || "").trim();
  if (!raw) return null;
  if (!/^[a-z_][a-z0-9_]*$/.test(raw)) {
    throw new Error(`PACKED_TABLESPACE must be a plain identifier, got ${raw}`);
  }
  return raw;
}

export const PACKED_CHUNK = 1000;
export const PACKED_WAL_FLOOR_GB = 50;

/**
 * Same window as TIP_UNWIND_CAP. The copy must not write these heights:
 * the live indexer may still commit or unwind them.
 */
export const PACKED_TIP_MARGIN = 32;

/** Last height the historical copy may write. The live writer owns the rest. */
export function packedCopyCeiling(tip: number, margin = PACKED_TIP_MARGIN): number {
  if (!Number.isFinite(tip)) return 0;
  return Math.max(0, Math.floor(tip) - margin);
}
