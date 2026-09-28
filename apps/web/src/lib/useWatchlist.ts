"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "lumen-stage-watch";

type Store = { tokens: string[]; addresses: string[] };

function read(): Store {
  if (typeof window === "undefined") return { tokens: [], addresses: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { tokens: [], addresses: [] };
    const j = JSON.parse(raw) as Partial<Store>;
    return {
      tokens: Array.isArray(j.tokens)
        ? j.tokens.filter(Boolean).map((x) => String(x).toLowerCase())
        : [],
      addresses: Array.isArray(j.addresses) ? j.addresses.filter(Boolean) : [],
    };
  } catch {
    return { tokens: [], addresses: [] };
  }
}

function write(s: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
}

/** Local-only watchlist. Never sent to explorer APIs. */
export function useWatchlist() {
  const [tokens, setTokens] = useState<string[]>([]);
  const [addresses, setAddresses] = useState<string[]>([]);

  useEffect(() => {
    const s = read();
    setTokens(s.tokens);
    setAddresses(s.addresses);
  }, []);

  const persist = useCallback((next: Store) => {
    setTokens(next.tokens);
    setAddresses(next.addresses);
    write(next);
  }, []);

  return {
    tokens,
    addresses,
    addToken: (id: string) => {
      const t = id.toLowerCase();
      persist({ tokens: tokens.includes(t) ? tokens : [...tokens, t], addresses });
    },
    removeToken: (id: string) => {
      const t = id.toLowerCase();
      persist({ tokens: tokens.filter((x) => x !== t), addresses });
    },
    addAddress: (a: string) => {
      persist({
        tokens,
        addresses: addresses.includes(a) ? addresses : [...addresses, a],
      });
    },
    removeAddress: (a: string) => {
      persist({ tokens, addresses: addresses.filter((x) => x !== a) });
    },
  };
}
