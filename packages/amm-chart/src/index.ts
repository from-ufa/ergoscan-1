/**
 * @lumen/amm-chart — Ergo AMM candle engine (pool-mid OHLC + fill volume).
 * No Next, no wallet store. DOM wrapper: `@lumen/amm-chart/dom`.
 */
export type {
  Candle,
  ChartModel,
  Fill,
  LinePoint,
  Quote,
  Scrub,
  Slot,
  Tick,
} from "./types";
export {
  buildChartModel,
  downsampleLine,
  filterFills,
  lastMark,
  lineChange,
  markChange,
  markErgLookup,
  modelKey,
  quotePx,
  ticksToLine,
  toMs,
} from "./series";
export { fmtAxisTime, fmtPx, visibleBars } from "./format";
export {
  AXIS,
  DOWN,
  EDGE,
  PAD,
  UP,
  hitIndex,
  maxOffset,
  paintAmmChart,
  plotWidth,
  scrubFromHit,
  sliceView,
} from "./draw";
