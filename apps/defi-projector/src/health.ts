import http from "node:http";

export type HealthSnap = {
  kind?: "n2t" | "t2t" | "unified" | "ageusd";
  ok: boolean;
  enabled: boolean;
  mode: "tip" | "history" | "tip_hold" | "idle";
  scanHeight: number | null;
  tipHeight: number | null;
  lag: number | null;
  indexerLag: number | null;
  registryN: number;
  n2tRegistry?: number;
  t2tRegistry?: number;
  insertedSession: number;
  insertedN2t?: number;
  insertedT2t?: number;
  insertedAgeusd?: number;
  lithosRegistry?: number;
  insertedLithos?: number;
  lithosScanHeight?: number | null;
  lithosLag?: number | null;
  lithosEnabled?: boolean;
  ageusdUnified?: boolean;
  lastScanAt: number | null;
  lastRanksAt: number | null;
  lastError: string | null;
};

function healthType(kind: HealthSnap["kind"]): string {
  if (kind === "t2t") return "defi_t2t";
  if (kind === "unified") return "defi_unified";
  if (kind === "ageusd") return "defi_ageusd";
  return "defi_projector";
}

export function startHealthServer(
  port: number,
  get: () => HealthSnap,
  extraPorts: number[] = []
): http.Server[] {
  const listen = (p: number): http.Server => {
    const server = http.createServer((req, res) => {
      if (req.url === "/health" || req.url === "/") {
        const snap = get();
        const body = JSON.stringify({
          type: healthType(snap.kind),
          ...snap,
        });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(body);
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(p, "127.0.0.1");
    return server;
  };
  const ports = [port, ...extraPorts.filter((p) => p > 0 && p !== port)];
  return ports.map(listen);
}
