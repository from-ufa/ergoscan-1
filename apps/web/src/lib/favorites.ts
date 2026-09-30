"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "favorites";
const CHANGE = "favorites-change";

export const FAVORITE_KINDS = ["addresses", "tokens", "blocks", "transactions", "pools"] as const;
export type FavoriteKind = (typeof FAVORITE_KINDS)[number];

export type FavoritesStore = Record<FavoriteKind, string[]>;

function asIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x === "string" && x) out.push(x);
  }
  return out;
}

export function emptyFavorites(): FavoritesStore {
  return { addresses: [], tokens: [], blocks: [], transactions: [], pools: [] };
}

/** Keep an older `{ addresses }` blob. Unknown keys are ignored. */
export function normalizeFavorites(raw: unknown): FavoritesStore {
  const store = emptyFavorites();
  if (!raw || typeof raw !== "object") return store;
  const o = raw as Record<string, unknown>;
  for (const kind of FAVORITE_KINDS) store[kind] = asIds(o[kind]);
  return store;
}

export function readFavorites(): FavoritesStore {
  if (typeof window === "undefined") return emptyFavorites();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyFavorites();
    return normalizeFavorites(JSON.parse(raw) as unknown);
  } catch {
    return emptyFavorites();
  }
}

function writeFavorites(store: FavoritesStore): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
  window.dispatchEvent(new Event(CHANGE));
}

/** Toggle one id. Returns whether it is in the list after the write. */
export function toggleFavoriteKind(kind: FavoriteKind, id: string): boolean {
  const store = readFavorites();
  const list = store[kind];
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  else list.push(id);
  writeFavorites(store);
  return i < 0;
}

export function toggleFavorite(id: string): boolean {
  return toggleFavoriteKind("addresses", id);
}

function useFavoriteSync(read: () => void) {
  useEffect(() => {
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key != null && e.key !== KEY) return;
      read();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE, read);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE, read);
    };
  }, [read]);
}

export function useFavoriteOf(kind: FavoriteKind, id: string) {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const read = useCallback(() => {
    setOn(readFavorites()[kind].indexOf(id) >= 0);
    setReady(true);
  }, [kind, id]);
  useFavoriteSync(read);
  const toggle = useCallback(() => {
    setOn(toggleFavoriteKind(kind, id));
  }, [kind, id]);
  return { on, ready, toggle };
}

export function useFavorite(id: string) {
  return useFavoriteOf("addresses", id);
}

/** `ids` is null until localStorage has been read — do not treat that as empty. */
export function useFavoriteList(kind: FavoriteKind) {
  const [ids, setIds] = useState<string[] | null>(null);
  const read = useCallback(() => {
    setIds(readFavorites()[kind]);
  }, [kind]);
  useFavoriteSync(read);

  const remove = useCallback(
    (id: string) => {
      const store = readFavorites();
      const i = store[kind].indexOf(id);
      if (i >= 0) {
        store[kind].splice(i, 1);
        writeFavorites(store);
      }
      setIds(readFavorites()[kind]);
    },
    [kind]
  );

  const toggle = useCallback(
    (id: string) => {
      toggleFavoriteKind(kind, id);
      setIds(readFavorites()[kind]);
    },
    [kind]
  );

  return { ids, remove, toggle };
}

export function useFavoriteAddresses() {
  return useFavoriteList("addresses");
}

export function useFavorites() {
  const [store, setStore] = useState<FavoritesStore | null>(null);
  const read = useCallback(() => {
    setStore(readFavorites());
  }, []);
  useFavoriteSync(read);
  return store;
}
