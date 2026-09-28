import clsx from "clsx";
import {
  KpiMarkCpu,
  KpiMarkFileCode,
  KpiMarkLibrary,
  KpiMarkPickaxe,
  KpiMarkStore,
} from "@/components/kpi-marks";
import type { BookDirectoryKind } from "@/lib/address-book";

const ink = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.65,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Named P2PK — a key, not the catalog holders card. */
function WalletMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={clsx("entity-mark entity-mark--wallet", className)}
    >
      <g className="em-spin">
        <circle cx="9.2" cy="9.2" r="3.05" {...ink} />
        <path d="M11.6 11.6 18.4 18.4" {...ink} />
        <path d="M15.7 15.7h2.6M17.2 17.2h2.4" {...ink} />
      </g>
    </svg>
  );
}

export type BookTileId = "all" | BookDirectoryKind;

export function BookKindMark({ id, className }: { id: BookTileId; className?: string }) {
  const box = className ?? "h-9 w-9 shrink-0";
  if (id === "all") return <KpiMarkLibrary className={box} />;
  if (id === "wallet") return <WalletMark className={box} />;
  if (id === "protocol") return <KpiMarkCpu className={box} />;
  if (id === "exchange") return <KpiMarkStore className={box} />;
  if (id === "pool") return <KpiMarkPickaxe className={box} />;
  return <KpiMarkFileCode className={box} />;
}
