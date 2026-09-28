"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Shell } from "@/components/Shell";
import { AddrFactCard } from "@/components/AddrFactCard";
import { AddrFactMark } from "@/components/AddrFactMark";
import { HopNav } from "@/components/HopNav";
import { SegBar, segItem } from "@/components/SegBar";
import { TxBallPit } from "@/components/TxBallPit";
import { TxLaneRow } from "@/components/TxLaneRow";
import { BlockMarkMiner, BlockMarkOutput } from "@/components/block-marks";
import { KpiMarkFees, KpiMarkPayload } from "@/components/kpi-marks";
import { KpiNum } from "@/components/KpiGrid";
import { RankWindow } from "@/components/RankWindow";
import { getGateway } from "@/lib/config";
import {
  formatBlockTime,
  formatBytes,
  formatErgPrecise,
  formatRelTime,
  shortId,
  splitBlockOutput,
  toBigIntAmt,
} from "@/lib/format";
import { lookupAddress } from "@/lib/address-book";
import { minerEmissionAtHeight, ERGO_MAX_BLOCK_SIZE } from "@/lib/ergo-emission";
import { INK } from "@/lib/palette";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import { useChainTipRefresh, useKeepFresh, usePageSync } from "@/lib/page-sync";
import { SNAPSHOT_FETCH, enteringIds, snapshotPath, useEnterIds } from "@/lib/keyed-enter";
import {
  BLOCK_TX_PACK,
  parseBlockCard,
  type BlockCard,
  type BlockListItem,
  type TxListItem,
} from "@/lib/list-snapshots";
import {
  peekBlockAtHeight,
  peekBlockCard,
  peekBlockRow,
  prefetchBlockCard,
  putBlockCard,
  putBlockWindow,
} from "@/lib/block-list-cache";

const BLOCK_TABS = ["txs"] as const;
type BlockTab = (typeof BLOCK_TABS)[number];

type BlockHead = {
  id: string;
  height: number;
  timestamp: number;
  size: number;
  txCount: number;
  parentId: string | null;
  nextId: string | null;
  minerAddress: string | null;
  minerName: string | null;
  feeNano: string;
  valueNano: string;
  userValueNano?: string;
  prevTimestamp: number | null;
  payingTxCount: number | null;
};

function loc(locale: string): string {
  return locale === "ru" ? "ru-RU" : "en-US";
}

function minerLabel(address: string | null | undefined, snapName: string | null | undefined): string {
  if (snapName) return snapName;
  const book = lookupAddress(address);
  if (book?.name) return book.name;
  if (!address) return "";
  if (address.length <= 14) return address;
  return `${address.slice(0, 2)}…${address.slice(-8)}`;
}

function sizePctLabel(pct: number, locale: string): string {
  const ru = locale === "ru";
  if (pct <= 0) return ru ? "0 %" : "0%";
  const body =
    pct < 0.1 ? pct.toFixed(2) : pct < 10 ? pct.toFixed(1) : String(Math.round(pct));
  const n = ru ? body.replace(".", ",") : body;
  return ru ? `${n} %` : `${n}%`;
}

function amtStr(v: string | number | null | undefined): string {
  try {
    return toBigIntAmt(v).toString();
  } catch {
    return "0";
  }
}

function preferAmt(a?: string | number | null, b?: string | number | null): string {
  const A = toBigIntAmt(a);
  const B = toBigIntAmt(b);
  return A >= B ? A.toString() : B.toString();
}

function rowToHead(
  row: BlockListItem | null,
  older: BlockListItem | null,
  newer: BlockListItem | null
): BlockHead | null {
  if (!row) return null;
  return {
    id: row.id,
    height: row.height,
    timestamp: row.timestamp,
    size: row.size,
    txCount: row.txCount ?? 0,
    parentId: row.parentId ?? null,
    nextId: newer?.id ?? null,
    minerAddress: row.minerAddress && row.minerAddress.length ? row.minerAddress : null,
    minerName: row.minerName ?? null,
    feeNano: amtStr(row.feeNano),
    valueNano: amtStr(row.valueNano),
    userValueNano: row.userValueNano != null ? amtStr(row.userValueNano) : undefined,
    prevTimestamp: older?.timestamp ?? null,
    payingTxCount: null,
  };
}

function mergeHead(head: BlockHead | null, card: BlockCard): BlockHead {
  const base =
    head ??
    rowToHead(
      {
        id: card.id,
        height: card.height,
        timestamp: card.timestamp,
        size: card.size,
        txCount: card.txCount,
        parentId: card.parentId,
        minerAddress: card.minerAddress,
        minerName: card.minerName,
        feeNano: card.feeNano,
        valueNano: card.valueNano,
        userValueNano: card.userValueNano,
      },
      null,
      null
    )!;
  return {
    id: card.id || base.id,
    height: card.height || base.height,
    timestamp: card.timestamp || base.timestamp,
    size: base.size || card.size,
    txCount: Math.max(base.txCount, card.txCount),
    parentId: card.parentId || base.parentId,
    nextId: card.nextId || base.nextId,
    minerAddress: card.minerAddress || base.minerAddress,
    minerName: card.minerName || base.minerName,
    feeNano: preferAmt(base.feeNano, card.feeNano),
    valueNano: preferAmt(base.valueNano, card.valueNano),
    userValueNano: card.userValueNano ?? base.userValueNano,
    prevTimestamp: card.prevTimestamp ?? base.prevTimestamp,
    payingTxCount: card.payingTxCount ?? base.payingTxCount,
  };
}

function packFromCard(card: BlockCard, offset: number): TxListItem[] {
  const unbounded =
    card.pagination.limit !== BLOCK_TX_PACK &&
    card.pagination.limit !== 0 &&
    card.txs.length >= card.pagination.total &&
    card.txs.length > BLOCK_TX_PACK;
  if (unbounded) return card.txs.slice(offset, offset + BLOCK_TX_PACK);
  return card.txs;
}

export function BlockView({
  id,
  initialRow,
  olderRow,
  newerRow,
}: {
  id: string;
  initialRow: BlockListItem | null;
  olderRow: BlockListItem | null;
  newerRow: BlockListItem | null;
}) {
  const t = useT();
  const { locale } = useI18n();
  const { markSynced, tip } = usePageSync();
  const cached = peekBlockRow(id);
  const [head, setHead] = useState<BlockHead | null>(() =>
    rowToHead(
      initialRow ?? cached,
      olderRow ?? (initialRow ? peekBlockAtHeight(initialRow.height - 1) : null),
      newerRow ?? (initialRow ? peekBlockAtHeight(initialRow.height + 1) : null)
    )
  );
  const [tab] = useState<BlockTab>("txs");
  const [txs, setTxs] = useState<TxListItem[]>([]);
  const [txTotal, setTxTotal] = useState(initialRow?.txCount ?? 0);
  const [txReady, setTxReady] = useState(false);
  const [offset, setOffset] = useState(0);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const enter = useEnterIds();
  const packEnter = useEnterIds();
  const pinRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const txsRef = useRef(txs);
  const headRef = useRef(head);
  const txReadyRef = useRef(false);
  const dumpRef = useRef<TxListItem[] | null>(null);
  offsetRef.current = offset;
  txsRef.current = txs;
  headRef.current = head;

  const revealTxs = useCallback(
    (pack: TxListItem[], mode: "enter-all" | "enter-new") => {
      const prev = txsRef.current;
      const first = prev.length === 0;
      const ids =
        mode === "enter-all" || first
          ? pack.map((row) => row.id)
          : enteringIds(prev, pack);
      txReadyRef.current = true;
      txsRef.current = pack;
      if (first) packEnter.mark(["pack"]);
      enter.mark(ids);
      setTxs(pack);
      setTxReady(true);
    },
    [enter.mark, packEnter.mark]
  );

  const load = useCallback(
    (silent = false, headerOnly = false) => {
      const want = offsetRef.current;
      if (!silent && txsRef.current.length && !headerOnly) setPending(true);
      const limit = headerOnly ? 0 : BLOCK_TX_PACK;
      const h = tip?.height;
      const path = snapshotPath(
        `/v1/blocks/${encodeURIComponent(id)}?limit=${limit}&offset=${want}`,
        h
      );
      return fetch(`${getGateway()}${path}`, SNAPSHOT_FETCH)
        .then(async (r) => {
          if (r.status === 404) throw new Error("not_found");
          if (!r.ok) throw new Error(String(r.status));
          return r.json() as Promise<unknown>;
        })
        .then((j) => {
          const next = parseBlockCard(j);
          if (!next) throw new Error("bad_payload");
          if (!headerOnly && want !== offsetRef.current) return;
          putBlockCard(next);
          setHead((prev) => mergeHead(prev, next));
          setTxTotal(next.pagination.total || next.txCount);
          setErr(null);
          markSynced(next.updatedAt);
          if (headerOnly) return;
          const unbounded =
            next.pagination.limit !== BLOCK_TX_PACK && next.txs.length > BLOCK_TX_PACK;
          dumpRef.current = unbounded ? next.txs : null;
          const pack = packFromCard(next, want);
          const prev = txsRef.current;
          const swap =
            prev.length > 0 && pack.length > 0 && enteringIds(prev, pack).length === pack.length;
          revealTxs(pack, !txReadyRef.current || swap ? "enter-all" : "enter-new");
        })
        .catch((e) => {
          if (!silent && !headRef.current) setErr(String(e));
          if (!txsRef.current.length && !headRef.current) {
            txReadyRef.current = true;
            setTxReady(true);
          }
        })
        .finally(() => {
          if (!silent) setPending(false);
        });
    },
    [id, markSynced, revealTxs, tip?.height]
  );

  const loadRef = useRef(load);
  loadRef.current = load;

  useLayoutEffect(() => {
    if (headRef.current) return;
    const row = peekBlockRow(id);
    if (!row) return;
    setHead(
      rowToHead(row, peekBlockAtHeight(row.height - 1), peekBlockAtHeight(row.height + 1))
    );
    setTxTotal(row.txCount ?? 0);
  }, [id]);

  const painted = useRef(false);
  useEffect(() => {
    if (painted.current) return;
    painted.current = true;
    if (initialRow) putBlockWindow([initialRow]);
    const cachedCard = peekBlockCard(id);
    if (cachedCard?.txs.length) {
      setHead((prev) => mergeHead(prev, cachedCard));
      setTxTotal(cachedCard.pagination.total || cachedCard.txCount);
      markSynced(cachedCard.updatedAt);
      revealTxs(packFromCard(cachedCard, 0), "enter-all");
      void loadRef.current(true, false);
      return;
    }
    void loadRef.current();
  }, [id, initialRow, markSynced, revealTxs]);

  const offsetSeen = useRef(offset);
  useEffect(() => {
    if (offsetSeen.current === offset) return;
    offsetSeen.current = offset;
    const dump = dumpRef.current;
    if (dump) {
      revealTxs(dump.slice(offset, offset + BLOCK_TX_PACK), "enter-all");
      return;
    }
    loadRef.current();
  }, [offset, revealTxs]);

  useKeepFresh((silent) => {
    void loadRef.current(silent, silent);
  });
  useChainTipRefresh(!!head, () => {
    void loadRef.current(true, true);
  });

  useLayoutEffect(() => {
    const el = pinRef.current;
    if (!el) return;
    const chrome = document.querySelector(".stage-frame header.sticky");
    const pin =
      (chrome instanceof HTMLElement ? chrome.getBoundingClientRect().height : 64) + 8;
    const obs = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 1, rootMargin: `-${pin}px 0px 0px 0px` }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [txs.length]);

  const dash = "—";
  const tipH = tip?.height ?? null;
  const confirmations =
    tipH != null && head != null ? Math.max(0, tipH - head.height) : null;
  const intervalMs =
    head?.prevTimestamp != null && head.timestamp
      ? head.timestamp - head.prevTimestamp
      : null;
  const fromIndex = !!(head?.minerAddress || head?.payingTxCount != null);
  const feeNano = toBigIntAmt(head?.feeNano);
  const { user: valueNano, emission: emissionNano } = splitBlockOutput(
    head?.valueNano,
    head?.userValueNano
  );
  const showOutput = fromIndex || valueNano > 0n || emissionNano > 0n;
  const minerAddr = head?.minerAddress && head.minerAddress.length ? head.minerAddress : null;
  const miner = minerAddr ? minerLabel(minerAddr, head?.minerName) : dash;
  const rewardNano = head ? minerEmissionAtHeight(head.height) + feeNano : 0n;
  const sizePct =
    head && head.size > 0 ? Math.min(100, (head.size / ERGO_MAX_BLOCK_SIZE) * 100) : 0;
  const cachedNext = head ? peekBlockAtHeight(head.height + 1) : null;
  const nextHref = head
    ? head.nextId
      ? `/block/${head.nextId}`
      : tip && tip.height === head.height + 1
        ? `/block/${tip.headerId}`
        : cachedNext
          ? `/block/${cachedNext.id}`
          : tipH != null && tipH > head.height
            ? `/block/${head.height + 1}`
            : null
    : null;
  const prevHref = head
    ? head.parentId
      ? `/block/${head.parentId}`
      : head.height > 0
        ? `/block/${head.height - 1}`
        : null
    : null;

  const timeCaption =
    confirmations != null
      ? intervalMs != null
        ? t("block.cap.interval")
            .replace("{n}", confirmations.toLocaleString(loc(locale)))
            .replace("{t}", formatBlockTime(intervalMs))
        : t("block.cap.time").replace("{n}", confirmations.toLocaleString(loc(locale)))
      : intervalMs != null
        ? formatBlockTime(intervalMs)
        : t("blocks.confirmations");

  // Share of reward was dropped, not reworded: fees run 0.002-0.05% of block
  // output across the indexed window, so it read "0%" on every block, and the
  // BigInt division that produced it could only ever floor to zero.
  const feeCaption =
    head?.payingTxCount != null && head.txCount > 0
      ? t("block.cap.fees")
          .replace("{n}", String(head.payingTxCount))
          .replace("{total}", head.txCount.toLocaleString(loc(locale)))
      : head?.payingTxCount != null
        ? t("block.cap.feesPaid").replace("{n}", String(head.payingTxCount))
        : dash;

  return (
    <Shell>
      {err && !head && (
        <p className="text-amber-300">
          {err.includes("not_found") ? t("block.notFound") : `${t("detail.notFound")}: ${err}`}
        </p>
      )}

      {head && (
        <div className="addr-lane">
          <div className="col-span-2 flex min-h-0 flex-col gap-2 lg:col-span-1 lg:row-span-2">
            <AddrFactCard
              className="min-h-0 h-auto flex-1"
              enter={0}
              label={t("blocks.height")}
              ink={INK.violet}
              asideLead="block"
              aside={
                <TxBallPit
                  key={head.id}
                  txs={txs}
                  ariaLabel={t("block.pit.aria")}
                />
              }
            >
              <h1 className="mt-0.5 truncate text-[17px] font-semibold leading-none tabular-nums tracking-tight">
                <KpiNum>{head.height.toLocaleString(loc(locale))}</KpiNum>
              </h1>
              <p className="mt-0.5 flex min-w-0 items-center gap-1">
                <code className="whitespace-nowrap font-mono text-[12px] leading-none text-accent">
                  {shortId(head.id, 8)}
                </code>
                <CopyChip text={head.id} copyLabel={t("tx.copy")} copiedLabel={t("tx.copied")} />
              </p>
            </AddrFactCard>
            <SegBar cols={3} className="shrink-0">
              {BLOCK_TABS.map((idTab) => (
                <span key={idTab} className={segItem(true)}>
                  {t(`block.tab.${idTab}`)}
                </span>
              ))}
              <HopNav
                dir="back"
                pageId={head.id}
                href={prevHref}
                label={t("block.nav.back")}
                hint={
                  prevHref
                    ? t("blocks.parent") +
                      " · " +
                      (head.height - 1).toLocaleString(loc(locale))
                    : undefined
                }
                storageKey={BLOCK_HOP_KEY}
                onPrefetch={(href) => prefetchBlockCard(href.replace(/^\/block\//, ""))}
              />
              <HopNav
                dir="fwd"
                pageId={head.id}
                href={nextHref}
                label={t("block.nav.forward")}
                hint={
                  nextHref
                    ? t("blocks.next") +
                      " · " +
                      (head.height + 1).toLocaleString(loc(locale))
                    : undefined
                }
                storageKey={BLOCK_HOP_KEY}
                onPrefetch={(href) => prefetchBlockCard(href.replace(/^\/block\//, ""))}
              />
            </SegBar>
          </div>

          <AddrFactCard
            className="col-span-2 overflow-hidden lg:col-span-1 lg:row-span-2"
            enter={1}
            label={t("block.card.output")}
            ink={INK.cyan}
            mark={<BlockMarkOutput className="h-10 w-10" />}
          >
            <div className="mt-2">
              {showOutput ? (
                <KpiNum>
                  <ErgFigure nano={valueNano} locale={locale} size="lg" />
                </KpiNum>
              ) : (
                <p className="text-[28px] font-semibold leading-none text-[var(--muted)]">{dash}</p>
              )}
            </div>
            <p className="mt-2 truncate text-[13px] text-[var(--muted)]">
              {t("block.cap.output").replace("{n}", head.txCount.toLocaleString(loc(locale)))}
            </p>
            {emissionNano > 0n ? (
              <p className="mt-1 truncate text-[12px] text-[var(--muted)]">
                {formatErgPrecise(emissionNano, locale)} {t("blocks.emission")}
              </p>
            ) : null}
          </AddrFactCard>

          <AddrFactCard
            enter={2}
            label={t("block.card.miner")}
            ink={INK.sky}
            mark={<BlockMarkMiner className="h-9 w-9" />}
          >
            <p className="mt-0.5 truncate text-[17px] font-semibold leading-none tracking-tight">
              {minerAddr ? (
                <Link
                  href={`/address/${minerAddr}`}
                  className="block min-w-0 truncate text-accent hover:underline"
                >
                  {miner}
                </Link>
              ) : (
                miner
              )}
            </p>
            <p
              className="mt-0.5 truncate text-[12px] leading-none text-[var(--muted-2)]"
              title={t("block.cap.reward")}
            >
              {formatErgPrecise(rewardNano, locale)}
            </p>
          </AddrFactCard>

          <AddrFactCard
            enter={3}
            label={t("block.card.fees")}
            ink={INK.gold}
            mark={<KpiMarkFees className="h-9 w-9" />}
          >
            <p className="mt-0.5 truncate text-[17px] font-semibold leading-none tabular-nums tracking-tight">
              <KpiNum>
                {formatErgPrecise(feeNano, locale, false)}
                <span className="ml-1 text-[12px] font-medium text-[var(--muted)]">ERG</span>
              </KpiNum>
            </p>
            <p className="mt-0.5 truncate text-[12px] leading-none text-[var(--muted-2)]">
              {feeCaption}
            </p>
          </AddrFactCard>

          <AddrFactCard
            enter={4}
            label={t("block.card.size")}
            ink={INK.green}
            mark={<KpiMarkPayload className="h-9 w-9" />}
          >
            <p className="mt-0.5 truncate text-[17px] font-semibold leading-none tabular-nums tracking-tight">
              <KpiNum>{formatBytes(head.size)}</KpiNum>
            </p>
            <p className="mt-0.5 truncate text-[12px] leading-none text-[var(--muted-2)]">
              {t("block.cap.size").replace("{pct}", sizePctLabel(sizePct, locale))}
            </p>
          </AddrFactCard>

          <AddrFactCard
            enter={5}
            label={t("block.card.time")}
            ink={INK.teal}
            mark={<AddrFactMark id="clock" className="h-9 w-9" />}
          >
            <p className="mt-0.5 truncate text-[17px] font-semibold leading-none tabular-nums tracking-tight">
              <KpiNum>{head.timestamp ? formatRelTime(head.timestamp) : dash}</KpiNum>
            </p>
            <p className="mt-0.5 truncate text-[12px] leading-none text-[var(--muted-2)]">
              {timeCaption}
            </p>
          </AddrFactCard>
        </div>
      )}

      {tab === "txs" && (
        <>
          {!txReady && !err ? null : !txs.length && !err ? (
            <p className="mt-6 text-[var(--muted)]">{t("block.noTxs")}</p>
          ) : null}
          {txs.length > 0 && (
            <div className="mt-6">
              <div className="addr-sheet">
                <div ref={pinRef} className="h-px w-full" aria-hidden />
                <div className={packEnter.enterClass("pack")}>
                  <div
                    className={clsx(
                      "addr-pan transition-opacity duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
                      pending && "opacity-60"
                    )}
                  >
                    <div
                      className={clsx(
                        "addr-head addr-lane addr-lane-x block-tx-pairs text-[12px] font-medium",
                        stuck && "is-stuck"
                      )}
                    >
                      <div className="block-lane-pair">
                        <div className="min-w-0">{t("detail.tx")}</div>
                        <div className="min-w-0 justify-end">{t("blocks.txIo")}</div>
                      </div>
                      <div className="block-lane-pair">
                        <div className="min-w-0">{t("block.col.tokens")}</div>
                        <div className="min-w-0 justify-end">{t("blocks.time")}</div>
                      </div>
                      <div className="block-lane-pair">
                        <div className="min-w-0">{t("tx.fee")}</div>
                        <div className="min-w-0 justify-end">{t("txs.outputSum")}</div>
                      </div>
                      <div className="block-lane-pair">
                        <div className="min-w-0 tabular-nums">{t("blocks.txIndex")}</div>
                        <div className="min-w-0 justify-end">{t("blocks.size")}</div>
                      </div>
                    </div>
                    {txs.map((row, i) => (
                      <TxLaneRow
                        key={row.id}
                        row={row}
                        index={row.index ?? offset + i}
                        locale={locale}
                        t={t}
                        enterClass={enter.enterClass(row.id)}
                      />
                    ))}
                  </div>
                </div>
                <RankWindow
                  offset={offset}
                  pageSize={BLOCK_TX_PACK}
                  shown={txs.length}
                  total={txTotal > 0 ? txTotal : null}
                  loc={loc(locale)}
                  ofLabel={t("addresses.packOf")}
                  prevLabel={t("addresses.packPrev")}
                  nextLabel={t("addresses.packNext")}
                  tapeLabel={t("block.packTape")}
                  hint={t("block.packHint")}
                  disabled={pending}
                  onOffset={setOffset}
                />
              </div>
            </div>
          )}
        </>
      )}
    </Shell>
  );
}

const BLOCK_HOP_KEY = "lumen-block-hop";

function ErgFigure({
  nano,
  locale,
  size = "md",
}: {
  nano: bigint;
  locale?: string;
  size?: "md" | "lg";
}) {
  const core = formatErgPrecise(nano < 0n ? -nano : nano, locale, false);
  const dot = core.lastIndexOf(".");
  const intPart = dot === -1 ? core : core.slice(0, dot);
  const frac = dot === -1 ? null : core.slice(dot);
  return (
    <span className="inline-block whitespace-nowrap tabular-nums tracking-tight text-[var(--text)]">
      <span className={size === "lg" ? "text-[28px] font-semibold leading-none" : "text-[15px] font-medium"}>
        {intPart}
        {frac}
      </span>
      <span
        className={clsx(
          "ml-1 font-medium",
          size === "lg" ? "text-[13px]" : "text-[12px]",
          "text-[var(--muted)]"
        )}
      >
        ERG
      </span>
    </span>
  );
}

function CopyChip({
  text,
  copyLabel,
  copiedLabel,
}: {
  text: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setOk(true);
          window.setTimeout(() => setOk(false), 1200);
        });
      }}
      className="chip-press inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[6px] text-[var(--muted)] transition-colors duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--wash)] hover:text-[var(--text)]"
      aria-label={ok ? copiedLabel : copyLabel}
    >
      {ok ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M2.4 6.2 4.8 8.6 9.6 3.4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <rect x="4" y="4" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M3 8.2V3.4A1.2 1.2 0 0 1 4.2 2.2H8"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
