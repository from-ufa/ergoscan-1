/**
 * Lightweight RU/EN strings for ErgoScan (no next-intl dep yet).
 * Split en/ru for maintainability + reliable GitHub sync.
 */
import { en } from "./en";
import { ru } from "./ru";

export type Locale = "en" | "ru";

export const LOCALES: { id: Locale; label: string; native: string }[] = [
  { id: "en", label: "English", native: "EN" },
  { id: "ru", label: "Русский", native: "RU" },
];

export const STORAGE_KEY = "lumen-stage-locale";

type Dict = Record<string, string>;

export const MESSAGES: Record<Locale, Dict> = { en, ru };

export function translate(locale: Locale, key: string): string {
  return MESSAGES[locale]?.[key] ?? MESSAGES.en[key] ?? key;
}

export function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ru") return saved;
  } catch {
    /* */
  }
  // Public default is English. RU is a switch, not Accept-Language / navigator.language.
  return "en";
}
