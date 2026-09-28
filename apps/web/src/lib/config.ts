export const GATEWAY =
  process.env.NEXT_PUBLIC_GATEWAY_URL?.replace(/\/$/, "") || "http://127.0.0.1:4400";

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  GATEWAY.replace(/^http/, "ws") + "/v1/stream";

/**
 * Browser: same-origin on the public host (Caddy → gateway).
 * Localhost / SSR: explicit env or loopback :4400.
 * Does not change API contracts — URL prefix only.
 */
export function getGateway(): string {
  const explicit = process.env.NEXT_PUBLIC_GATEWAY_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return "";
  }
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

/** Browser WS: same-origin on the public host; env or loopback locally. */
export function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  const gw = getGateway();
  if (gw) return gw.replace(/^http/, "ws") + "/v1/stream";
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/v1/stream`;
  }
  return WS_URL;
}
