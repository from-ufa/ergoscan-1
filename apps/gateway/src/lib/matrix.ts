/**
 * Matrix input-block adapter (future / devnet).
 *
 * Mainnet does NOT stream Matrix input blocks today.
 * This module is the only place that may claim source: "matrix".
 *
 * Wire a Matrix node or indexer here later; Stage PulseRail already
 * understands source === "matrix".
 */

import type { PulseSource, SubblockPulse } from "@ergoscan/shared";

export type MatrixConfig = {
  /** e.g. http://127.0.0.1:9054 — only when you run Matrix/devnet */
  url?: string;
  enabled: boolean;
};

export function matrixConfigFromEnv(): MatrixConfig {
  const url = process.env.MATRIX_NODE_URL?.replace(/\/$/, "");
  const enabled =
    process.env.MATRIX_INPUT_BLOCKS === "1" ||
    process.env.MATRIX_INPUT_BLOCKS === "true";
  return { url, enabled: Boolean(enabled && url) };
}

/**
 * Poll real Matrix IB feed — stub returns empty until wired.
 * Never invent Matrix events on mainnet.
 */
export async function pollMatrixInputBlocks(
  _cfg: MatrixConfig
): Promise<{ pulses: SubblockPulse[]; source: PulseSource } | null> {
  if (!_cfg.enabled || !_cfg.url) return null;
  // TODO: wire Matrix/devnet endpoint when available
  // Example shape when real:
  // const res = await fetch(`${_cfg.url}/…/inputBlocks`)
  return {
    source: "matrix",
    pulses: [],
  };
}
