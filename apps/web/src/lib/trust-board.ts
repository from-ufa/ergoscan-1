import { getGateway } from "./config";

export type EvidenceKind =
  | "chain"
  | "decoded"
  | "telemetry"
  | "live"
  | "heuristic"
  | "external";
export type TrustState = "operational" | "catching-up" | "degraded" | "unavailable";
export type TrustSliceId = "gateway" | "indexer" | "defi" | "rosen" | "oracle" | "rent";
export type TrustFeedSlug = "ergusd" | "erg-usd" | "xau-erg";
export type TrustMetricId =
  | "height"
  | "mempool"
  | "nodePoll"
  | "window"
  | "lag"
  | "coverage"
  | "scanHeight"
  | "scanHeightN2t"
  | "scanHeightT2t"
  | "trades24h"
  | "ranksAge"
  | "events"
  | "processing"
  | "routes"
  | "mode"
  | "verifyHeight"
  | "liveHeight";
export type TrustNotice =
  | "mock"
  | "synthetic-ordering"
  | "partial-chain"
  | "stale"
  | "inconsistent"
  | "not-ready"
  | "endpoint-unavailable";

export type TrustMetric = {
  id: TrustMetricId;
  value: number | string | boolean | null;
  evidence: EvidenceKind;
  unit?: "ms";
};

export type TrustFeedChip = {
  slug: TrustFeedSlug;
  live: number | null;
  hasPool: boolean;
};

export type TrustSlice = {
  id: TrustSliceId;
  state: TrustState;
  evidence: EvidenceKind;
  source: string;
  proofPath: string;
  updatedAtMs: number | null;
  metrics: TrustMetric[];
  notices: TrustNotice[];
  feeds?: TrustFeedChip[];
};

export type TrustBoard = {
  checkedAtMs: number;
  state: TrustState;
  slices: TrustSlice[];
};

export type GatewayHealth = {
  ok?: boolean;
  mock?: boolean;
  lastPollOk?: boolean;
  balls?: number | null;
  height?: number | null;
  orderingWindow?: { mode?: string | null } | null;
};

export type IndexerTrustStatus = {
  ok?: boolean;
  lag?: number | null;
  mode?: string | null;
  span?: number | null;
  minHeight?: number | null;
  lastHeight?: number | null;
  backfillPct?: number | null;
  updatedAt?: string | null;
  source?: string | null;
};

export type DefiTrustStatus = {
  ok?: boolean;
  stale?: boolean;
  workerLag?: number | null;
  scanHeight?: number | null;
  scanHeightN2t?: number | null;
  scanHeightT2t?: number | null;
  indexerHeight?: number | null;
  trades24h?: number | null;
  ranksAgeMs?: number | null;
  source?: string | null;
};

export type RosenTrustStatus = {
  ok?: boolean;
  ready?: boolean;
  scanHeight?: number | null;
  tipHeight?: number | null;
  eventsTotal?: number | null;
  processing?: number | null;
  routes?: number | null;
  updatedAtMs?: number | null;
  source?: string | null;
};

export type OracleTrustStatus = {
  ok?: boolean;
  ready?: boolean;
  mode?: string | null;
  scanHeight?: number | null;
  source?: string | null;
  feeds?: { slug?: string; poolBoxId?: string | null; live?: number | null }[] | null;
};

export type RentTrustStatus = {
  ok?: boolean;
  ready?: boolean;
  mode?: string | null;
  source?: string | null;
  verifyHeight?: number | null;
  liveHeight?: number | null;
  tipHeight?: number | null;
  lag?: number | null;
};

export type TrustBoardInput = {
  gateway: GatewayHealth | null;
  indexer: IndexerTrustStatus | null;
  defi: DefiTrustStatus | null;
  rosen: RosenTrustStatus | null;
  oracle: OracleTrustStatus | null;
  rent: RentTrustStatus | null;
};

function oracleFeedChip(
  raw: OracleTrustStatus | null,
  slug: TrustFeedSlug
): TrustFeedChip {
  const row = raw?.feeds?.find((f) => f.slug === slug);
  return {
    slug,
    live: finite(row?.live),
    hasPool: Boolean(row?.poolBoxId),
  };
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function lagState(ok: boolean | undefined, lag: number | null): TrustState {
  if (ok !== true) return "degraded";
  if (lag != null && lag > 5) return "catching-up";
  return "operational";
}

function maxLag(...values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value != null);
  return known.length ? Math.max(0, ...known) : null;
}

function staleAt(updatedAtMs: number | null, checkedAtMs: number, maxAgeMs: number): boolean {
  return (
    updatedAtMs == null ||
    checkedAtMs - updatedAtMs > maxAgeMs ||
    updatedAtMs - checkedAtMs > 60_000
  );
}

function forwardSkew(
  observedHeight: number | null,
  upstreamHeight: number | null,
  tolerance = 2
): boolean {
  return (
    observedHeight != null &&
    upstreamHeight != null &&
    observedHeight > upstreamHeight + tolerance
  );
}

function heightDiverges(
  left: number | null,
  right: number | null,
  tolerance = 2
): boolean {
  return left != null && right != null && Math.abs(left - right) > tolerance;
}

function gatewaySlice(raw: GatewayHealth | null, checkedAtMs: number): TrustSlice {
  if (!raw) {
    return missingSlice("gateway", "telemetry", "/v1/health");
  }
  const height = finite(raw.height);
  const state =
    raw.ok !== true || raw.lastPollOk !== true || height == null || raw.mock
      ? "degraded"
      : "operational";
  const notices: TrustNotice[] = [];
  if (raw.mock) notices.push("mock");
  if (raw.orderingWindow?.mode === "synthetic") notices.push("synthetic-ordering");
  return {
    id: "gateway",
    state,
    evidence: "telemetry",
    source: "gateway RAM",
    proofPath: "/v1/health",
    updatedAtMs: checkedAtMs,
    metrics: [
      { id: "height", value: height, evidence: "telemetry" },
      { id: "mempool", value: finite(raw.balls), evidence: "live" },
      { id: "nodePoll", value: raw.lastPollOk ?? null, evidence: "telemetry" },
    ],
    notices,
  };
}

function indexerSlice(
  raw: IndexerTrustStatus | null,
  checkedAtMs: number,
  gatewayHeight: number | null
): TrustSlice {
  if (!raw) {
    return missingSlice("indexer", "chain", "/v1/indexer/status");
  }
  const lastHeight = finite(raw.lastHeight);
  const reportedLag = finite(raw.lag);
  const inconsistent =
    (reportedLag != null && reportedLag < -2) ||
    forwardSkew(lastHeight, gatewayHeight);
  const lag = maxLag(
    reportedLag,
    lastHeight != null && gatewayHeight != null
      ? gatewayHeight - lastHeight
      : null
  );
  const parsedUpdatedAt = raw.updatedAt ? Date.parse(raw.updatedAt) : Number.NaN;
  const updatedAtMs = Number.isFinite(parsedUpdatedAt) ? parsedUpdatedAt : null;
  const stale = staleAt(updatedAtMs, checkedAtMs, 60_000);
  const complete =
    raw.minHeight === 0 && (raw.backfillPct == null || raw.backfillPct >= 100);
  const notices: TrustNotice[] = [];
  if (!complete) notices.push("partial-chain");
  if (stale) notices.push("stale");
  if (inconsistent) notices.push("inconsistent");
  const state: TrustState =
    raw.ok !== true || lastHeight == null || stale || inconsistent
      ? "degraded"
      : !complete
        ? "catching-up"
        : lagState(raw.ok, lag);
  return {
    id: "indexer",
    state,
    evidence: "chain",
    source: raw.source || "snapshot",
    proofPath: "/v1/indexer/status",
    updatedAtMs,
    metrics: [
      {
        id: "window",
        value:
          raw.minHeight != null && raw.lastHeight != null
            ? `h${raw.minHeight}–${raw.lastHeight}`
            : null,
        evidence: "chain",
      },
      { id: "lag", value: lag, evidence: "telemetry" },
      { id: "coverage", value: finite(raw.backfillPct), evidence: "chain" },
    ],
    notices,
  };
}

function defiSlice(
  raw: DefiTrustStatus | null,
  checkedAtMs: number,
  upstreamHeight: number | null
): TrustSlice {
  if (!raw) {
    return missingSlice("defi", "decoded", "/v1/defi/health");
  }
  const scanHeight = finite(raw.scanHeight);
  const scanHeightN2t = finite(raw.scanHeightN2t);
  const scanHeightT2t = finite(raw.scanHeightT2t);
  const indexerHeight = finite(raw.indexerHeight);
  const effectiveIndexerHeight = upstreamHeight ?? indexerHeight;
  const workerLag = finite(raw.workerLag);
  const ranksAgeMs = finite(raw.ranksAgeMs);
  const inconsistent =
    (workerLag != null && workerLag < -2) ||
    heightDiverges(indexerHeight, upstreamHeight) ||
    forwardSkew(scanHeight, effectiveIndexerHeight) ||
    forwardSkew(scanHeightN2t, effectiveIndexerHeight) ||
    forwardSkew(scanHeightT2t, effectiveIndexerHeight) ||
    (ranksAgeMs != null && ranksAgeMs < -60_000);
  const lag = maxLag(
    workerLag,
    scanHeight != null && effectiveIndexerHeight != null
      ? effectiveIndexerHeight - scanHeight
      : null,
    scanHeightN2t != null && effectiveIndexerHeight != null
      ? effectiveIndexerHeight - scanHeightN2t
      : null,
    scanHeightT2t != null && effectiveIndexerHeight != null
      ? effectiveIndexerHeight - scanHeightT2t
      : null
  );
  const stale = raw.stale === true || ranksAgeMs == null || ranksAgeMs > 180_000;
  const notices: TrustNotice[] = [];
  if (stale) notices.push("stale");
  if (inconsistent) notices.push("inconsistent");
  return {
    id: "defi",
    state:
      raw.ok !== true ||
      scanHeight == null ||
      scanHeightN2t == null ||
      scanHeightT2t == null ||
      effectiveIndexerHeight == null ||
      stale ||
      inconsistent
        ? "degraded"
        : lagState(raw.ok, lag),
    evidence: "decoded",
    source: raw.source || "lumen-defi",
    proofPath: "/v1/defi/health",
    updatedAtMs:
      ranksAgeMs != null
        ? checkedAtMs - Math.max(0, ranksAgeMs)
        : null,
    metrics: [
      { id: "scanHeight", value: scanHeight, evidence: "telemetry" },
      { id: "scanHeightN2t", value: scanHeightN2t, evidence: "telemetry" },
      { id: "scanHeightT2t", value: scanHeightT2t, evidence: "telemetry" },
      { id: "lag", value: lag, evidence: "telemetry" },
      { id: "trades24h", value: finite(raw.trades24h), evidence: "decoded" },
      { id: "ranksAge", value: ranksAgeMs, evidence: "telemetry", unit: "ms" },
    ],
    notices,
  };
}

function rosenSlice(
  raw: RosenTrustStatus | null,
  checkedAtMs: number,
  upstreamHeight: number | null
): TrustSlice {
  if (!raw) {
    return missingSlice("rosen", "decoded", "/v1/rosen/health");
  }
  const scanHeight = finite(raw.scanHeight);
  const tipHeight = finite(raw.tipHeight);
  const effectiveTip = upstreamHeight ?? tipHeight;
  const lag =
    scanHeight != null && effectiveTip != null
      ? Math.max(0, effectiveTip - scanHeight)
      : null;
  const updatedAtMs = finite(raw.updatedAtMs);
  const stale = staleAt(updatedAtMs, checkedAtMs, 120_000);
  const inconsistent =
    forwardSkew(scanHeight, effectiveTip) ||
    forwardSkew(tipHeight, upstreamHeight);
  const notices: TrustNotice[] = [];
  if (raw.ready !== true) notices.push("not-ready");
  if (stale) notices.push("stale");
  if (inconsistent) notices.push("inconsistent");
  const state: TrustState =
    raw.ok !== true ||
    scanHeight == null ||
    effectiveTip == null ||
    stale ||
    inconsistent
      ? "degraded"
      : raw.ready !== true
        ? "catching-up"
        : lagState(raw.ok, lag);
  return {
    id: "rosen",
    state,
    evidence: "decoded",
    source: raw.source || "lumen-rosen",
    proofPath: "/v1/rosen/health",
    updatedAtMs,
    metrics: [
      { id: "scanHeight", value: scanHeight, evidence: "telemetry" },
      { id: "lag", value: lag, evidence: "telemetry" },
      { id: "events", value: finite(raw.eventsTotal), evidence: "decoded" },
      { id: "processing", value: finite(raw.processing), evidence: "decoded" },
      { id: "routes", value: finite(raw.routes), evidence: "decoded" },
    ],
    notices,
  };
}

function oracleSlice(
  raw: OracleTrustStatus | null,
  checkedAtMs: number,
  upstreamHeight: number | null
): TrustSlice {
  if (!raw) {
    return {
      ...missingSlice("oracle", "decoded", "/v1/oracles/health"),
      feeds: [
        { slug: "ergusd", live: null, hasPool: false },
        { slug: "erg-usd", live: null, hasPool: false },
        { slug: "xau-erg", live: null, hasPool: false },
      ],
    };
  }
  const scanHeight = finite(raw.scanHeight);
  const lag =
    scanHeight != null && upstreamHeight != null
      ? Math.max(0, upstreamHeight - scanHeight)
      : null;
  const inconsistent = forwardSkew(scanHeight, upstreamHeight);
  const notices: TrustNotice[] = [];
  if (raw.ready !== true) notices.push("not-ready");
  if (inconsistent) notices.push("inconsistent");
  const idle = raw.mode === "idle";
  const holding = raw.mode === "tip_hold";
  const state: TrustState =
    raw.ok !== true || scanHeight == null || inconsistent || idle
      ? "degraded"
      : raw.ready !== true || holding
        ? "catching-up"
        : lagState(raw.ok, lag);
  return {
    id: "oracle",
    state,
    evidence: "decoded",
    source: raw.source || "lumen-oracle",
    proofPath: "/v1/oracles/health",
    updatedAtMs: checkedAtMs,
    metrics: [
      { id: "mode", value: raw.mode || null, evidence: "telemetry" },
      { id: "scanHeight", value: scanHeight, evidence: "telemetry" },
      { id: "lag", value: lag, evidence: "telemetry" },
    ],
    notices,
    feeds: [
      oracleFeedChip(raw, "ergusd"),
      oracleFeedChip(raw, "erg-usd"),
      oracleFeedChip(raw, "xau-erg"),
    ],
  };
}

function rentSlice(raw: RentTrustStatus | null, checkedAtMs: number): TrustSlice {
  if (!raw) return missingSlice("rent", "telemetry", "/v1/rent/health");
  const verifyHeight = finite(raw.verifyHeight);
  const liveHeight = finite(raw.liveHeight);
  const lag = finite(raw.lag);
  const history = raw.mode === "history";
  const state: TrustState =
    raw.ok !== true
      ? "degraded"
      : history || raw.ready !== true
        ? "catching-up"
        : lagState(raw.ok, lag);
  return {
    id: "rent",
    state,
    evidence: "telemetry",
    source: raw.source || "lumen-rent",
    proofPath: "/v1/rent/health",
    updatedAtMs: checkedAtMs,
    metrics: [
      { id: "mode", value: raw.mode || null, evidence: "telemetry" },
      { id: "verifyHeight", value: verifyHeight, evidence: "telemetry" },
      { id: "liveHeight", value: liveHeight, evidence: "telemetry" },
      { id: "lag", value: lag, evidence: "telemetry" },
    ],
    notices: raw.ready === true ? [] : ["not-ready"],
  };
}

function missingSlice(
  id: TrustSliceId,
  evidence: EvidenceKind,
  proofPath: string
): TrustSlice {
  return {
    id,
    state: "unavailable",
    evidence,
    source: "—",
    proofPath,
    updatedAtMs: null,
    metrics: [],
    notices: ["endpoint-unavailable"],
  };
}

export function buildTrustBoard(
  input: TrustBoardInput,
  checkedAtMs = Date.now()
): TrustBoard {
  const gatewayHeight = finite(input.gateway?.height);
  const indexedHeight = finite(input.indexer?.lastHeight);
  const projectorUpstream =
    indexedHeight != null && gatewayHeight != null
      ? Math.min(indexedHeight, gatewayHeight)
      : indexedHeight ?? gatewayHeight;
  const slices = [
    gatewaySlice(input.gateway, checkedAtMs),
    indexerSlice(input.indexer, checkedAtMs, gatewayHeight),
    defiSlice(input.defi, checkedAtMs, projectorUpstream),
    rosenSlice(input.rosen, checkedAtMs, projectorUpstream),
    oracleSlice(input.oracle, checkedAtMs, projectorUpstream),
    rentSlice(input.rent, checkedAtMs),
  ];
  const states = slices.map((slice) => slice.state);
  const state: TrustState = states.every((item) => item === "unavailable")
    ? "unavailable"
    : states.some((item) => item === "degraded" || item === "unavailable")
      ? "degraded"
      : states.some((item) => item === "catching-up")
        ? "catching-up"
        : "operational";
  return { checkedAtMs, state, slices };
}

async function readJson<T>(base: string, path: string): Promise<T | null> {
  try {
    const response = await fetch(`${base}${path}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function fetchTrustBoard(base = getGateway()): Promise<TrustBoard> {
  const [gateway, indexer, defi, rosen, oracle, rent] = await Promise.all([
    readJson<GatewayHealth>(base, "/v1/health"),
    readJson<IndexerTrustStatus>(base, "/v1/indexer/status"),
    readJson<DefiTrustStatus>(base, "/v1/defi/health"),
    readJson<RosenTrustStatus>(base, "/v1/rosen/health"),
    readJson<OracleTrustStatus>(base, "/v1/oracles/health"),
    readJson<RentTrustStatus>(base, "/v1/rent/health"),
  ]);
  return buildTrustBoard({ gateway, indexer, defi, rosen, oracle, rent });
}
