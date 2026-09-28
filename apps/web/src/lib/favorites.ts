"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "favorites";

export type FavoritesStore = { addresses: string[] };

function asIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x === "string" && x) out.push(x);
  }
  return out;
}

export function readFavorites(): FavoritesStore {
  if (typeof window === "undefined") return { addresses: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { addresses: [] };
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return { addresses: [] };
    return { addresses: asIds((j as { addresses?: unknown }).addresses) };
  } catch {
    return { addresses: [] };
  }
}

function writeFavorites(store: FavoritesStore): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ addresses: store.addresses }));
  } catch {
    /* quota / private mode */
  }
}

/** Toggle address id. Returns whether it is in the list after the write. */
export function toggleFavorite(id: string): boolean {
  const store = readFavorites();
  const i = store.addresses.indexOf(id);
  if (i >= 0) store.addresses.splice(i, 1);
  else store.addresses.push(id);
  writeFavorites(store);
  return i < 0;
}

export function useFavorite(id: string) {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOn(readFavorites().addresses.indexOf(id) >= 0);
    setReady(true);
    const sync = (e: StorageEvent) => {
      if (e.key != null && e.key !== KEY) return;
      setOn(readFavorites().addresses.indexOf(id) >= 0);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [id]);

  const toggle = useCallback(() => {
    setOn(toggleFavorite(id));
  }, [id]);

  return { on, ready, toggle };
}

/** `ids` is null until localStorage has been read — do not treat that as empty. */
export function useFavoriteAddresses() {
  const [ids, setIds] = useState<string[] | null>(null);

  useEffect(() => {
    setIds(readFavorites().addresses);
    const sync = (e: StorageEvent) => {
      if (e.key != null && e.key !== KEY) return;
      setIds(readFavorites().addresses);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const remove = useCallback((id: string) => {
    const store = readFavorites();
    const i = store.addresses.indexOf(id);
    if (i >= 0) {
      store.addresses.splice(i, 1);
      writeFavorites(store);
    }
    setIds(readFavorites().addresses);
  }, []);

  const toggle = useCallback((id: string) => {
    toggleFavorite(id);
    setIds(readFavorites().addresses);
  }, []);

  return { ids, remove, toggle };
}
