import clsx from "clsx";

/**
 * Marks for the block detail cards. One per fact of a single block, so none of
 * them is borrowed from another page: the billfold meant an address balance,
 * the three people meant holders, the two coins meant token assets and the
 * cube already means unspent boxes everywhere else in the UI.
 *
 * Colour comes from the card's `ink` via currentColor — these must not set it.
 */

const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.65,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const solid = {
  fill: "currentColor",
  stroke: "currentColor",
  strokeWidth: 1.65,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Output — value the block put out. Coins leaving, not a wallet holding. */
export function BlockMarkOutput({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("block-mark block-mark--output", className)}
    >
      <rect x="2.8" y="7.4" width="7.4" height="9.2" rx="2" {...stroke} />
      <circle className="bm-out bm-out-a" cx="14" cy="12" r="2" {...stroke} />
      <circle className="bm-out bm-out-b" cx="19.2" cy="12" r="1.3" {...solid} />
    </svg>
  );
}

/** Miner — who found the block. Reads instantly, which beats being novel. */
export function BlockMarkMiner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("block-mark block-mark--miner", className)}
    >
      <g className="bm-pick">
        <path d="M6.4 17.6 14.4 9.6" {...stroke} />
        <path d="M11 6.2a7.4 7.4 0 0 1 6.8 6.8" {...stroke} />
        <path d="M12.6 7.8 16.2 11.4" {...stroke} />
      </g>
    </svg>
  );
}

/*
 * Fees and Size moved to kpi-marks as KpiMarkFees / KpiMarkFill: the mempool
 * page reports the same two facts, and a shared meaning must not have two
 * drawings that can drift apart.
 */
