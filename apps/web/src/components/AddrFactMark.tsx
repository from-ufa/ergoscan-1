import type { ReactNode } from "react";
import clsx from "clsx";

export type AddrFactId = "erg" | "boxes" | "clock";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.65,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Balance — billfold; a card slides from the pocket. */
function Erg() {
  return (
    <>
      <g className="fm-wallet-card">
        <rect x="7.1" y="4.9" width="9.8" height="7.4" rx="1.3" {...stroke} />
        <path d="M8.5 7.6h7" {...stroke} />
      </g>
      <rect x="4.4" y="8.85" width="15.2" height="10.55" rx="2.4" {...stroke} />
      <path d="M4.4 12.45h15.2" {...stroke} />
      <rect x="15.5" y="14.6" width="2.7" height="1.6" rx="0.8" {...stroke} />
    </>
  );
}

/** Unspent boxes — isometric cube that splits and snaps back. */
function Boxes() {
  return (
    <>
      <g className="fm-box-lid">
        <path d="M12 5.05 19.15 9.1 12 13.15 4.85 9.1Z" {...stroke} />
      </g>
      <g className="fm-box-left">
        <path d="M4.85 9.1 12 13.15v6.55L4.85 15.65Z" {...stroke} />
      </g>
      <g className="fm-box-right">
        <path d="M19.15 9.1 12 13.15v6.55l7.15-4.05Z" {...stroke} />
      </g>
    </>
  );
}

/** First / last seen. */
function Clock() {
  return (
    <>
      <circle cx="12" cy="12" r="7.35" {...stroke} />
      <path d="M12 8.2v4.1l2.8 1.7" {...stroke} />
    </>
  );
}

const BODY: Record<AddrFactId, () => ReactNode> = {
  erg: Erg,
  boxes: Boxes,
  clock: Clock,
};

const LIVE: Partial<Record<AddrFactId, true>> = {
  erg: true,
  boxes: true,
};

export function AddrFactMark({ id, className }: { id: AddrFactId; className?: string }) {
  const Body = BODY[id];
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("fact-mark", `fact-mark--${id}`, className)}
    >
      {LIVE[id] ? (
        <Body />
      ) : (
        <g className="fm-spin">
          <Body />
        </g>
      )}
    </svg>
  );
}
