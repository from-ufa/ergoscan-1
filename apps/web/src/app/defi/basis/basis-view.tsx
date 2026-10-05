"use client";

import { useCallback, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { KpiGrid } from "@/components/KpiGrid";
import { KpiMarkScrollText, KpiMarkVault } from "@/components/kpi-marks";
import { TokenAvatar } from "@/components/TokenBadge";
import { INK } from "@/lib/palette";
import { shortId } from "@/lib/format";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import { useKeepFresh, usePageSync } from "@/lib/page-sync";
import { SNAPSHOT_FETCH } from "@/lib/keyed-enter";
import { getGateway } from "@/lib/config";
import type { BasisReserve, BasisSnap } from "@/lib/list-snapshots";

const TRACKER_REPO = "https://github.com/BetterMoneyLabs/basis-tracker";

function fmtUnits(amount: string, decimals: number, locale: string): string {
  const neg = amount.startsWith("-");
  const digits = amount.replace(/^-/, "").replace(/\..*$/, "") || "0";
  const places = Math.min(18, Math.max(0, Math.trunc(decimals) || 0));
  const padded = digits.padStart(places + 1, "0");
  const whole = padded.slice(0, padded.length - places) || "0";
  const frac = places ? padded.slice(padded.length - places).replace(/0+$/, "") : "";
  const grouped =
    whole.length < 16
      ? Number(whole).toLocaleString(locale)
      : whole;
  return `${neg ? "-" : ""}${grouped}${frac ? `.${frac}` : ""}`;
}

function statusLabel(
  row: BasisReserve,
  t: (k: string) => string
): string {
  if (row.status === "refundReady") return t("basis.statusRefundReady");
  if (row.status === "refund") {
    return t("basis.statusRefund").replace("{n}", row.blocksLeft ?? "—");
  }
  if (row.status === "quiet") return t("basis.statusQuiet");
  if (row.status === "noTracker") return t("basis.statusNoTracker");
  return t("basis.statusOpen");
}

export function BasisView({ initial }: { initial: BasisSnap | null }) {
  const t = useT();
  const { locale } = useI18n();
  const loc = locale === "ru" ? "ru-RU" : "en-US";
  const { markSynced } = usePageSync();
  const [snap, setSnap] = useState<BasisSnap | null>(initial);
  const miss = t("home.unavailable");

  const pull = useCallback(async () => {
    try {
      const r = await fetch(`${getGateway()}/v1/defi/basis`, SNAPSHOT_FETCH);
      if (!r.ok) return;
      setSnap((await r.json()) as BasisSnap);
    } catch {
      /* keep the pack we have */
    } finally {
      markSynced();
    }
  }, [markSynced]);
  useKeepFresh(pull);

  const ready = snap?.ok === true;
  const rows = snap?.reserves ?? [];
  const erg =
    ready && snap?.ergLockedNano != null ? fmtUnits(snap.ergLockedNano, 9, loc) : null;

  const kpis = [
    {
      label: t("basis.safes"),
      value: ready && snap?.reserveCount != null ? snap.reserveCount.toLocaleString(loc) : miss,
      unavailable: !ready,
      sub: t("basis.safesSub"),
      mark: <KpiMarkVault tone={INK.gold} />,
      ink: INK.gold,
      enter: 0,
    },
    {
      label: t("basis.erg"),
      value: erg != null ? `${erg} ERG` : miss,
      unavailable: erg == null,
      sub: t("basis.ergSub"),
      mark: <KpiMarkVault tone={INK.cyan} />,
      ink: INK.cyan,
      enter: 1,
    },
    {
      label: t("basis.tokenSafes"),
      value:
        ready && snap?.tokenReserveCount != null
          ? snap.tokenReserveCount.toLocaleString(loc)
          : miss,
      unavailable: !ready,
      sub: t("basis.tokenSafesSub"),
      mark: <KpiMarkScrollText tone={INK.violet} />,
      ink: INK.violet,
      enter: 2,
    },
    {
      label: t("basis.trackers"),
      value: ready && snap?.trackerCount != null ? snap.trackerCount.toLocaleString(loc) : miss,
      unavailable: !ready,
      sub: t("basis.trackersSub"),
      mark: <KpiMarkScrollText tone={INK.green} />,
      ink: INK.green,
      enter: 3,
    },
  ];

  return (
    <Shell>
      <KpiGrid items={kpis} dense className="mb-4 sm:grid-cols-4" />
      <article
        className="home-tile-enter mb-4 flex min-w-0 items-center gap-4 rounded-[20px] border border-[var(--border)] bg-[var(--module)] px-4 py-3"
        style={{ "--enter": 4 } as CSSProperties}
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-medium text-[var(--muted)]">{t("basis.protocol")}</h2>
          <p className="mt-2 text-[14px] font-semibold leading-none">Basis</p>
          <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-[var(--text)]">
            {t("basis.protocolBody")}
          </p>
          <a
            href={TRACKER_REPO}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-[13px] text-accent hover:underline"
          >
            {t("basis.link")}
          </a>
        </div>
        <img
          src="/basis-mark.png"
          alt=""
          width={64}
          height={96}
          className="h-24 w-auto shrink-0 object-contain"
        />
      </article>
      <div className="home-tile-enter min-w-0 overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--module)]">
        {!ready ? (
          <p className="px-4 py-6 text-[13px] text-[var(--muted)]">{t("basis.unavailable")}</p>
        ) : !rows.length ? (
          <p className="px-4 py-6 text-[13px] text-[var(--muted)]">{t("basis.empty")}</p>
        ) : (
          <>
          <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(5.5rem,1fr)_minmax(5.5rem,1fr)_auto] items-center gap-x-3 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--muted)]">
            <span>{t("basis.colLocked")}</span>
            <span>{t("basis.colOwner")}</span>
            <span>{t("basis.colTracker")}</span>
            <span className="text-right">{t("basis.colStatus")}</span>
          </div>
          <ul className="m-0 list-none border-t border-[var(--border-soft)] p-0">
            {rows.map((row) => {
              const locked =
                row.kind === "erg"
                  ? `${fmtUnits(row.nano, 9, loc)} ERG`
                  : row.collateral
                    ? `${fmtUnits(row.collateral.amount, row.collateral.decimals, loc)} ${
                        row.collateral.name || shortId(row.collateral.tokenId, 4)
                      }`
                    : "—";
              return (
                <li
                  key={row.boxId}
                  className="grid grid-cols-[minmax(0,1.6fr)_minmax(5.5rem,1fr)_minmax(5.5rem,1fr)_auto] items-center gap-x-3 border-t border-[var(--border-soft)] px-4 py-2.5 text-[13px] first:border-t-0"
                >
                  <Link
                    href={`/box/${row.boxId}`}
                    className="flex min-w-0 items-center gap-2 font-medium text-soft hover:underline"
                  >
                    {row.collateral ? (
                      <TokenAvatar tokenId={row.collateral.tokenId} symbol={row.collateral.name} size={18} />
                    ) : null}
                    <span className="min-w-0 truncate">{locked}</span>
                  </Link>
                  <span className="truncate font-mono text-[12px] text-[var(--muted)]" title={row.owner ?? undefined}>
                    {row.owner ? shortId(row.owner, 4) : "—"}
                  </span>
                  {row.trackerBoxId ? (
                    <Link
                      href={`/box/${row.trackerBoxId}`}
                      className="truncate font-mono text-[12px] text-soft hover:underline"
                      title={row.trackerNft ?? undefined}
                    >
                      {row.trackerNft ? shortId(row.trackerNft, 4) : t("basis.colTracker")}
                    </Link>
                  ) : (
                    <span className="text-[12px] text-[var(--muted)]">—</span>
                  )}
                  <span className="whitespace-nowrap text-right text-[12px] text-[var(--muted)]">
                    {statusLabel(row, t)}
                  </span>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </div>
    </Shell>
  );
}
