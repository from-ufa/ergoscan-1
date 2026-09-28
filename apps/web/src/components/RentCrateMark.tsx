import type { CSSProperties } from "react";
import clsx from "clsx";

const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.55,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/**
 * One Ergo UTXO on the home rent aisle. Line + wash, same stroke as the miner.
 * Slats = box count (1–3). `broken` = collected / due: lid ajar, one crack.
 */
export function RentCrateMark({
  broken,
  layers = 1,
  className,
  style,
}: {
  broken?: boolean;
  layers?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const slats = Math.max(1, Math.min(3, layers));
  return (
    <svg
      viewBox="0 0 32 28"
      fill="none"
      aria-hidden
      className={clsx("rent-crate-mark", broken && "is-broken", className)}
      style={style}
    >
      <path d="M19.2 13.4 26.6 9.8v9.6L19.2 23.2Z" fill="currentColor" opacity="0.1" />
      <path d="M5.2 11.4 19.2 13.4v9.8L5.2 21.2Z" fill="currentColor" opacity="0.16" />
      {broken ? (
        <path d="M5.2 11.4 13.6 3.9 25.8 6.6 17.6 13.1Z" fill="currentColor" opacity="0.22" />
      ) : (
        <path d="M5.2 11.4 12.6 7 26.6 9.8 19.2 13.4Z" fill="currentColor" opacity="0.22" />
      )}

      <path d="M19.2 13.4 26.6 9.8v9.6L19.2 23.2Z" {...stroke} />
      <path d="M5.2 11.4 19.2 13.4v9.8L5.2 21.2Z" {...stroke} />
      {broken ? (
        <path d="M5.2 11.4 13.6 3.9 25.8 6.6 17.6 13.1Z" {...stroke} />
      ) : (
        <path d="M5.2 11.4 12.6 7 26.6 9.8 19.2 13.4Z" {...stroke} />
      )}

      {Array.from({ length: slats }, (_, i) => {
        const y = 14.6 + i * 2.15;
        return <path key={i} d={`M7.2 ${y} L17.6 ${y + 1.55}`} {...stroke} opacity="0.55" />;
      })}

      {broken ? <path d="M8.6 15.2 12.4 19.1" {...stroke} /> : null}
    </svg>
  );
}
