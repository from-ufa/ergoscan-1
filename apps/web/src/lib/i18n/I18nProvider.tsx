"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  detectLocale,
  LOCALES,
  STORAGE_KEY,
  translate,
  type Locale,
} from "./messages";

type I18nCtx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  locales: typeof LOCALES;
};

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocaleState(detectLocale());
    setReady(true);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* */
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = l;
    }
  }, []);

  useEffect(() => {
    if (ready) document.documentElement.lang = locale;
  }, [locale, ready]);

  const t = useCallback((key: string) => translate(locale, key), [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t, locales: LOCALES }),
    [locale, setLocale, t]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Safe fallback if provider missing
    return {
      locale: "en",
      setLocale: () => {},
      t: (k) => translate("en", k),
      locales: LOCALES,
    };
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}
