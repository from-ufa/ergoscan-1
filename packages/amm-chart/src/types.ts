/** Portable Ergo AMM chart — types only. No React, no DOM. */

export type Quote = "usd" | "erg";

/** Downsampled pool-mid series for an area/line view. `t` is unix ms. */
export type LinePoint = { t: number; v: number };

/** Pool-mid snapshot (ranks cycle). `t` is ms or seconds. */
export type Tick = {
  t: number;
  erg: number;
  usd?: number | null;
  tvlErg?: number | null;
};

/** Spectrum fill. Price is token/ERG (same unit as tick.erg). */
export type Fill = {
  t: number;
  side?: string;
  priceErg: number;
  baseAmount: number;
  tokenAmount: number;
  poolId?: string | null;
  tokenId?: string | null;
};

export type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  prints: number;
  buyVol: number;
  sellVol: number;
};

export type Slot = {
  /** Bucket start, unix ms */
  t: number;
  mark: number | null;
  tvl: number | null;
  candle: Candle | null;
};

export type ChartModel = {
  intervalMs: number;
  quote: Quote;
  fx: number;
  slots: Slot[];
  printCount: number;
};

export type Scrub = {
  price: number;
  time: number;
  volume: number;
  prints: number;
};
