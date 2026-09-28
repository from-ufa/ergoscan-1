"use client";

import { useEffect, useRef, useState } from "react";
import { AddressTapeHead, AddressTapeRow } from "@/components/AddressTapeRow";
import { Shell } from "@/components/Shell";
import { getGateway } from "@/lib/config";
import { useFavoriteAddresses } from "@/lib/favorites";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import { useEnterIds } from "@/lib/keyed-enter";
import { useKeepFresh, usePageSync } from "@/lib/page-sync";

type Header = {
  address: string;
  nanoerg: string | null;
  tokenCount: number | null;
  txCount: number | null;
  firstTs: number | null;
  lastTs: number | null;
  firstTxId?: string | null;
  lastTxId?: string | null;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function parseHeader(id: string, j: unknown): Header {
  const o = j && typeof j === "object" ? (j as Record<string, unknown>) : null;
  const bal =
    o?.balance && typeof o.balance === "object"
      ? (o.balance as Record<string, unknown>)
      : null;
  const pag =
    o?.pagination && typeof o.pagination === "object"
      ? (o.pagination as Record<string, unknown>)
      : null;
  const txs =
    pag?.txs && typeof pag.txs === "object" ? (pag.txs as Record<string, unknown>) : null;
  const nano = bal?.confirmedNanoErg;
  return {
    address: typeof o?.address === "string" && o.address ? o.address : id,
    nanoerg: nano == null ? null : String(nano),
    tokenCount: num(o?.tokenCount),
    txCount: num(txs?.total),
    firstTs: num(o?.firstTs),
    lastTs: num(o?.lastTs),
    firstTxId: str(o?.firstTxId),
    lastTxId: str(o?.lastTxId),
  };
}

function blank(id: string): Header {
  return {
    address: id,
    nanoerg: null,
    tokenCount: null,
    txCount: null,
    firstTs: null,
    lastTs: null,
    firstTxId: null,
    lastTxId: null,
  };
}

export function FavoritesView() {
  const t = useT();
  const { locale } = useI18n();
  const loc = locale === "ru" ? "ru-RU" : "en-US";
  const { markSynced } = usePageSync();
  const { ids, remove } = useFavoriteAddresses();
  const [byId, setById] = useState<Record<string, Header>>({});
  const fetched = useRef(new Set<string>());
  const enter = useEnterIds();
  const packEnter = useEnterIds();
  const [listReady, setListReady] = useState(false);
  const knownIds = useRef<Set<string> | null>(null);
  const markEnter = enter.mark;
  const pinRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useKeepFresh(() => markSynced());

  useEffect(() => {
    if (ids == null) return;
    markSynced();
  }, [ids, markSynced]);

  useEffect(() => {
    if (ids == null) return;
    if (knownIds.current == null) {
      knownIds.current = new Set(ids);
      markEnter(ids);
      if (ids.length) packEnter.mark(["pack"]);
      setListReady(true);
    } else {
      const fresh = ids.filter((id) => !knownIds.current!.has(id));
      knownIds.current = new Set(ids);
      if (fresh.length) markEnter(fresh);
    }
    if (!ids.length) return;
    const missing = ids.filter((id) => !fetched.current.has(id));
    if (!missing.length) return;
    for (const id of missing) fetched.current.add(id);
    const gw = getGateway();
    let gone = false;
    void Promise.all(
      missing.map(async (id) => {
        try {
          const r = await fetch(
            `${gw}/v1/addresses/${encodeURIComponent(id)}?lists=0`,
            { cache: "no-store", headers: { Accept: "application/json" } }
          );
          if (!r.ok) return blank(id);
          return parseHeader(id, await r.json());
        } catch {
          return blank(id);
        }
      })
    ).then((rows) => {
      if (gone) return;
      setById((prev) => {
        const next = { ...prev };
        for (let i = 0; i < missing.length; i++) {
          const id = missing[i];
          if (!id) continue;
          next[id] = { ...(rows[i] ?? blank(id)), address: id };
        }
        return next;
      });
    });
    return () => {
      gone = true;
    };
  }, [ids, markEnter, packEnter.mark]);

  useEffect(() => {
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
  }, [ids?.length]);

  return (
    <Shell>
      {ids == null || !listReady ? null : ids.length === 0 ? (
        <p className="text-[var(--muted)]">{t("favorites.empty")}</p>
      ) : (
        <div className="addr-sheet">
          <div ref={pinRef} className="h-px w-full" aria-hidden />
          <div className="addr-pan kpi-tape">
            <AddressTapeHead
              stuck={stuck}
              address={t("addresses.colAddress")}
              name={t("addresses.colName")}
              erg={t("addresses.colErg")}
              tokens={t("addresses.colTokens")}
              txs={t("addresses.colTxs")}
              first={t("addresses.colFirst")}
              last={t("addresses.colLast")}
            />
            <div className={packEnter.enterClass("pack")}>
              {ids.map((id) => {
                const row = byId[id] ?? blank(id);
                return (
                  <AddressTapeRow
                    key={id}
                    row={row}
                    loc={loc}
                    t={t}
                    enterClass={enter.enterClass(id)}
                    fav
                    favReady
                    onToggleFav={() => remove(id)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
