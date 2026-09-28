"use client";

import { useEffect, type CSSProperties } from "react";
import { AddrFactCard } from "@/components/AddrFactCard";
import { Shell } from "@/components/Shell";
import { ABOUT_DEV, ABOUT_KUSHTI, ABOUT_SUPPORT, type AboutCredit } from "@/lib/about-credits";
import { INK } from "@/lib/palette";
import { useT } from "@/lib/i18n/I18nProvider";
import { useKeepFresh, usePageSync } from "@/lib/page-sync";

export function AboutView() {
  const t = useT();
  const { markSynced } = usePageSync();

  useKeepFresh(() => markSynced());
  useEffect(() => {
    markSynced();
  }, [markSynced]);

  return (
    <Shell>
      <div className="flex flex-col gap-3">
        <AddrFactCard
          className="min-h-0 h-auto"
          enter={0}
          label={t("about.eyebrow")}
          ink={INK.cyan}
          mark={<AboutMark />}
        >
          <h1 className="mt-0.5 text-[17px] font-semibold leading-none tracking-tight">
            {t("about.title")}
          </h1>
          <p className="mt-1.5 max-w-3xl text-[12px] leading-snug text-[var(--muted-2)]">
            {t("about.lead")}
          </p>
        </AddrFactCard>

        <section className="home-tile-enter mod rounded-[20px] border border-[var(--border)] bg-[var(--module)] px-4 py-4" style={enterAt(1)}>
          <p className="max-w-3xl text-[13px] leading-relaxed text-[var(--text)]">{t("about.p1")}</p>
          <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-[var(--muted)]">
            {t("about.p2")}
          </p>
          <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-[var(--muted)]">
            {t("about.independent")}
          </p>
        </section>

        <section className="home-tile-enter mod rounded-[20px] border border-[var(--border)] bg-[var(--module)] px-4 py-4" style={enterAt(2)}>
          <h2 className="text-[15px] font-semibold text-[var(--text)]">{t("about.next.title")}</h2>
          <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-[var(--muted)]">
            {t("about.next.body")}
          </p>
        </section>

        <section className="home-tile-enter mod rounded-[20px] border border-[var(--border)] bg-[var(--module)] px-4 py-4" style={enterAt(3)}>
          <h2 className="text-[15px] font-semibold text-[var(--text)]">{t("about.thanks.title")}</h2>
          <KushtiThanks text={t("about.thanks.kushti")} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <CreditList title={t("about.dev")} rows={ABOUT_DEV} t={t} />
            <CreditList title={t("about.support")} rows={ABOUT_SUPPORT} t={t} />
          </div>
          <p className="mt-4 text-[13px] font-medium text-[var(--text)]">{t("about.thanks.foot")}</p>
        </section>
      </div>
    </Shell>
  );
}

function enterAt(i: number): CSSProperties {
  return { "--enter": i } as CSSProperties;
}

function KushtiThanks({ text }: { text: string }) {
  const handle = `@${ABOUT_KUSHTI.handle}`;
  const i = text.indexOf(handle);
  return (
    <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-[var(--muted)]">
      {i < 0 ? (
        text
      ) : (
        <>
          {text.slice(0, i)}
          <a
            href={ABOUT_KUSHTI.href}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[12px] text-[var(--accent)] transition-colors duration-[400ms] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {handle}
          </a>
          {text.slice(i + handle.length)}
        </>
      )}
    </p>
  );
}

function CreditList({
  title,
  rows,
  t,
}: {
  title: string;
  rows: readonly AboutCredit[];
  t: (key: string) => string;
}) {
  return (
    <div>
      <h3 className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--muted-2)]">
        {title}
      </h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.nameKey} className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
            <span className="text-[var(--text)]">{t(row.nameKey)}</span>
            {row.handle && row.href ? (
              <a
                href={row.href}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[12px] text-[var(--accent)] transition-colors duration-[400ms] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                @{row.handle}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AboutMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-10 w-10">
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.55" />
      <path d="M12 11.2v5" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
      <circle cx="12" cy="8.2" r="0.95" fill="currentColor" />
    </svg>
  );
}
