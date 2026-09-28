/**
 * Ordering-window pulse types.
 * Mainnet has no Matrix input-block stream — source is synthetic.
 */

export type PulseSource = "synthetic" | "matrix";

export type SubblockPulse = {
  id: string;
  orderingHeight: number;
  index: number;
  total: number;
  ts: number;
  phase: "provisional" | "sealed";
  windowProgress: number;
  source: PulseSource;
};

export type SubblockPlan = {
  orderingHeight: number;
  slots: number;
  windowStartTs: number;
  windowEndTs: number;
  avgIntervalMs: number;
  source: PulseSource;
};

export type SubblockSnapshot = {
  plan: SubblockPlan;
  currentIndex: number;
  pulses: SubblockPulse[];
  disclaimer: string;
};

export const SUBBLOCK_DISCLAIMER =
  "SYNTHETIC: not Matrix input blocks. Divides ~2min ordering interval into visual slots. Matrix IBs = devnet only.";
