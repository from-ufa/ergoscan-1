/** Public About credits. Telegram handles only — no ops contacts. */

export type AboutCredit = {
  nameKey: "about.dev.grok" | "about.dev.tim" | "about.support.richi";
  handle?: string;
  href?: string;
};

export const ABOUT_DEV: readonly AboutCredit[] = [
  { nameKey: "about.dev.grok" },
  { nameKey: "about.dev.tim", handle: "sigmanaut", href: "https://t.me/sigmanaut" },
];

export const ABOUT_SUPPORT: readonly AboutCredit[] = [
  { nameKey: "about.support.richi", handle: "RichiTP", href: "https://t.me/RichiTP" },
];

export const ABOUT_KUSHTI = {
  handle: "kushti_ru",
  href: "https://t.me/kushti_ru",
} as const;

export const ABOUT_LINKS = [
  { id: "github", href: "https://github.com/kayolo-ergoscan/ergoscan", labelKey: "about.github" },
  { id: "x", href: "https://x.com/ergoscan_me", labelKey: "about.x" },
] as const;
