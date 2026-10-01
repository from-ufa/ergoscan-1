/** Section title for the content-column toolbar. */
export function chromeFor(path: string): { titleKey: string; heading: boolean } {
  const p = (path.split("?")[0] || "/").replace(/\/+$/, "") || "/";

  if (p === "/") return { titleKey: "nav.home", heading: true };
  if (p.startsWith("/block/")) return { titleKey: "nav.blocks", heading: false };
  if (p.startsWith("/tx/")) return { titleKey: "nav.txs", heading: false };
  if (p.startsWith("/address/")) return { titleKey: "nav.holders", heading: false };
  if (p.startsWith("/token/")) return { titleKey: "nav.tokens", heading: false };
  if (p.startsWith("/box/")) return { titleKey: "chrome.boxTitle", heading: false };
  if (p.startsWith("/nfts/collection")) return { titleKey: "nav.nfts", heading: false };
  if (p.startsWith("/nfts/issuer")) return { titleKey: "nav.nfts", heading: false };
  if (p.startsWith("/operators/nodes")) return { titleKey: "nodes.title", heading: true };
  if (p.startsWith("/oracles/xau-erg/gort")) return { titleKey: "buyback.titleGort", heading: true };
  if (p.startsWith("/oracles/erg-usd/dort")) return { titleKey: "buyback.titleDort", heading: true };
  if (p.startsWith("/oracles/xau-erg")) return { titleKey: "nav.oraclesXau", heading: true };
  if (p.startsWith("/oracles/ergusd")) return { titleKey: "nav.oraclesOfficial", heading: true };
  if (p.startsWith("/oracles/erg-usd")) return { titleKey: "nav.oraclesUsd", heading: true };
  if (p === "/oracles" || p.startsWith("/oracles")) return { titleKey: "nav.oracles", heading: true };
  if (p.startsWith("/operators/oracles")) return { titleKey: "nav.oracles", heading: true };
  if (p === "/defi/stable" || p.startsWith("/defi/stable/"))
    return { titleKey: "nav.defiAgeusd", heading: true };
  if (p === "/defi/lithos" || p.startsWith("/defi/lithos/"))
    return { titleKey: "nav.defiLithos", heading: true };
  if (p.startsWith("/defi/pool/")) return { titleKey: "nav.defiPool", heading: false };
  if (p === "/defi/pool") return { titleKey: "nav.defiPool", heading: true };
  if (p === "/defi/spectrum" || p.startsWith("/defi/spectrum/"))
    return { titleKey: "nav.defiSpectrum", heading: true };

  const exact: Record<string, string> = {
    "/tokens": "nav.tokens",
    "/blocks": "nav.blocks",
    "/transactions": "nav.txs",
    "/addresses": "nav.holders",
    "/names": "nav.names",
    "/favorites": "nav.favorites",
    "/richlist": "nav.holders",
    "/defi": "nav.defiSpectrum",
    "/rosen": "nav.rosen",
    "/learn": "nav.learn",
    "/learn/network": "nav.network",
    "/about": "nav.about",
    "/settings": "nav.settings",
    "/docs": "nav.docs",
    "/status": "nav.status",
    "/nfts": "nav.nfts",
    "/rent": "nav.rentUpcoming",
    "/rent/history": "nav.rentHistory",
    "/fees": "nav.fees",
    "/mempool": "nav.mempool",
    "/search": "nav.search",
  };
  const hit = exact[p];
  if (hit) return { titleKey: hit, heading: true };
  return { titleKey: "notFound.title", heading: true };
}
