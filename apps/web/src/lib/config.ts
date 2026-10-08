export const GATEWAY =
  process.env.NEXT_PUBLIC_GATEWAY_URL?.replace(/\/$/, "") || "http://127.0.0.1:4400";

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  GATEWAY.replace(/^http/, "ws") + "/v1/stream";

function browserHost(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.hostname;
}

/** Local preview. The site gateway does not send CORS to this origin. */
function isLoopbackHost(host: string | null): boolean {
  return host === "localhost" || host === "127.0.0.1";
}

/**
 * Browser on the public host: same origin (Caddy → gateway).
 * Browser on the local preview: same origin too. Next rewrites /v1 to the gateway,
 * because that gateway only reflects https://ergoscan.me.
 * SSR: explicit env or loopback :4400.
 */
export function getGateway(): string {
  if (isLoopbackHost(browserHost())) return "";
  const explicit = process.env.NEXT_PUBLIC_GATEWAY_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (browserHost() != null) return "";
  return GATEWAY;
}

/**
 * Stable in server and browser renders: explicit public gateway in remote-preview
 * builds, same-origin path behind Caddy in production.
 */
export function publicGatewayHref(path: string): string {
  const explicit = process.env.NEXT_PUBLIC_GATEWAY_URL?.replace(/\/$/, "");
  if (explicit) return `${explicit}${path}`;
  if (process.env.NODE_ENV === "development") return `http://127.0.0.1:4400${path}`;
  return path;
}

/** Browser WS: same-origin on the public host and on the local preview. */
export function getWsUrl(): string {
  if (typeof window !== "undefined" && isLoopbackHost(window.location.hostname)) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/v1/stream`;
  }
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  const gw = getGateway();
  if (gw) return gw.replace(/^http/, "ws") + "/v1/stream";
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/v1/stream`;
  }
  return WS_URL;
}
