import http from "node:http";

export type HealthSnap = {
  ok: boolean;
  enabled: boolean;
  history: boolean;
  mode: "idle" | "tip" | "history" | "tip_hold";
  scanHeight: number | null;
  tipHeight: number | null;
  minHeight: number | null;
  lag: number | null;
  indexerLag: number | null;
  ticksSession: number;
  lastScanAt: number | null;
  lastError: string | null;
};

export function startHealthServer(
  port: number,
  get: () => HealthSnap
): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      const body = JSON.stringify({ type: "oracle_projector", ...get() });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(body);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port, "127.0.0.1");
  return server;
}
