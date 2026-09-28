/**
 * Public telemetry vs localhost ops. Caddy must not proxy `/v1/ops/*`.
 */

export type PublicHealth = {
  ok: boolean;
  network: string;
  height: number | null;
  lastPollOk: boolean;
  mock: boolean;
  balls: number;
  orderingWindow: { mode: string };
};

export type OpsHealth = PublicHealth & {
  forceMock: boolean;
  mockFallback: boolean;
  node: string;
  lastError: string | null;
  gateway: string;
  indexer: unknown;
  orderingWindow: { mode: string; note: string };
  matrix: { enabled: boolean; url: string | null };
};

export function toPublicHealth(ops: OpsHealth): PublicHealth {
  return {
    ok: ops.ok,
    network: ops.network,
    height: ops.height,
    lastPollOk: ops.lastPollOk,
    mock: ops.mock,
    balls: ops.balls,
    orderingWindow: { mode: ops.orderingWindow.mode },
  };
}

/** Drop disk and writer notes from any public indexer blob. */
export function publicIndexerStatus<T extends { diskFreeGb?: unknown; detail?: unknown }>(
  st: T
): Omit<T, "diskFreeGb" | "detail"> {
  const { diskFreeGb, detail, ...rest } = st;
  void diskFreeGb;
  void detail;
  return rest;
}
