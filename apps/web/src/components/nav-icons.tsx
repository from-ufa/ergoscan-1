/**
 * Rail glyphs. Keep-set (home, blocks, txs, addresses, favorites, nfts)
 * is house-drawn. The rest are Lucide paths (ISC), same 24 box and 1.7 stroke.
 */
import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function glyph(props: IconProps, paths: ReactNode) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      {...props}
    >
      {paths}
    </svg>
  );
}

const sw = 1.7;
const cap = { stroke: "currentColor", strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/**
 * Home. The rail used to repeat the brand mark that already sits
 * in the block right above it, so the row had no glyph of its own.
 */
export function IconHome(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M4 10.6 12 4.2l8 6.4V19a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19v-8.4Z" {...cap} />
      <path d="M9.6 20.4v-6h4.8v6" {...cap} />
    </>
  );
}

/** Tokens — Lucide `coins`. */
export function IconTokens(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M13.744 17.736a6 6 0 1 1-7.48-7.48" {...cap} />
      <path d="M15 6h1v4" {...cap} />
      <path d="m6.134 14.768.866-.5 2 3.464" {...cap} />
      <circle cx="16" cy="8" r="6" {...cap} />
    </>
  );
}

export function IconBlocks(props: IconProps) {
  return glyph(
    props,
    <>
      <rect x="3.8" y="9.2" width="10.4" height="10.4" rx="2.1" {...cap} />
      <rect x="9.8" y="4.4" width="10.4" height="10.4" rx="2.1" {...cap} />
    </>
  );
}

/**
 * Transactions — the index tape: records running past, one of them leaving.
 * Deliberately not the box-to-box KPI mark: a rail glyph names a section at
 * 22px, it is not the same job as a mark answering a number.
 */
export function IconTxs(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M4.4 6.6h9.6" {...cap} />
      <path d="M4.4 12h13.2" {...cap} />
      <path d="M4.4 17.4h11" {...cap} />
      <path d="M17.4 4.6l2.4 2-2.4 2" {...cap} />
    </>
  );
}

/** One transaction in a row: an ink blot. Not the rail tape. */
export function IconTxSlip(props: IconProps) {
  return glyph(
    props,
    <>
      <path
        fill="currentColor"
        stroke="none"
        d="M12.4 3.6c2.6-.4 5.2.8 6.2 3.4.7 1.8.1 3.2 1 4.8.9 1.7-.1 3.6-1.6 4.6-1.7 1.1-3.4.2-5.1.7-1.5.4-2.8 1.6-4.4.7-1.9-1.1-1.5-3.2-2.2-4.8-.7-1.7-2.4-2.8-1.8-4.8.7-2.3 3-3.4 5-4 1.5-.5 2.2-.6 2.9-.6z"
      />
      <circle cx="19.4" cy="6.6" r="1.15" fill="currentColor" />
      <circle cx="5.1" cy="17.6" r="0.75" fill="currentColor" />
    </>
  );
}

/** Names — Lucide `tag`. */
export function IconNames(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" {...cap} />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </>
  );
}

/** Addresses — one indexed entry: an identifier and what is held against it. */
export function IconHolders(props: IconProps) {
  return glyph(
    props,
    <>
      <rect x="3.6" y="6.2" width="16.8" height="11.6" rx="2.6" {...cap} />
      <circle cx="8.4" cy="12" r="1.9" {...cap} />
      <path d="M12.6 10.4h5.2" {...cap} />
      <path d="M12.6 13.6h3.4" {...cap} />
    </>
  );
}

/** Favorites — addresses kept on this device. */
export function IconFavorites(props: IconProps) {
  return glyph(
    props,
    <path d="M12 20.15S4.85 15.4 4.85 10.55A3.75 3.75 0 0 1 12 8.2a3.75 3.75 0 0 1 7.15 2.35C19.15 15.4 12 20.15 12 20.15Z" {...cap} />
  );
}

/** DeFi — Lucide `landmark`. */
export function IconDefi(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M10 18v-7" {...cap} />
      <path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z" {...cap} />
      <path d="M14 18v-7" {...cap} />
      <path d="M18 18v-7" {...cap} />
      <path d="M3 22h18" {...cap} />
      <path d="M6 18v-7" {...cap} />
    </>
  );
}

/** DEX — Lucide `arrow-left-right`. */
export function IconTape(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M8 3 4 7l4 4" {...cap} />
      <path d="M4 7h16" {...cap} />
      <path d="m16 21 4-4-4-4" {...cap} />
      <path d="M20 17H4" {...cap} />
    </>
  );
}

/** Spectrum AMM — Lucide `droplets`. */
export function IconSpectrum(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" {...cap} />
      <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" {...cap} />
    </>
  );
}

/** LithosDex — Lucide `chart-candlestick`. */
export function IconLithos(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M9 5v4" {...cap} />
      <rect width="4" height="6" x="7" y="9" rx="1" {...cap} />
      <path d="M9 15v2" {...cap} />
      <path d="M17 3v2" {...cap} />
      <rect width="4" height="8" x="15" y="5" rx="1" {...cap} />
      <path d="M17 13v3" {...cap} />
      <path d="M3 3v16a2 2 0 0 0 2 2h16" {...cap} />
    </>
  );
}

/** Stable coins — Lucide `banknote`. */
export function IconStable(props: IconProps) {
  return glyph(
    props,
    <>
      <rect width="20" height="12" x="2" y="6" rx="2" {...cap} />
      <circle cx="12" cy="12" r="2" {...cap} />
      <path d="M6 12h.01M18 12h.01" {...cap} />
    </>
  );
}

/** Basis lockbox — Lucide `lock`. */
export function IconBasis(props: IconProps) {
  return glyph(
    props,
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" {...cap} />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" {...cap} />
    </>
  );
}

/** AgeUSD — Lucide `sigma`. */
export function IconAgeusd(props: IconProps) {
  return glyph(
    props,
    <path d="M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2" {...cap} />
  );
}

/** Use — Lucide `factory`. */
export function IconUse(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M12 16h.01" {...cap} />
      <path d="M16 16h.01" {...cap} />
      <path d="M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z" {...cap} />
      <path d="M8 16h.01" {...cap} />
    </>
  );
}

export function IconNfts(props: IconProps) {
  return glyph(
    props,
    <>
      <rect x="3.8" y="5" width="16.4" height="14" rx="2.4" {...cap} />
      <circle cx="8.6" cy="10" r="1.45" {...cap} />
      <path d="M4.6 16.4 8.4 13l2.7 2.2 3.6-4.6 4.3 5.8" {...cap} />
    </>
  );
}

/** Upcoming — Lucide `calendar-clock`. */
export function IconRentSoon(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M16 14v2.2l1.6 1" {...cap} />
      <path d="M16 2v4" {...cap} />
      <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" {...cap} />
      <path d="M3 10h5" {...cap} />
      <path d="M8 2v4" {...cap} />
      <circle cx="16" cy="16" r="6" {...cap} />
    </>
  );
}

/** History — Lucide `history`. */
export function IconRentHist(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" {...cap} />
      <path d="M3 3v5h5" {...cap} />
      <path d="M12 7v5l4 2" {...cap} />
    </>
  );
}

export function IconRent(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M10 2h4" {...cap} />
      <path d="M12 14 15 11" {...cap} />
      <circle cx="12" cy="14" r="8" {...cap} />
    </>
  );
}

/** Mempool — Lucide `hourglass`. */
export function IconMempool(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M5 22h14" {...cap} />
      <path d="M5 2h14" {...cap} />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" {...cap} />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" {...cap} />
    </>
  );
}

/** Rosen — Lucide `bridge`. */
export function IconRosen(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M10 9.728V16" {...cap} />
      <path d="M14 9.728V16" {...cap} />
      <path d="M18 20V4" {...cap} />
      <path d="m22 11-4-4A7.5 7.5 0 0 1 6 7l-4 4" {...cap} />
      <path d="M22 16H2" {...cap} />
      <path d="M6 20V4" {...cap} />
    </>
  );
}

/** Learn — Lucide `graduation-cap`. */
export function IconLearn(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" {...cap} />
      <path d="M22 10v6" {...cap} />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" {...cap} />
    </>
  );
}

/** Network directory — Lucide `globe`. */
export function IconGlobe(props: IconProps) {
  return glyph(
    props,
    <>
      <circle cx="12" cy="12" r="10" {...cap} />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" {...cap} />
      <path d="M2 12h20" {...cap} />
    </>
  );
}

/** Status — the pulse of the index, not a second pair of server racks. */
export function IconStatus(props: IconProps) {
  return glyph(
    props,
    <path d="M3.4 12.2H7l1.7-4.6 3.2 9.2 2.1-4.6H20.6" {...cap} />
  );
}

/** About — Lucide `info`. Who built the explorer, not a second Learn. */
/** Settings — Lucide `monitor-cog`. */
export function IconSettings(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M12 17v4" {...cap} />
      <path d="m14.305 7.53.923-.382" {...cap} />
      <path d="m15.228 4.852-.923-.383" {...cap} />
      <path d="m16.852 3.228-.383-.924" {...cap} />
      <path d="m16.852 8.772-.383.923" {...cap} />
      <path d="m19.148 3.228.383-.924" {...cap} />
      <path d="m19.53 9.696-.382-.924" {...cap} />
      <path d="m20.772 4.852.924-.383" {...cap} />
      <path d="m20.772 7.148.924.383" {...cap} />
      <path d="M22 13v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" {...cap} />
      <path d="M8 21h8" {...cap} />
      <circle cx="18" cy="6" r="3" {...cap} />
    </>
  );
}

export function IconAbout(props: IconProps) {
  return glyph(
    props,
    <>
      <circle cx="12" cy="12" r="10" {...cap} />
      <path d="M12 16v-4" {...cap} />
      <path d="M12 8h.01" {...cap} />
    </>
  );
}

/** API — chevrons. A page glyph would collide with Learn. */
export function IconApi(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M8.2 6.4 4.6 12l3.6 5.6" {...cap} />
      <path d="M15.8 6.4 19.4 12l-3.6 5.6" {...cap} />
    </>
  );
}

/**
 * Nodes — machines with a status light. A peer graph was tried and collides
 * with the Markets hub mark; an uptime chart read as the NFTs picture glyph.
 */
export function IconNodes(props: IconProps) {
  return glyph(
    props,
    <>
      <rect x="4.2" y="5" width="15.6" height="5.6" rx="1.8" {...cap} />
      <rect x="4.2" y="13.4" width="15.6" height="5.6" rx="1.8" {...cap} />
      <circle cx="8" cy="7.8" r="1.1" fill="currentColor" />
      <circle cx="8" cy="16.2" r="1.1" fill="currentColor" />
    </>
  );
}

/** Oracles — Lucide `satellite-dish`. */
export function IconOracles(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M18 12a6 6 0 00-6-6" {...cap} />
      <path d="M2.824 10.459a8 8 0 0010.717 10.717c.558-.276.623-1.012.183-1.452l-9.448-9.448c-.44-.44-1.176-.375-1.452.183" {...cap} />
      <path d="M22 12A10 10 0 0012 2" {...cap} />
      <path d="m9 15 4-4" {...cap} />
    </>
  );
}

/** USD v1 feed — Lucide `circle-dollar-sign`. */
export function IconOracleUsd(props: IconProps) {
  return glyph(
    props,
    <>
      <circle cx="12" cy="12" r="10" {...cap} />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" {...cap} />
      <path d="M12 18V6" {...cap} />
    </>
  );
}

/** USD v2 feed — Lucide `badge-dollar-sign`. */
export function IconOracleUsdV2(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" {...cap} />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" {...cap} />
      <path d="M12 18V6" {...cap} />
    </>
  );
}

/** XAU feed — Lucide `crown`. */
export function IconOracleXau(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" {...cap} />
      <path d="M5 21h14" {...cap} />
    </>
  );
}

/** GORT buyback — Lucide `gem`. */
export function IconGort(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M10.5 3 8 9l4 13 4-13-2.5-6" {...cap} />
      <path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z" {...cap} />
      <path d="M2 9h20" {...cap} />
    </>
  );
}

/** DORT buyback — Lucide `hand-coins`. */
export function IconDort(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" {...cap} />
      <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" {...cap} />
      <path d="m2 16 6 6" {...cap} />
      <circle cx="16" cy="9" r="2.9" {...cap} />
      <circle cx="6" cy="5" r="3" {...cap} />
    </>
  );
}

/** Pool list — Lucide `waves`. */
export function IconPool(props: IconProps) {
  return glyph(
    props,
    <>
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" {...cap} />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" {...cap} />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" {...cap} />
    </>
  );
}

export const NAV_ICONS = {
  home: IconHome,
  tokens: IconTokens,
  blocks: IconBlocks,
  txs: IconTxs,
  holders: IconHolders,
  names: IconNames,
  favorites: IconFavorites,
  defi: IconDefi,
  tape: IconTape,
  spectrum: IconSpectrum,
  pool: IconPool,
  lithos: IconLithos,
  stable: IconStable,
  ageusd: IconAgeusd,
  basis: IconBasis,
  use: IconUse,
  nfts: IconNfts,
  rent: IconRent,
  rentSoon: IconRentSoon,
  rentHist: IconRentHist,
  mempool: IconMempool,
  rosen: IconRosen,
  learn: IconLearn,
  globe: IconGlobe,
  about: IconAbout,
  settings: IconSettings,
  api: IconApi,
  status: IconStatus,
  nodes: IconNodes,
  oracles: IconOracles,
  oracleUsd: IconOracleUsd,
  oracleUsdV2: IconOracleUsdV2,
  oracleXau: IconOracleXau,
  gort: IconGort,
  dort: IconDort,
} as const;

export type NavIconId = keyof typeof NAV_ICONS;

export function NavIcon({ id, className }: { id: NavIconId; className?: string }) {
  const Cmp = NAV_ICONS[id];
  if (!Cmp) return null;
  return <Cmp className={className} />;
}
