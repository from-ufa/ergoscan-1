/**
 * Site gateway browser lock. The API process (API_CONTOUR=1) stays open.
 * Same-origin page fetches do not need CORS. A foreign page must not read
 * ergoscan.me responses. curl has no Origin and still receives the body.
 */

export const SITE_PAGE_ORIGINS = [
  "https://ergoscan.me",
  "https://www.ergoscan.me",
] as const;

const SITE_PAGE_ORIGIN_SET = new Set<string>(SITE_PAGE_ORIGINS);

export function isApiContour(): boolean {
  return process.env.API_CONTOUR === "1";
}

export function headerOrigin(raw: string | string[] | undefined): string | undefined {
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

/** Exact browser Origin of the explorer pages. No trailing slash, no http. */
export function isSitePageOrigin(origin: string | undefined | null): boolean {
  if (!origin) return false;
  return SITE_PAGE_ORIGIN_SET.has(origin);
}

/**
 * Value for Access-Control-Allow-Origin on the site process.
 * false means do not send the header. The request itself still continues.
 */
export function siteCorsReflect(origin: string | undefined): string | false {
  if (!origin || !isSitePageOrigin(origin)) return false;
  return origin;
}

/**
 * WebSocket handshake on the site process.
 * Empty Origin is allowed only until a live browser handshake shows the header.
 * The API process accepts every handshake.
 */
export function allowStreamOrigin(
  origin: string | undefined,
  allowEmpty: boolean
): boolean {
  if (isApiContour()) return true;
  if (!origin) return allowEmpty;
  return isSitePageOrigin(origin);
}
