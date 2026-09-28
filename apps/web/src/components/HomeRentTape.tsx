"use client";

/**
 * Home rent: crates ride a three-row snake. The miner stays on the last row and taps each box.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useReducedMotion } from "framer-motion";
import { KpiNum } from "@/components/KpiGrid";
import { ReelText } from "@/components/ReelText";
import { RentBelt } from "@/components/RentBelt";
import { listPip } from "@/lib/address-pips";
import { formatErgPrecise, shortId } from "@/lib/format";
import { rentYardDemoPack, RENT_DEMO_MS } from "@/lib/rent-miner-patrol";
import { INK } from "@/lib/palette";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import {
  HOME_RENT_TAPE,
  rentTapeClock,
  rentTapeTone,
  type RentTapeRow,
} from "@ergoscan/shared";

function boxesLabel(n: number, t: (k: string) => string): string {
  if (n === 1) return t("home.rentBox");
  return t("home.rentBoxes").replace("{n}", String(n));
}

function whenLabel(blocksUntilRent: number, t: (k: string) => string): string {
  const clock = rentTapeClock(blocksUntilRent);
  return clock.due ? t("home.rentDue") : clock.label;
}

function toneColor(blocksUntilRent: number): string | undefined {
  const tone = rentTapeTone(blocksUntilRent);
  if (tone === "due") return INK.coral;
  if (tone === "soon") return INK.gold;
  return undefined;
}

export function HomeRentTape({
  rows,
  epochRentNano,
  previewShare = false,
  enter = 0,
}: {
  rows: RentTapeRow[];
  epochRentNano?: string | null;
  previewShare?: boolean;
  enter?: number;
}) {
  const t = useT();
  const { locale } = useI18n();
  const loc = locale === "ru" ? "ru-RU" : "en-US";
  const reduce = useReducedMotion();
  const [demoTick, setDemoTick] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [lead, setLead] = useState<string | null>(null);

  const base = useMemo(() => rows.slice(0, HOME_RENT_TAPE), [rows]);
  const pack = useMemo(
    () => (previewShare ? rentYardDemoPack(base, demoTick) : base),
    [base, previewShare, demoTick]
  );
  const rentLabel =
    epochRentNano != null && /^\d+$/.test(epochRentNano)
      ? formatErgPrecise(epochRentNano, loc)
      : null;
  const byAddr = useMemo(() => new Map(pack.map((r) => [r.address, r])), [pack]);
  const focus = hover ?? lead;
  const focusRow = focus ? byAddr.get(focus) : undefined;

  useEffect(() => {
    if (!previewShare || reduce) return;
    const kick = () => setDemoTick((n) => n + 1);
    const first = window.setTimeout(kick, 1100);
    const id = window.setInterval(kick, RENT_DEMO_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [previewShare, reduce]);

  return (
    <section
      className="home-tile-enter flex h-full min-h-0 min-w-0 flex-col max-lg:order-4 lg:h-full"
      style={{ "--enter": enter } as CSSProperties}
    >
      <article className="mod flex h-full min-h-0 flex-col rounded-[20px] border border-[var(--border)] bg-[var(--module)]">
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] px-4 py-3 sm:px-5">
          <div className="flex min-h-[38px] shrink-0 items-start justify-between gap-3">
            <h2 className="m-0 text-[17px] font-semibold leading-[1.15] tracking-tight">{t("rent.title")}</h2>
            <div className="text-right">
              <p
                className={clsx(
                  "m-0 text-[22px] font-semibold leading-none tabular-nums tracking-tight whitespace-nowrap",
                  !rentLabel && "text-[var(--muted)]"
                )}
                style={rentLabel ? { color: INK.coral } : undefined}
              >
                <ReelText text={rentLabel ?? "—"} />
              </p>
              <p className="mt-1 m-0 whitespace-nowrap text-[11px] leading-[1.15] text-[var(--muted-2)]">
                {t("home.rentEpochCollect")}
              </p>
            </div>
          </div>

          <div className="mt-3 flex min-h-[220px] min-w-0 flex-1 flex-col">
            <p
              className="mb-2 flex h-[18px] min-w-0 items-center justify-center text-center text-[13px] leading-[18px] text-[var(--muted-2)]"
              aria-live="polite"
            >
              {pack.length === 0 ? (
                t("home.rentEmpty")
              ) : focusRow && focus ? (
                <KpiNum key={focus} className="min-w-0 max-w-full">
                  <CaptionLine address={focus} row={focusRow} locale={loc} t={t} />
                </KpiNum>
              ) : null}
            </p>
            <div className="relative min-h-0 flex-1" aria-label={t("home.rentAisle")}>
              <RentBelt
                rows={pack}
                reduce={!!reduce}
                hover={hover}
                onHover={setHover}
                onLead={setLead}
              />
            </div>
          </div>

          <div className="mt-auto flex items-baseline justify-between gap-3 pt-3">
            <Link href="/rent" className="text-[13px] text-[var(--muted)] hover:text-[var(--text)]">
              {t("home.viewAll")}
            </Link>
          </div>
        </div>
      </article>
    </section>
  );
}

function CaptionLine({
  address,
  row,
  locale,
  t,
}: {
  address: string;
  row: RentTapeRow;
  locale: string;
  t: (k: string) => string;
}) {
  const meta = listPip(address, row.valueNano);
  const named = Boolean(meta.name);
  const label = meta.name || shortId(address, 10);
  const ink = toneColor(row.blocksUntilRent);
  return (
    <span className="inline-flex min-w-0 max-w-full items-baseline gap-1.5">
      <span className={clsx("min-w-0 truncate text-[var(--text)]", !named && "font-mono")}>{label}</span>
      <span className="shrink-0 text-[var(--muted-2)]">·</span>
      <span className={clsx("shrink-0 tabular-nums", !ink && "text-[var(--muted)]")} style={ink ? { color: ink } : undefined}>
        {whenLabel(row.blocksUntilRent, t)}
      </span>
      <span className="shrink-0 text-[var(--muted-2)]">·</span>
      <span className="shrink-0 tabular-nums">{boxesLabel(row.boxCount, t)}</span>
      <span className="shrink-0 text-[var(--muted-2)]">·</span>
      <span className="shrink-0 tabular-nums">{formatErgPrecise(row.rentNano, locale)}</span>
    </span>
  );
}
