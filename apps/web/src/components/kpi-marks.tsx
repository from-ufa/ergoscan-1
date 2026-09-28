import clsx from "clsx";
import { INK } from "@/lib/palette";

const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.65,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/**
 * Addresses holding something. Also the token page's Holders card, where a `#`
 * used to sit — but `#` is this UI's mark for an address hash, not for a count
 * of the people behind those addresses.
 */
export function KpiMarkHolders({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--holders h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <g className="kpi-fig kpi-fig-l">
        <circle cx="6.35" cy="8.55" r="1.7" {...stroke} />
        <path d="M3.45 18.55c.5-2.35 1.75-3.5 3.45-3.5" {...stroke} />
      </g>
      <g className="kpi-fig kpi-fig-r">
        <circle cx="17.65" cy="8.55" r="1.7" {...stroke} />
        <path d="M20.55 18.55c-.5-2.35-1.75-3.5-3.45-3.5" {...stroke} />
      </g>
      <g className="kpi-fig kpi-fig-c">
        <circle cx="12" cy="7.35" r="2.2" {...stroke} />
        <path d="M6.2 18.7c.7-3.15 2.55-4.75 5.8-4.75s5.1 1.6 5.8 4.75" {...stroke} />
      </g>
    </svg>
  );
}

/**
 * Marks shared by more than one page, because the meaning is shared.
 * `tone` is for grids that do not colour the mark themselves (KpiGrid);
 * omit it inside a card that already sets `color` (AddrFactCard ink).
 */

/**
 * A level: for cards whose leading value is a share of capacity, like the
 * mempool "Queue load" at 6% with the bytes in the caption.
 * Cards that lead with the bytes themselves use KpiMarkPayload instead — the
 * figure the card puts first is what the mark has to answer to.
 */
export function KpiMarkFill({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("ui-mark ui-mark--fill h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <rect x="6" y="4.4" width="12" height="15.2" rx="2.6" {...stroke} />
      <rect
        className="um-level"
        x="7.8"
        y="14.6"
        width="8.4"
        height="3.4"
        rx="1.1"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.65}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Fees charged. A receipt states "charged" without claiming a proportion —
 * a coin sector did, and fees are a rounding error against the block reward.
 */
export function KpiMarkFees({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("ui-mark ui-mark--fees h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path
        d="M5.6 4.4h12.8v13.2l-2.13 1.4-2.14-1.4-2.13 1.4-2.14-1.4-2.13 1.4-2.13-1.4Z"
        {...stroke}
      />
      <path d="M8.4 8.4h7.2" {...stroke} />
      <path className="um-line" d="M8.4 12h4.8" {...stroke} />
    </svg>
  );
}

/**
 * A swap — two assets crossing in opposite directions.
 * This is the only card in the UI where opposed arrows are literally true. They
 * used to stand in for transaction counts, address flow and unconfirmed queues,
 * where they read as "exchange" and meant something else.
 */
export function KpiMarkSwap({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("ui-mark ui-mark--swap h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <g className="um-swap-a">
        <path d="M4 8.2h12.4" {...stroke} />
        <path d="M13.2 4.8 17.6 8.2 13.2 11.6" {...stroke} />
      </g>
      <g className="um-swap-b">
        <path d="M20 15.8H7.6" {...stroke} />
        <path d="M10.8 12.4 6.4 15.8l4.4 3.4" {...stroke} />
      </g>
    </svg>
  );
}

/** Traded volume — value streaming through the pools, growing as it accumulates. */
export function KpiMarkVolume({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("ui-mark ui-mark--volume h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <circle className="um-vol um-vol-a" cx="4.4" cy="12" r="1.5" fill="currentColor" opacity={0.4} />
      <circle className="um-vol um-vol-b" cx="9.2" cy="12" r="2.1" fill="currentColor" opacity={0.7} />
      <circle className="um-vol um-vol-c" cx="15" cy="12" r="2.7" fill="currentColor" />
      <path d="M19 8.6l2.4 3.4-2.4 3.4" {...stroke} />
    </svg>
  );
}

/**
 * Total value locked. A basin with a liquid level was tried and collapsed into
 * the coin-cylinder shape at 36px; a pill holding two coins read as a toggle.
 * The term itself is "locked", so the padlock is the honest read.
 */
export function KpiMarkLocked({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("ui-mark ui-mark--locked h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <rect x="4.6" y="11" width="14.8" height="8.4" rx="2.4" {...stroke} />
      <path className="um-lock-bow" d="M8.6 11V8.4a3.4 3.4 0 0 1 6.8 0V11" {...stroke} />
      <circle cx="12" cy="15.2" r="1.6" fill="currentColor" />
    </svg>
  );
}

/**
 * Markets — tokens that have a pool. Every Ergo CFMM pool quotes against ERG,
 * so a hub with satellites is the literal shape of the market set. Two rings
 * side by side were tried and read as a pair of glasses.
 */
export function KpiMarkMarkets({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("ui-mark ui-mark--markets h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <path d="M12 6.6v2.6" {...stroke} opacity={0.5} />
      <path d="M14.4 13.6l2.4 1" {...stroke} opacity={0.5} />
      <path d="M9.6 13.6l-2.4 1" {...stroke} opacity={0.5} />
      <circle className="um-mkt um-mkt-a" cx="12" cy="4.6" r="2" {...stroke} />
      <circle className="um-mkt um-mkt-b" cx="18.4" cy="15.6" r="2" {...stroke} />
      <circle className="um-mkt um-mkt-c" cx="5.6" cy="15.6" r="2" {...stroke} />
    </svg>
  );
}

/**
 * Storage rent coming due — a box with time on it.
 * Shared by all four rent horizon cards on purpose. A family whose span grew
 * with the horizon was drawn and rejected: at 36px the four variants all read
 * as a plus sign and the length difference was invisible, so the glyph would
 * have implied a distinction it could not carry. The horizon stays in the label.
 */
export function KpiMarkRentDue({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("ui-mark ui-mark--rent h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <rect x="3.4" y="8.6" width="10.4" height="9.4" rx="2.2" {...stroke} />
      <circle cx="17.4" cy="7.6" r="4.2" {...stroke} />
      <g className="um-rent-hand">
        <path d="M17.4 5.4v2.2l1.6 1" {...stroke} />
      </g>
    </svg>
  );
}

/**
 * Issued supply of one token — coins stacked with visible gaps.
 * A solid cylinder reads as a stack of disks, which in a data explorer lands as
 * "database"; the gaps keep it reading as coins.
 */
export function KpiMarkSupply({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("ui-mark ui-mark--supply h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <ellipse className="um-coin um-coin-a" cx="12" cy="6.6" rx="6.4" ry="2.4" {...stroke} />
      <ellipse className="um-coin um-coin-b" cx="12" cy="12" rx="6.4" ry="2.4" {...stroke} />
      <ellipse cx="12" cy="17.4" rx="6.4" ry="2.4" {...stroke} />
    </svg>
  );
}

/**
 * How many distinct tokens the catalog holds. Discs, because a token reads as a
 * disc everywhere else on this page (TokenLogo), and the faint fourth is "and
 * more". Three interlocked rings were tried first and read as a car badge.
 */
export function KpiMarkTokenSet({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("ui-mark ui-mark--tokenset h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <circle cx="8.4" cy="8.4" r="3.1" {...stroke} />
      <circle cx="15.6" cy="8.4" r="3.1" {...stroke} />
      <circle cx="8.4" cy="15.6" r="3.1" {...stroke} />
      <circle className="um-more" cx="15.6" cy="15.6" r="3.1" {...stroke} opacity={0.4} />
    </svg>
  );
}

/**
 * Value a transaction moved. A billfold meant an address balance; a tx holds
 * nothing. The card body already draws the in/out flow, so this states the
 * quantity and lets the movement pass through it.
 */
export function KpiMarkAmount({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("ui-mark ui-mark--amount h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <circle cx="12" cy="12" r="5.2" {...stroke} />
      <path d="M2.4 12h4" {...stroke} />
      <g className="um-amt-out">
        <path d="M17.6 12h3.2" {...stroke} />
        <path d="M18.9 9.9 21.2 12l-2.3 2.1" {...stroke} />
      </g>
    </svg>
  );
}

/**
 * Measured extent, for cards that lead with a size in bytes — a block's
 * "7.2KB" or a tx's "652B", with any percentage kept to the caption.
 * A level would put the emphasis on a share the card does not lead with.
 */
export function KpiMarkPayload({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("ui-mark ui-mark--payload h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <rect x="4.2" y="5.8" width="15.6" height="8.6" rx="2.2" {...stroke} />
      <path d="M4.2 17.2v2.4" {...stroke} />
      <path d="M19.8 17.2v2.4" {...stroke} />
      <path className="um-measure" d="M4.2 18.4h15.6" {...stroke} />
    </svg>
  );
}

/**
 * All confirmed txs on the indexed chain. A stack of records — not a queue
 * (KpiMarkWaiting) and not a single hop (KpiMarkTxFlow).
 */
export function KpiMarkTxTotal({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("ui-mark ui-mark--txtotal h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <rect
        className="um-stack um-stack-c"
        x="7.4"
        y="4.4"
        width="12.2"
        height="8"
        rx="1.8"
        {...stroke}
        opacity={0.38}
      />
      <rect
        className="um-stack um-stack-b"
        x="5.7"
        y="7.2"
        width="12.2"
        height="8"
        rx="1.8"
        {...stroke}
        opacity={0.68}
      />
      <rect className="um-stack um-stack-a" x="4" y="10" width="12.2" height="8" rx="1.8" {...stroke} />
      <path className="um-stack-line" d="M6.2 13h8" {...stroke} />
      <path d="M6.2 15.4h5.2" {...stroke} opacity={0.45} />
    </svg>
  );
}

/**
 * Transactions queued for inclusion. Boxes lined up before a block, the
 * furthest one faded because the tail keeps arriving. This is a count of
 * things waiting — not a fill percentage, which is what KpiMarkFill says.
 */
export function KpiMarkWaiting({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("ui-mark ui-mark--waiting h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <rect x="14.6" y="6.4" width="6.4" height="11.2" rx="2" {...stroke} />
      <rect className="um-q um-q-a" x="10" y="10.2" width="3" height="3.6" rx="1" {...stroke} fill="currentColor" />
      <rect className="um-q um-q-b" x="5.6" y="10.2" width="3" height="3.6" rx="1" {...stroke} fill="currentColor" />
      <rect x="1.6" y="10.2" width="2.4" height="3.6" rx="0.9" {...stroke} opacity={0.42} />
    </svg>
  );
}

/**
 * Transactions per block — how densely the tape packs. Dots inside one block,
 * so it reads as "this many, inside each of these" rather than as a rate.
 */
export function KpiMarkPerBlock({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("ui-mark ui-mark--perblock h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <rect x="3.6" y="5.6" width="16.8" height="12.8" rx="3" {...stroke} />
      {/* Scattered on purpose: an even grid reads as a dice face at 36px. */}
      <circle className="um-pb um-pb-a" cx="7.9" cy="9.6" r="1.3" fill="currentColor" />
      <circle className="um-pb um-pb-b" cx="13.1" cy="11.1" r="1.3" fill="currentColor" />
      <circle className="um-pb um-pb-c" cx="9.4" cy="14.7" r="1.3" fill="currentColor" />
      <circle className="um-pb um-pb-d" cx="16.4" cy="14.9" r="1.3" fill="currentColor" opacity={0.45} />
    </svg>
  );
}

/**
 * A median in a spread — the thick middle tick is the p50 itself.
 * The card reports nanoERG per byte, so a clock was measuring the wrong thing.
 */
export function KpiMarkFeeMedian({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("ui-mark ui-mark--median h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M4 16.4v-2.6" {...stroke} />
      <path d="M7.4 16.4v-4.6" {...stroke} />
      <path
        className="um-mid"
        d="M12 18.8V7.2"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <path d="M16.6 16.4v-5.4" {...stroke} />
      <path d="M20 16.4v-3.2" {...stroke} />
    </svg>
  );
}

/**
 * Blocks page vocabulary. One mark per meaning, not one mark per shape:
 * a stack says position, a ring says a filled window, a dimension line says a
 * span, a bowtie says boxes in and boxes out.
 */

/**
 * A block's place in the chain — blocks ascending from a baseline, newest solid.
 * Shared with the tx page, where it replaces the `#` hash mark on the Block
 * card: `#` is this UI's glyph for an address hash, not for a block.
 */
export function KpiMarkChainTip({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--height h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M3.9 20.1h16.2" {...stroke} opacity={0.45} />
      <rect className="kpi-ht kpi-ht-a" x="4.5" y="13.9" width="4.7" height="4.7" rx="1.2" {...stroke} />
      <rect className="kpi-ht kpi-ht-b" x="9.65" y="9.75" width="4.7" height="4.7" rx="1.2" {...stroke} />
      <rect
        className="kpi-ht kpi-ht-c"
        x="14.8"
        y="5.6"
        width="4.7"
        height="4.7"
        rx="1.2"
        {...stroke}
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Blocks in the rolling 24h window — a day dial sweeping toward its target.
 * A near-closed ring reads at 36px only if the gap is wide enough to survive
 * the stroke; a 10° gap disappeared and the mark looked like an empty circle.
 */
export function KpiMarkDayTarget({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--daytarget h-9 w-9", className)}
      style={{ color: tone ?? INK.gold }}
    >
      <circle cx="12" cy="12" r="7.6" {...stroke} opacity={0.2} />
      <path
        className="kpi-ring-arc"
        d="M12 4.4A7.6 7.6 0 1 1 6.66 6.62"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <path d="M12 4.4v2.6" {...stroke} />
    </svg>
  );
}

/** Average interval — a dimension line: the measured gap between two blocks. Teal. */
export function KpiMarkSpan({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--span h-9 w-9", className)}
      style={{ color: INK.teal }}
    >
      <g className="kpi-span-end kpi-span-end-l">
        <path d="M5.4 6.9v10.2" {...stroke} />
        <path d="M8.4 9.5 5.4 12l3 2.5" {...stroke} />
      </g>
      <path d="M5.4 12h13.2" {...stroke} />
      <g className="kpi-span-end kpi-span-end-r">
        <path d="M18.6 6.9v10.2" {...stroke} />
        <path d="M15.6 9.5l3 2.5-3 2.5" {...stroke} />
      </g>
    </svg>
  );
}

/**
 * Transactions — a box spent, a box created. One direction, so it cannot be
 * read as a swap the way the old opposed arrows were.
 * A four-box bowtie was tried first and collapsed into an X at 36px.
 */
export function KpiMarkTxFlow({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--txflow h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <rect x="2.9" y="9.3" width="5.4" height="5.4" rx="1.35" {...stroke} />
      <g className="kpi-tx-arrow">
        <path d="M9.8 12h4.1" {...stroke} />
        <path d="M12.3 10.1 14.4 12l-2.1 1.9" {...stroke} />
      </g>
      <rect x="15.7" y="9.3" width="5.4" height="5.4" rx="1.35" {...stroke} />
    </svg>
  );
}

/** /blocks lead tiles — Lucide meaning set (ISC), same 24 box and 1.65 stroke. */
export function KpiMarkSquareStack({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--square-stack h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M4 10c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2" {...stroke} />
      <path d="M10 16c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2" {...stroke} />
      <rect width="8" height="8" x="14" y="14" rx="2" {...stroke} />
    </svg>
  );
}

export function KpiMarkCircleGauge({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--circle-gauge h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M15.6 2.7a10 10 0 1 0 5.7 5.7" {...stroke} />
      <circle cx="12" cy="12" r="2" {...stroke} />
      <path d="M13.4 10.6 19 5" {...stroke} />
    </svg>
  );
}

export function KpiMarkRulerDimension({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--ruler-dimension h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M10 15v-3" {...stroke} />
      <path d="M14 15v-3" {...stroke} />
      <path d="M18 15v-3" {...stroke} />
      <path d="M2 8V4" {...stroke} />
      <path d="M22 6H2" {...stroke} />
      <path d="M22 8V4" {...stroke} />
      <path d="M6 15v-3" {...stroke} />
      <rect x="2" y="12" width="20" height="8" rx="2" {...stroke} />
    </svg>
  );
}

export function KpiMarkWorkflow({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--workflow h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <rect width="8" height="8" x="3" y="3" rx="2" {...stroke} />
      <path d="M7 11v4a2 2 0 0 0 2 2h4" {...stroke} />
      <rect width="8" height="8" x="13" y="13" rx="2" {...stroke} />
    </svg>
  );
}

export function KpiMarkListEnd({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--list-end h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M16 5H3" {...stroke} />
      <path d="M16 12H3" {...stroke} />
      <path d="M9 19H3" {...stroke} />
      <path d="m16 16-3 3 3 3" {...stroke} />
      <path d="M21 5v12a2 2 0 0 1-2 2h-6" {...stroke} />
    </svg>
  );
}

export function KpiMarkBatteryMedium({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--battery-medium h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M10 14v-4" {...stroke} />
      <path d="M22 14v-4" {...stroke} />
      <path d="M6 14v-4" {...stroke} />
      <rect x="2" y="6" width="16" height="12" rx="2" {...stroke} />
    </svg>
  );
}

export function KpiMarkReceiptText({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--receipt-text h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M13 16H8" {...stroke} />
      <path d="M14 8H8" {...stroke} />
      <path d="M16 12H8" {...stroke} />
      <path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" {...stroke} />
    </svg>
  );
}

export function KpiMarkChartColumn({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--chart-column h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M5 21v-6" {...stroke} />
      <path d="M12 21V3" {...stroke} />
      <path d="M19 21V9" {...stroke} />
    </svg>
  );
}

/** /transactions lead tiles — Lucide visual set (ISC). Workflow reused from /blocks. */
export function KpiMarkLayers({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--layers h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path
        d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"
        {...stroke}
      />
      <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" {...stroke} />
      <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" {...stroke} />
    </svg>
  );
}

export function KpiMarkDice5({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--dice-5 h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" {...stroke} />
      <path d="M16 8h.01" {...stroke} />
      <path d="M8 8h.01" {...stroke} />
      <path d="M8 16h.01" {...stroke} />
      <path d="M16 16h.01" {...stroke} />
      <path d="M12 12h.01" {...stroke} />
    </svg>
  );
}

export function KpiMarkReceipt({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--receipt h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M12 17V7" {...stroke} />
      <path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8" {...stroke} />
      <path
        d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z"
        {...stroke}
      />
    </svg>
  );
}

/** /addresses kind tiles — Lucide meaning set (ISC). Tape pips use the same glyphs, still orbiting. */
export function KpiMarkLibrary({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--library h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="m16 6 4 14" {...stroke} />
      <path d="M12 6v14" {...stroke} />
      <path d="M8 8v12" {...stroke} />
      <path d="M4 4v16" {...stroke} />
    </svg>
  );
}

export function KpiMarkCpu({ className, tone, spin }: { className?: string; tone?: string; spin?: boolean }) {
  const body = (
    <>
      <path d="M12 20v2" {...stroke} />
      <path d="M12 2v2" {...stroke} />
      <path d="M17 20v2" {...stroke} />
      <path d="M17 2v2" {...stroke} />
      <path d="M2 12h2" {...stroke} />
      <path d="M2 17h2" {...stroke} />
      <path d="M2 7h2" {...stroke} />
      <path d="M20 12h2" {...stroke} />
      <path d="M20 17h2" {...stroke} />
      <path d="M20 7h2" {...stroke} />
      <path d="M7 20v2" {...stroke} />
      <path d="M7 2v2" {...stroke} />
      <rect x="4" y="4" width="16" height="16" rx="2" {...stroke} />
      <rect x="8" y="8" width="8" height="8" rx="1" {...stroke} />
    </>
  );
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx(
        "kpi-mark kpi-mark--cpu",
        spin ? "entity-mark entity-mark--protocol h-full w-full" : "h-9 w-9",
        className
      )}
      style={tone ? { color: tone } : undefined}
    >
      {spin ? <g className="em-spin">{body}</g> : body}
    </svg>
  );
}

export function KpiMarkStore({ className, tone, spin }: { className?: string; tone?: string; spin?: boolean }) {
  const body = (
    <>
      <path
        d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z"
        {...stroke}
      />
      <path d="M16 10h.01" {...stroke} />
      <path d="M2 8v1a2 2 0 0 0 2 2h1" {...stroke} />
    </>
  );
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx(
        "kpi-mark kpi-mark--store",
        spin ? "entity-mark entity-mark--exchange h-full w-full" : "h-9 w-9",
        className
      )}
      style={tone ? { color: tone } : undefined}
    >
      {spin ? <g className="em-spin">{body}</g> : body}
    </svg>
  );
}

export function KpiMarkPickaxe({ className, tone, spin }: { className?: string; tone?: string; spin?: boolean }) {
  const body = (
    <>
      <path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999" {...stroke} />
      <path
        d="M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024"
        {...stroke}
      />
      <path
        d="M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069"
        {...stroke}
      />
      <path
        d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z"
        {...stroke}
      />
    </>
  );
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx(
        "kpi-mark kpi-mark--pickaxe",
        spin ? "entity-mark entity-mark--pool h-full w-full" : "h-9 w-9",
        className
      )}
      style={tone ? { color: tone } : undefined}
    >
      {spin ? <g className="em-spin">{body}</g> : body}
    </svg>
  );
}

export function KpiMarkFileCode({ className, tone, spin }: { className?: string; tone?: string; spin?: boolean }) {
  const body = (
    <>
      <path
        d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"
        {...stroke}
      />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" {...stroke} />
      <path d="M10 12.5 8 15l2 2.5" {...stroke} />
      <path d="m14 12.5 2 2.5-2 2.5" {...stroke} />
    </>
  );
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx(
        "kpi-mark kpi-mark--file-code",
        spin ? "entity-mark entity-mark--contract h-full w-full" : "h-9 w-9",
        className
      )}
      style={tone ? { color: tone } : undefined}
    >
      {spin ? <g className="em-spin">{body}</g> : body}
    </svg>
  );
}

/** /tokens lead tiles — coins from the Tokens rail, workflow from txs, users for holders. */
/** Lucide badge-percent — a rate, used for pool APR. */
export function KpiMarkBadgePercent({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--badge-percent h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path
        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
        {...stroke}
      />
      <path d="m15 9-6 6" {...stroke} />
      <path d="M9 9h.01" {...stroke} />
      <path d="M15 15h.01" {...stroke} />
    </svg>
  );
}

/** Lucide hand-coins — fees kept by the pool, not a wallet balance. */
export function KpiMarkHandCoins({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--hand-coins h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" {...stroke} />
      <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" {...stroke} />
      <path d="m2 16 6 6" {...stroke} />
      <circle cx="16" cy="9" r="2.9" {...stroke} />
      <circle cx="6" cy="5" r="3" {...stroke} />
    </svg>
  );
}

export function KpiMarkCoins({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--coins h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M13.744 17.736a6 6 0 1 1-7.48-7.48" {...stroke} />
      <path d="M15 6h1v4" {...stroke} />
      <path d="m6.134 14.768.866-.5 2 3.464" {...stroke} />
      <circle cx="16" cy="8" r="6" {...stroke} />
    </svg>
  );
}

export function KpiMarkUsers({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--users h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" {...stroke} />
      <path d="M16 3.128a4 4 0 0 1 0 7.744" {...stroke} />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" {...stroke} />
      <circle cx="9" cy="7" r="4" {...stroke} />
    </svg>
  );
}

/** /nfts lead tiles — operator ticks from the two-agent sheet. */
export function KpiMarkGalleryHorizontal({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--gallery-horizontal h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M2 3v18" {...stroke} />
      <rect width="12" height="18" x="6" y="3" rx="2" {...stroke} />
      <path d="M22 3v18" {...stroke} />
    </svg>
  );
}

export function KpiMarkFingerprint({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--fingerprint h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" {...stroke} />
      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" {...stroke} />
      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" {...stroke} />
      <path d="M2 12a10 10 0 0 1 18-6" {...stroke} />
      <path d="M2 16h.01" {...stroke} />
      <path d="M21.8 16c.2-2 .131-5.354 0-6" {...stroke} />
      <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" {...stroke} />
      <path d="M8.65 22c.21-.66.45-1.32.57-2" {...stroke} />
      <path d="M9 6.8a6 6 0 0 1 9 5.2v2" {...stroke} />
    </svg>
  );
}

export function KpiMarkCaseSensitive({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--case-sensitive h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16" {...stroke} />
      <path d="M22 9v7" {...stroke} />
      <path d="M3.304 13h6.392" {...stroke} />
      <circle cx="18.5" cy="12.5" r="3.5" {...stroke} />
    </svg>
  );
}

export function KpiMarkPalette({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--palette h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path
        d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"
        {...stroke}
      />
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function KpiMarkGroup({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--group h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M3 7V5c0-1.1.9-2 2-2h2" {...stroke} />
      <path d="M17 3h2c1.1 0 2 .9 2 2v2" {...stroke} />
      <path d="M21 17v2c0 1.1-.9 2-2 2h-2" {...stroke} />
      <path d="M7 21H5c-1.1 0-2-.9-2-2v-2" {...stroke} />
      <rect width="7" height="5" x="7" y="7" rx="1" {...stroke} />
      <rect width="7" height="5" x="10" y="12" rx="1" {...stroke} />
    </svg>
  );
}

/** /rent lead tiles — operator ticks from the meaning row. */
export function KpiMarkCheckCheck({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--check-check h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M18 6 7 17l-5-5" {...stroke} />
      <path d="m22 10-7.5 7.5L13 16" {...stroke} />
    </svg>
  );
}

export function KpiMarkClock({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--clock h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <circle cx="12" cy="12" r="10" {...stroke} />
      <path d="M12 6v6l4 2" {...stroke} />
    </svg>
  );
}

export function KpiMarkCalendar({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--calendar h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M8 2v3" {...stroke} />
      <path d="M16 2v3" {...stroke} />
      <rect x="3" y="3" width="18" height="18" rx="2" {...stroke} />
      <path d="M3 9h18" {...stroke} />
    </svg>
  );
}

export function KpiMarkCalendarRange({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--calendar-range h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" {...stroke} />
      <path d="M16 2v3" {...stroke} />
      <path d="M3 9h18" {...stroke} />
      <path d="M8 2v3" {...stroke} />
      <path d="M17 13h-6" {...stroke} />
      <path d="M13 17H7" {...stroke} />
      <path d="M7 13h.01" {...stroke} />
      <path d="M17 17h.01" {...stroke} />
    </svg>
  );
}

/** AgeUSD reserve — Lucide `vault`. ERG sitting in the bank, not a pool lock. */
export function KpiMarkVault({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--vault h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" {...stroke} />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
      <path d="m7.9 7.9 2.7 2.7" {...stroke} />
      <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
      <path d="m13.4 10.6 2.7-2.7" {...stroke} />
      <circle cx="7.5" cy="16.5" r=".5" fill="currentColor" />
      <path d="m7.9 16.1 2.7-2.7" {...stroke} />
      <circle cx="16.5" cy="16.5" r=".5" fill="currentColor" />
      <path d="m13.4 13.4 2.7 2.7" {...stroke} />
      <circle cx="12" cy="12" r="2" {...stroke} />
    </svg>
  );
}

/** /lithos + ErgoDex KPI — operator ticks; same four facts on both pages. */
export function KpiMarkLock({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--lock h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" {...stroke} />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" {...stroke} />
    </svg>
  );
}

export function KpiMarkTrendingUp({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--trending-up h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M16 7h6v6" {...stroke} />
      <path d="m22 7-8.5 8.5-5-5L2 17" {...stroke} />
    </svg>
  );
}

export function KpiMarkHandshake({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--handshake h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="m11 17 2 2a1 1 0 1 0 3-3" {...stroke} />
      <path
        d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"
        {...stroke}
      />
      <path d="m21 3 1 11h-2" {...stroke} />
      <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" {...stroke} />
      <path d="M3 4h8" {...stroke} />
    </svg>
  );
}

export function KpiMarkTally5({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--tally-5 h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M4 4v16" {...stroke} />
      <path d="M9 4v16" {...stroke} />
      <path d="M14 4v16" {...stroke} />
      <path d="M19 4v16" {...stroke} />
      <path d="M22 6 2 18" {...stroke} />
    </svg>
  );
}

/** /oracles KPI — mix ticked on the two-agent sheet; same five on USD v1, USD v2, XAU. */
export function KpiMarkScale({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--scale h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M12 3v18" {...stroke} />
      <path d="m19 8 3 8a5 5 0 0 1-6 0zV7" {...stroke} />
      <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" {...stroke} />
      <path d="m5 8 3 8a5 5 0 0 1-6 0zV7" {...stroke} />
      <path d="M7 21h10" {...stroke} />
    </svg>
  );
}

export function KpiMarkQuote({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--quote h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path
        d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"
        {...stroke}
      />
      <path
        d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"
        {...stroke}
      />
    </svg>
  );
}

export function KpiMarkBell({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--bell h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M10.268 21a2 2 0 0 0 3.464 0" {...stroke} />
      <path
        d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"
        {...stroke}
      />
    </svg>
  );
}

export function KpiMarkMetronome({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--metronome h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M12 11.4V9.1" {...stroke} />
      <path d="m12 17 6.59-6.59" {...stroke} />
      <path
        d="m15.05 5.7-.218-.691a3 3 0 0 0-5.663 0L4.418 19.695A1 1 0 0 0 5.37 21h13.253a1 1 0 0 0 .951-1.31L18.45 16.2"
        {...stroke}
      />
      <circle cx="20" cy="9" r="2" {...stroke} />
    </svg>
  );
}

export function KpiMarkUserGroup({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--user-group h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M17 21v-1a2 2 0 00-2-2H9a2 2 0 00-2 2v1" {...stroke} />
      <path d="M19 10h1a2 2 0 012 2v1" {...stroke} />
      <path d="M5 10H4a2 2 0 00-2 2v1" {...stroke} />
      <circle cx="12" cy="11" r="3" {...stroke} />
      <circle cx="18" cy="4" r="2" {...stroke} />
      <circle cx="6" cy="4" r="2" {...stroke} />
    </svg>
  );
}

/** /rosen KPI — operator ticked the visual row. Nav keeps Lucide `bridge`. */
export function KpiMarkPlug2({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--plug-2 h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M9 2v6" {...stroke} />
      <path d="M15 2v6" {...stroke} />
      <path d="M12 17v5" {...stroke} />
      <path d="M5 8h14" {...stroke} />
      <path d="M6 11V8h12v3a6 6 0 1 1-12 0Z" {...stroke} />
    </svg>
  );
}

export function KpiMarkBadgeCheck({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--badge-check h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path
        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
        {...stroke}
      />
      <path d="m16 9-5.5 5.5L8 12" {...stroke} />
    </svg>
  );
}

export function KpiMarkPackage({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--package h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path
        d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"
        {...stroke}
      />
      <path d="M12 22V12" {...stroke} />
      <polyline points="3.29 7 12 12 20.71 7" {...stroke} />
      <path d="m7.5 4.27 9 5.15" {...stroke} />
    </svg>
  );
}

export function KpiMarkRoute({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--route h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <circle cx="6" cy="19" r="3" {...stroke} />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" {...stroke} />
      <circle cx="18" cy="5" r="3" {...stroke} />
    </svg>
  );
}

/** Address fact tiles. */
export function KpiMarkWalletMinimal({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--wallet-minimal h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M17 14h.01" {...stroke} />
      <path d="M7 7h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14" {...stroke} />
    </svg>
  );
}

export function KpiMarkBox({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--box h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path
        d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
        {...stroke}
      />
      <path d="m3.3 7 8.7 5 8.7-5" {...stroke} />
      <path d="M12 22V12" {...stroke} />
    </svg>
  );
}

export function KpiMarkBubbles({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--bubbles h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M7.001 15.085A1.5 1.5 0 0 1 9 16.5" {...stroke} />
      <circle cx="18.5" cy="8.5" r="3.5" {...stroke} />
      <circle cx="7.5" cy="16.5" r="5.5" {...stroke} />
      <circle cx="7.5" cy="4.5" r="2.5" {...stroke} />
    </svg>
  );
}

export function KpiMarkScrollText({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--scroll-text h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M15 12h-5" {...stroke} />
      <path d="M15 8h-5" {...stroke} />
      <path d="M19 17V5a2 2 0 0 0-2-2H4" {...stroke} />
      <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" {...stroke} />
    </svg>
  );
}

export function KpiMarkFootprints({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--footprints h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path
        d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"
        {...stroke}
      />
      <path
        d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"
        {...stroke}
      />
      <path d="M16 17h4" {...stroke} />
      <path d="M4 13h4" {...stroke} />
    </svg>
  );
}

/** Token card description — operator ticked Lucide `info`. */
export function KpiMarkInfo({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--info h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <circle cx="12" cy="12" r="10" {...stroke} />
      <path d="M12 16v-4" {...stroke} />
      <path d="M12 8h.01" {...stroke} />
    </svg>
  );
}

/** Broken crossing — pylons with a gap in the span. */
export function KpiMarkFraud({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("kpi-mark kpi-mark--fraud h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <path d="M7 18.2V5.4" {...stroke} />
      <path d="M17 18.2V5.4" {...stroke} />
      <path d="M3.2 18.2h6.2" {...stroke} />
      <path d="M14.6 18.2h6.2" {...stroke} />
      <g className="rk-x">
        <path d="M10.4 16.2 13.6 20.2" {...stroke} />
        <path d="M13.6 16.2 10.4 20.2" {...stroke} />
      </g>
    </svg>
  );
}

/**
 * A framed picture — catalog of artworks, not a token-set of discs
 * (KpiMarkTokenSet) and not a DEX swap.
 */
export function KpiMarkNft({ className, tone }: { className?: string; tone?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("ui-mark ui-mark--nft h-9 w-9", className)}
      style={tone ? { color: tone } : undefined}
    >
      <rect x="3.4" y="4.8" width="17.2" height="14.4" rx="2.4" {...stroke} />
      <circle cx="8.6" cy="9.2" r="1.2" {...stroke} />
      <path d="M5.6 16.4 9.5 11.8l3 3.1 3.1-4.1 2.8 5.6" {...stroke} />
    </svg>
  );
}
