/**
 * In-RAM time series for /v1/metrics/charts.
 * Fine mempool ≈ poll interval; day series ≈ 30s buckets up to 24h.
 */

export type MempoolSample = {
  ts: number;
  count: number;
  totalSize: number;
  totalFees: number;
  p50: number;
  p90: number;
  height: number | null;
};

export type BlockPoint = {
  height: number;
  timestamp: number;
  difficulty?: string | number;
  size?: number;
  intervalSec: number | null;
  hashRateEst: number | null;
};

const FINE_MAX = 2880;
const DAY_MAX = 2880;
const BLOCKS_MAX = 120;
const DAY_MS = 30_000;

const fine: MempoolSample[] = [];
const day: MempoolSample[] = [];
const blocks = new Map<number, { height: number; timestamp: number; difficulty?: string | number; size?: number }>();
let lastDayTs = 0;

export function pushMempoolSample(s: MempoolSample): void {
  fine.push(s);
  if (fine.length > FINE_MAX) fine.splice(0, fine.length - FINE_MAX);
  if (!lastDayTs || s.ts - lastDayTs >= DAY_MS) {
    day.push(s);
    lastDayTs = s.ts;
    if (day.length > DAY_MAX) day.splice(0, day.length - DAY_MAX);
  }
}

export function pushBlockPoints(
  headers: { height: number; timestamp: number; difficulty?: string | number; size?: number }[]
): void {
  for (const h of headers) {
    if (!Number.isFinite(h.height) || !Number.isFinite(h.timestamp)) continue;
    blocks.set(h.height, {
      height: h.height,
      timestamp: h.timestamp,
      difficulty: h.difficulty,
      size: h.size,
    });
  }
  const heights = [...blocks.keys()].sort((a, b) => a - b);
  if (heights.length > BLOCKS_MAX) {
    for (const h of heights.slice(0, heights.length - BLOCKS_MAX)) blocks.delete(h);
  }
}

function numDiff(d: string | number | undefined): number | null {
  if (d == null) return null;
  const n = typeof d === "number" ? d : Number(d);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function getBlockSeries(): BlockPoint[] {
  const rows = [...blocks.values()].sort((a, b) => a.height - b.height);
  return rows.map((row, i) => {
    const prev = i > 0 ? rows[i - 1] : null;
    const dt = prev ? (row.timestamp - prev.timestamp) / 1000 : null;
    const intervalSec = dt != null && dt > 2 && dt < 3600 ? dt : null;
    const diff = numDiff(row.difficulty);
    const hashRateEst =
      intervalSec != null && diff != null ? diff / intervalSec : null;
    return {
      height: row.height,
      timestamp: row.timestamp,
      difficulty: row.difficulty,
      size: row.size,
      intervalSec,
      hashRateEst,
    };
  });
}

export function getMempoolFine(): MempoolSample[] {
  return fine;
}

export function getMempoolDay(): MempoolSample[] {
  return day;
}

function seriesStats(rows: MempoolSample[]) {
  if (!rows.length) {
    return {
      samples: 0,
      spanMs: 0,
      countMin: 0,
      countMax: 0,
      countAvg: 0,
      feeP50Avg: 0,
      feeP90Avg: 0,
      totalFeesSum: 0,
    };
  }
  let countMin = Infinity;
  let countMax = 0;
  let countSum = 0;
  let p50Sum = 0;
  let p90Sum = 0;
  let fees = 0;
  for (const r of rows) {
    countMin = Math.min(countMin, r.count);
    countMax = Math.max(countMax, r.count);
    countSum += r.count;
    p50Sum += r.p50;
    p90Sum += r.p90;
    fees += r.totalFees;
  }
  const n = rows.length;
  return {
    samples: n,
    spanMs: rows[n - 1].ts - rows[0].ts,
    countMin: countMin === Infinity ? 0 : countMin,
    countMax,
    countAvg: countSum / n,
    feeP50Avg: p50Sum / n,
    feeP90Avg: p90Sum / n,
    totalFeesSum: fees,
  };
}

export function chartsSummary(nowCount: number, p50: number, p90: number) {
  const b = getBlockSeries();
  const intervals = b.map((x) => x.intervalSec).filter((x): x is number => x != null);
  const avgBlockIntervalSec = intervals.length
    ? intervals.reduce((a, c) => a + c, 0) / intervals.length
    : 0;
  const last = b[b.length - 1];
  return {
    blockSamples: b.length,
    mempoolSamples: fine.length,
    mempool24hSamples: day.length,
    avgBlockIntervalSec,
    latestDifficulty: last?.difficulty ?? null,
    latestHashRateEst: last?.hashRateEst ?? null,
    mempoolNow: nowCount,
    feeP50Now: p50,
    feeP90Now: p90,
    fine: seriesStats(fine),
    day: seriesStats(day),
    windowH: 24,
  };
}
