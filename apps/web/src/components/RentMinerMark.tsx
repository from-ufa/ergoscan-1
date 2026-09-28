import clsx from "clsx";
import { INK } from "@/lib/palette";

const ink = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.65,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/**
 * Side-view miner for the Home rent gallery. Readable at ~32px:
 * hat + lamp left, pick in the open right half. Same stroke as EntityMark.
 */
export function RentMinerMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={clsx("rent-miner-mark", className)}
    >
      <path d="M5.6 12.2h12.4" {...ink} />
      <path d="M7 12.2c0-4.4 9.2-4.4 9.2 0" {...ink} />
      <circle cx="18.4" cy="10.2" r="1.35" fill={INK.cyan} stroke="none" />
      <path d="M12 13.1v8.1" {...ink} />
      <path className="rm-leg-back" d="M12 21.2 8.4 28.4" {...ink} />
      <path className="rm-leg-front" d="M12 21.2 16.2 28.4" {...ink} />
      <g className="rm-pick">
        <path d="M14.2 17.2 26.2 9.6" {...ink} />
        <path d="M23.6 7.2 28.2 8.4 25.8 12.8" {...ink} />
      </g>
    </svg>
  );
}
