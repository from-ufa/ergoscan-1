/**
 * On-demand IPFS fetch for NFT thumbs. Not a stored CDN — no disk cache.
 * Path is CID + optional file only; we pick the upstream, never the caller host.
 */
import type { Express, Request, Response as ExpressResponse } from "express";
import { IPFS_GATEWAYS, isSafeIpfsPath } from "@ergoscan/shared";

const MAX_BYTES = 12 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const UA =
  "Mozilla/5.0 (compatible; ErgoScan/1.0; +https://ergoscan.me)";

const ALLOW_HOST = new Set(
  IPFS_GATEWAYS.map((g) => {
    try {
      return new URL(g).hostname;
    } catch {
      return "";
    }
  }).filter(Boolean)
);

function hostOk(host: string): boolean {
  if (ALLOW_HOST.has(host)) return true;
  return /^[a-z0-9]+\.ipfs\.(nftstorage\.link|w3s\.link|dweb\.link)$/i.test(host);
}

function typeOk(ct: string | null): boolean {
  if (!ct) return true;
  const t = ct.toLowerCase();
  if (t.includes("text/html") || t.includes("text/plain")) return false;
  return (
    t.startsWith("image/") ||
    t.startsWith("audio/") ||
    t.startsWith("video/") ||
    t.includes("octet-stream") ||
    t.includes("application/pdf")
  );
}

async function tryGateway(url: string): Promise<globalThis.Response | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: ac.signal,
      redirect: "follow",
      headers: { Accept: "image/*,audio/*,video/*,*/*;q=0.8", "User-Agent": UA },
    });
    if (!r.ok || !r.body) return null;
    let host = "";
    try {
      host = new URL(r.url).hostname;
    } catch {
      return null;
    }
    if (!hostOk(host)) return null;
    if (!typeOk(r.headers.get("content-type"))) return null;
    const len = Number(r.headers.get("content-length") || 0);
    if (len > MAX_BYTES) return null;
    return r;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function registerMediaRoutes(app: Express): void {
  app.get(/^\/v1\/media\/ipfs\/(.+)$/, (req: Request, res: ExpressResponse) => {
    void (async () => {
      const raw = String(req.params[0] ?? "");
      let path = raw;
      try {
        path = decodeURIComponent(raw);
      } catch {
        res.status(400).json({ error: "bad_path" });
        return;
      }
      if (!isSafeIpfsPath(path)) {
        res.status(400).json({ error: "bad_ipfs_path" });
        return;
      }
      for (const gate of IPFS_GATEWAYS) {
        const upstream = await tryGateway(`${gate}${path}`);
        if (!upstream?.body) continue;
        const ct = upstream.headers.get("content-type") || "application/octet-stream";
        res.setHeader("Content-Type", ct);
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.setHeader("X-Ipfs-Gateway", new URL(gate).hostname);
        const reader = upstream.body.getReader();
        let n = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            n += value.byteLength;
            if (n > MAX_BYTES) {
              res.destroy();
              return;
            }
            res.write(Buffer.from(value));
          }
          res.end();
        } catch {
          if (!res.headersSent) res.status(502).json({ error: "media_stream_failed" });
          else res.destroy();
        }
        return;
      }
      res.status(502).json({ error: "ipfs_unavailable" });
    })();
  });
}
