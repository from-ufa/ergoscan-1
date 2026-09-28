"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Shell } from "@/components/Shell";
import { AddressPip } from "@/components/AddressPip";
import { AddressStatTile } from "@/components/AddressStatTile";
import { BookKindMark, type BookTileId } from "@/components/BookKindMark";
import { FavoriteHeart } from "@/components/FavoriteHeart";
import { RankWindow } from "@/components/RankWindow";
import {
  BOOK_DIRECTORY_KINDS,
  countBookKinds,
  directoryKind,
  listBookEntries,
  type BookDirectoryKind,
  type BookEntry,
} from "@/lib/address-book";
import { listPip } from "@/lib/address-pips";
import { useFavoriteAddresses } from "@/lib/favorites";
import { shortId } from "@/lib/format";
import { useT, useI18n } from "@/lib/i18n/I18nProvider";
import { enteringIds, useEnterIds } from "@/lib/keyed-enter";
import { ADDRESS_PACK, type AddressListDir } from "@/lib/list-snapshots";
import { prefetchAddressPage } from "@/lib/address-page-cache";
import { INK, KIND } from "@/lib/palette";

const TILES: BookTileId[] = ["all", ...BOOK_DIRECTORY_KINDS];

const TILE_INK: Record<BookTileId, string> = {
  all: "#c5c3cc",
  protocol: KIND.protocol,
  exchange: KIND.exchange,
  pool: KIND.pool,
  contract: KIND.contract,
  wallet: INK.cyan,
};

function typeLabel(kind: BookDirectoryKind, t: (k: string) => string): string {
  if (kind === "wallet") return t("addresses.pip.holder");
  if (kind === "contract") return t("addresses.book.leftover");
  return t(`addresses.pip.${kind}`);
}

function tileLabel(id: BookTileId, t: (k: string) => string): string {
  if (id === "all") return t("addresses.book.all");
  return typeLabel(id, t);
}

function SortMark({ dir }: { dir: AddressListDir }) {
  return (
    <span className="sort-mark" aria-hidden>
      <span className={clsx("sort-caret sort-caret-up", dir === "asc" && "is-on")} />
      <span className={clsx("sort-caret sort-caret-dn", dir === "desc" && "is-on")} />
    </span>
  );
}

export function NamesView() {
  const t = useT();
  const { locale } = useI18n();
  const loc = locale === "ru" ? "ru-RU" : "en-US";
  const counts = useMemo(() => countBookKinds(), []);
  const [kind, setKind] = useState<BookTileId>("all");
  const [dir, setDir] = useState<AddressListDir>("asc");
  const [offset, setOffset] = useState(0);
  const [stuck, setStuck] = useState(false);
  const enter = useEnterIds();
  const packEnter = useEnterIds();
  const [listReady, setListReady] = useState(false);
  const pinRef = useRef<HTMLDivElement>(null);
  const idsRef = useRef<string[]>([]);
  const painted = useRef(false);

  const rows = useMemo(
    () => listBookEntries({ kind, dir }),
    [kind, dir]
  );
  const slice = useMemo(() => rows.slice(offset, offset + ADDRESS_PACK), [rows, offset]);

  useEffect(() => {
    if (offset === 0) return;
    if (offset < rows.length) return;
    setOffset(Math.max(0, Math.floor(Math.max(0, rows.length - 1) / ADDRESS_PACK) * ADDRESS_PACK));
  }, [offset, rows.length]);

  const packKey = slice.map((e) => e.address).join("|");
  useEffect(() => {
    const next = packKey ? packKey.split("|") : [];
    if (!painted.current) {
      painted.current = true;
      idsRef.current = next;
      enter.mark(next);
      if (next.length) packEnter.mark(["pack"]);
      setListReady(true);
      return;
    }
    enter.mark(
      enteringIds(
        idsRef.current.map((id) => ({ id })),
        next.map((id) => ({ id }))
      )
    );
    idsRef.current = next;
  }, [packKey, enter.mark, packEnter.mark]);

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
  }, [slice.length]);

  const { ids: favIds, toggle: toggleFav } = useFavoriteAddresses();
  const favReady = favIds != null;
  const favSet = useMemo(() => new Set(favIds ?? []), [favIds]);

  const onKind = (id: BookTileId) => {
    setKind(id);
    setOffset(0);
  };

  const onSort = () => {
    setOffset(0);
    setDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  return (
    <Shell>
      <div className="mb-3 grid grid-cols-2 items-stretch gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {TILES.map((id, i) => (
          <AddressStatTile
            key={id}
            enter={i}
            label={tileLabel(id, t)}
            n={counts[id]}
            caption={t(`names.tile.${id}Caption`)}
            detail={t(`names.tile.${id}Detail`)}
            hint={t(`names.tile.${id}Flavor`)}
            ink={TILE_INK[id]}
            loc={loc}
            mark={<BookKindMark id={id} />}
            selected={kind === id}
            onSelect={() => onKind(id)}
          />
        ))}
      </div>

      {!listReady ? null : rows.length === 0 ? (
        <p className="text-[var(--muted)]">{t("addresses.book.empty")}</p>
      ) : (
        <div className="addr-sheet">
          <div ref={pinRef} className="h-px w-full" aria-hidden />
          <div className={packEnter.enterClass("pack")}>
          <div
            className={clsx(
              "addr-head addr-lane addr-lane-x book-lane text-[12px] font-medium",
              stuck && "is-stuck"
            )}
          >
            <div
              className="flex h-full min-w-0 items-center"
              aria-sort={dir === "asc" ? "ascending" : "descending"}
            >
              <button
                type="button"
                onClick={onSort}
                aria-label={`${t("addresses.colName")}, ${
                  dir === "asc" ? t("addresses.sortAsc") : t("addresses.sortDesc")
                }`}
                className="chip-press is-pressed inline-flex shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-[10px] bg-[var(--wash-strong)] px-2 py-1.5 text-[12px] font-medium leading-none text-[var(--text)] transition-colors duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-[var(--text)]"
              >
                <span>{t("addresses.colName")}</span>
                <SortMark dir={dir} />
              </button>
            </div>
            <div className="flex h-full min-w-0 items-center">
              <span className="whitespace-nowrap text-[12px] font-medium leading-none text-[var(--muted)]">
                {t("addresses.colType")}
              </span>
            </div>
          </div>
          {slice.map((row) => (
            <NameTapeRow
              key={row.address}
              row={row}
              t={t}
              enterClass={enter.enterClass(row.address)}
              fav={favSet.has(row.address)}
              favReady={favReady}
              onToggleFav={toggleFav}
            />
          ))}
          <p className="px-3 py-2 text-[11px] text-[var(--muted-2)]">{t("addresses.book.sourceNote")}</p>
          </div>
          <RankWindow
            offset={offset}
            pageSize={ADDRESS_PACK}
            shown={slice.length}
            total={rows.length}
            loc={loc}
            ofLabel={t("addresses.packOf")}
            prevLabel={t("addresses.packPrev")}
            nextLabel={t("addresses.packNext")}
            tapeLabel={t("addresses.packTape")}
            hint={t("addresses.book.packHint")}
            disabled={false}
            onOffset={setOffset}
          />
        </div>
      )}
    </Shell>
  );
}

function NameTapeRow({
  row,
  t,
  enterClass,
  fav,
  favReady,
  onToggleFav,
}: {
  row: BookEntry;
  t: (k: string) => string;
  enterClass?: string;
  fav: boolean;
  favReady: boolean;
  onToggleFav: (id: string) => void;
}) {
  const pip = listPip(row.address);
  const kind = directoryKind(row);
  const label = kind ? typeLabel(kind, t) : t(`addresses.pip.${pip.id}`);
  const kindLabel = t(`addresses.pip.${pip.id}`);
  const aria = [row.name, shortId(row.address, 10), label].filter(Boolean).join(" · ");
  return (
    <div
      className={clsx(
        "addr-lane addr-lane-x book-lane border-t border-[var(--border-soft)] py-2.5 text-[13px]",
        enterClass
      )}
      onPointerEnter={() => prefetchAddressPage(row.address)}
    >
      <div className="min-w-0 px-3">
        <div className="flex h-[18px] min-w-0 items-center gap-2">
          <AddressPip
            address={row.address}
            nanoerg="0"
            kindLabel={kindLabel}
            className="h-[18px] w-[18px] shrink-0"
          />
          <Link
            href={`/address/${encodeURIComponent(row.address)}`}
            aria-label={aria}
            className="min-w-0 truncate leading-none text-soft hover:underline"
            title={row.address}
            onFocus={() => prefetchAddressPage(row.address)}
          >
            {row.name}
          </Link>
          <FavoriteHeart
            size="sm"
            on={fav}
            ready={favReady}
            title={fav ? t("favorites.remove") : t("favorites.add")}
            onToggle={() => onToggleFav(row.address)}
          />
        </div>
        <p className="mt-0.5 truncate pl-[26px] font-mono text-[11px] leading-none text-[var(--muted)]">
          {shortId(row.address, 10)}
        </p>
      </div>
      <div className="flex min-w-0 items-center px-3 leading-none text-[var(--muted)]">{label}</div>
    </div>
  );
}
