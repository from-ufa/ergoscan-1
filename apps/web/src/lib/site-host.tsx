"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const SiteHostContext = createContext({ api: false });

/** False during SSR, then true on api.ergoscan.me. Keeps the explorer's static HTML. */
export function SiteHostProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState(false);
  useEffect(() => {
    setApi(window.location.hostname === "api.ergoscan.me");
  }, []);
  return <SiteHostContext.Provider value={{ api }}>{children}</SiteHostContext.Provider>;
}

export function useSiteHost() {
  return useContext(SiteHostContext);
}

/** On the API host, explorer pages live on ergoscan.me. `/` stays the API home. */
export function explorerHref(href: string, api: boolean): string {
  if (href.startsWith("http")) return href;
  if (api && href !== "/") return `https://ergoscan.me${href}`;
  return href;
}
