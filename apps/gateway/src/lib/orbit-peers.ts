/**
 * Home Earth peers: a network catalog file plus this node's /peers/connected.
 * File + RAM. Browsers do not hit Scorex.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export type OrbitPeer = {
  /** Stable id — hash of host. */
  id: string;
  /** last live / lastMessage ms; 0 if unknown. */
  t: number;
  /** Host only, no port. */
  ip: string;
  /** Scorex / catalog name; empty if unknown. */
  name: string;
  /** 1 = TCP session on this node, 0 = crawl-live only. */
  c: 0 | 1;
};

export type OrbitRegion = { id: string; n: number };

export type OrbitSnap = {
  updatedAt: number | null;
  peers: OrbitPeer[];
  /** Top ISO countries among live+connected, from crawl catalog geo. */
  regions: OrbitRegion[];
};

const TOP_REGIONS = 8;
const DEFAULT_MS = 30_000;
const LIVE_FRESH_MS = 2 * 60 * 60 * 1000;
const CATALOG_PATH = process.env.NETWORK_CATALOG || "data/network-catalog.json";

type NodeGet = <T = unknown>(path: string, timeoutMs?: number) => Promise<T>;

type CatalogNode = {
  ip?: unknown;
  name?: unknown;
  address?: unknown;
  country?: unknown;
  reachable?: unknown;
  lastReachableAt?: unknown;
  lastInfoAt?: unknown;
  lastProbedAt?: unknown;
  lastMessage?: unknown;
  lastSeenAt?: unknown;
};

type CatalogFile = {
  version?: number;
  updatedAt?: number;
  nodes?: Record<string, CatalogNode>;
};

function peerId(host: string): string {
  return createHash("sha256").update(host).digest("hex").slice(0, 16);
}

function isPrivateIp(ip: string): boolean {
  if (
    ip.startsWith("10.") ||
    ip.startsWith("127.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("0.") ||
    ip.startsWith("169.254.")
  ) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(ip)) return true;
  return false;
}

function peerHost(address: string): string {
  let a = address.trim();
  if (!a) return "";
  const ip4 = a.match(/^\/ip4\/([^/]+)/);
  if (ip4?.[1]) return ip4[1];
  const ip6 = a.match(/^\/ip6\/([^/]+)/);
  if (ip6?.[1]) return ip6[1];
  if (a.startsWith("/") && !a.startsWith("/ip")) a = a.slice(1);
  const bracket = a.match(/^\[([^\]]+)\]/);
  if (bracket?.[1]) return bracket[1];
  const v4 = a.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
  if (v4?.[1]) return v4[1];
  const colon = a.lastIndexOf(":");
  if (colon > 0 && a.includes(".")) return a.slice(0, colon);
  return a;
}

function peerAddress(rec: Record<string, unknown>): string {
  const from = (v: unknown): string => {
    if (typeof v === "string") return v.trim();
    if (v && typeof v === "object") {
      const o = v as { addr?: unknown; host?: unknown; hostname?: unknown; port?: unknown };
      if (typeof o.addr === "string" && o.addr.trim()) return o.addr.trim();
      const host = String(o.host ?? o.hostname ?? "").trim();
      if (!host) return "";
      return o.port != null && String(o.port) ? `${host}:${o.port}` : host;
    }
    return "";
  };
  return (
    from(rec.address) ||
    from(rec.declaredAddress) ||
    from(rec.localAddress) ||
    from(rec.remoteAddress) ||
    ""
  );
}

function parseConnected(raw: unknown): OrbitPeer[] {
  if (!Array.isArray(raw)) return [];
  const out: OrbitPeer[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const address = peerAddress(rec);
    if (!address || address === "[object Object]") continue;
    const ip = peerHost(address);
    if (!ip || isPrivateIp(ip)) continue;
    if (seen.has(ip)) continue;
    seen.add(ip);
    const tRaw = Number(rec.lastMessage ?? rec.lastSeen);
    const name = String(rec.name ?? "").trim().slice(0, 48);
    out.push({
      id: peerId(ip),
      t: Number.isFinite(tRaw) && tRaw > 0 ? tRaw : 0,
      ip,
      name,
      c: 1,
    });
  }
  return out;
}

function isCatalogLive(n: CatalogNode, now: number): boolean {
  if (n.reachable === true) return true;
  const lastLive = Math.max(
    Number(n.lastReachableAt) || 0,
    Number(n.lastInfoAt) || 0,
    n.reachable === true ? Number(n.lastProbedAt) || 0 : 0
  );
  return lastLive > 0 && now - lastLive < LIVE_FRESH_MS;
}

function loadCatalog(): CatalogFile | null {
  try {
    const raw = readFileSync(CATALOG_PATH, "utf8");
    const data = JSON.parse(raw) as CatalogFile;
    if (!data || data.version !== 1 || !data.nodes || typeof data.nodes !== "object") return null;
    return data;
  } catch {
    return null;
  }
}

function isoCountry(raw: unknown): string {
  const s = String(raw ?? "")
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : "";
}

function topRegions(counts: Map<string, number>): OrbitRegion[] {
  return [...counts.entries()]
    .filter(([id, n]) => id.length === 2 && n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_REGIONS)
    .map(([id, n]) => ({ id, n }));
}

function mergeLive(
  connected: OrbitPeer[],
  catalog: CatalogFile | null,
  now: number
): { peers: OrbitPeer[]; regions: OrbitRegion[] } {
  const byIp = new Map<string, OrbitPeer>();
  const countryByIp = new Map<string, string>();
  for (const p of connected) byIp.set(p.ip, p);
  if (catalog?.nodes) {
    for (const [key, n] of Object.entries(catalog.nodes)) {
      const ip = peerHost(String(n.ip ?? n.address ?? key));
      if (!ip || isPrivateIp(ip)) continue;
      const cc = isoCountry(n.country);
      const connectedRow = byIp.get(ip);
      if (!connectedRow && !isCatalogLive(n, now)) continue;
      if (cc) countryByIp.set(ip, cc);
      const name = String(n.name ?? "").trim().slice(0, 48);
      const t = Math.max(
        Number(n.lastReachableAt) || 0,
        Number(n.lastInfoAt) || 0,
        Number(n.lastMessage) || 0,
        Number(n.lastSeenAt) || 0
      );
      if (connectedRow) {
        if (!connectedRow.name && name) connectedRow.name = name;
        if (t > connectedRow.t) connectedRow.t = t;
        continue;
      }
      byIp.set(ip, {
        id: peerId(ip),
        t: t > 0 ? t : 0,
        ip,
        name,
        c: 0,
      });
    }
  }
  const peers = [...byIp.values()].sort((a, b) => b.c - a.c || b.t - a.t);
  const counts = new Map<string, number>();
  for (const p of peers) {
    const cc = countryByIp.get(p.ip);
    if (!cc) continue;
    counts.set(cc, (counts.get(cc) ?? 0) + 1);
  }
  return { peers, regions: topRegions(counts) };
}

export function startOrbitPeerCache(nodeGet: NodeGet): {
  get: () => OrbitSnap;
  stop: () => void;
} {
  let snap: OrbitSnap = { updatedAt: null, peers: [], regions: [] };
  let inflight = false;
  const ms = Math.max(15_000, Number(process.env.ORBIT_PEERS_MS ?? DEFAULT_MS) || DEFAULT_MS);

  async function tick(): Promise<void> {
    if (inflight) return;
    inflight = true;
    try {
      const raw = await nodeGet<unknown>("/peers/connected", 8000);
      const connected = parseConnected(raw);
      const merged = mergeLive(connected, loadCatalog(), Date.now());
      snap = { updatedAt: Date.now(), ...merged };
    } catch {
      const catalog = loadCatalog();
      if (catalog) {
        const merged = mergeLive([], catalog, Date.now());
        snap = { updatedAt: Date.now(), ...merged };
      }
    } finally {
      inflight = false;
    }
  }

  void tick();
  const iv = setInterval(() => void tick(), ms);
  if (typeof iv.unref === "function") iv.unref();

  return {
    get: () => snap,
    stop: () => clearInterval(iv),
  };
}
