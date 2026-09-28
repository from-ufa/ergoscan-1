"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import clsx from "clsx";
import { Shell } from "@/components/Shell";
import { AddrFactCard } from "@/components/AddrFactCard";
import { SegBar, segItem } from "@/components/SegBar";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import { setHashTab } from "@/lib/hash-tab";
import { useKeepFresh, usePageSync } from "@/lib/page-sync";
import { getGateway } from "@/lib/config";
import { INK } from "@/lib/palette";
import {
  DOCS_ACCESS_LINKS,
  DOCS_EXAMPLE_URLS,
  DOCS_LIMIT_ROWS,
  DOCS_PUBLIC_BASE,
  DOCS_SPEC_PARAS,
  DOCS_TABS,
  DOCS_TRY_CURL,
  locCopy,
  readDocsTab,
  routesFor,
  type DocsRoute,
  type DocsSource,
  type DocsTab,
} from "@/lib/api-docs";

const TAB_KEYS: Record<DocsTab, string> = {
  start: "docs.tab.start",
  wallet: "docs.tab.wallet",
  chain: "docs.tab.chain",
  tokens: "docs.tab.tokens",
  more: "docs.tab.more",
};

const SRC_KEYS: Record<DocsSource, string> = {
  index: "docs.src.index",
  ram: "docs.src.ram",
  node: "docs.src.node",
  snapshot: "docs.src.snapshot",
};

const DOC_CARD =
  "home-tile-enter mod rounded-[20px] border border-[var(--border)] bg-[var(--module)] px-4 py-3.5";

function enterAt(i: number): CSSProperties {
  return { "--enter": i } as CSSProperties;
}

export function DocsView() {
  const t = useT();
  const { locale } = useI18n();
  const { markSynced } = usePageSync();
  const [tab, setTab] = useState<DocsTab>("start");
  const painted = useRef(false);

  useKeepFresh(() => markSynced());
  useEffect(() => {
    markSynced();
  }, [markSynced]);

  useEffect(() => {
    const onHash = () => setTab(readDocsTab());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (painted.current) return;
    painted.current = true;
    setTab(readDocsTab());
  }, []);

  const onTab = (next: DocsTab) => {
    setTab(next);
    setHashTab(next);
  };

  return (
    <Shell>
      <div className="docs-stack flex flex-col gap-2">
        <AddrFactCard
          className="min-h-0 h-auto"
          enter={0}
          label={t("docs.eyebrow")}
          ink={INK.cyan}
          mark={<ApiMark />}
        >
          <h1 className="mt-0.5 truncate text-[17px] font-semibold leading-none tracking-tight">
            {t("docs.title")}
          </h1>
          <p className="mt-1.5 text-[12px] leading-snug text-[var(--muted-2)]">
            {t("docs.lead")}
          </p>
        </AddrFactCard>

        <SegBar>
          {DOCS_TABS.map((id) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                onTab(id);
              }}
              className={segItem(tab === id)}
            >
              {t(TAB_KEYS[id])}
            </a>
          ))}
        </SegBar>

        {tab === "start" ? (
          <StartPane t={t} />
        ) : (
          <div className="docs-stack flex flex-col gap-2">
            {tab === "more" && (
              <>
                <p className="px-1 text-[12px] leading-snug text-[var(--muted)]">
                  {t("docs.more.lead")}
                </p>
                <article className={DOC_CARD} style={enterAt(1)}>
                  <p className="text-[15px] font-medium leading-none text-[var(--text)]">
                    {t("docs.more.oracles.title")}
                  </p>
                  <p className="mt-2 text-[13px] leading-snug text-[var(--muted)]">
                    {t("docs.more.oracles.body")}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <a
                      href={`${getGateway()}/v1/oracles/ergusd?range=7d`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-[14px] bg-[var(--wash)] px-3 py-2.5 transition-colors duration-[400ms] ease-[var(--ease)] hover:bg-[var(--wash-mid)]"
                    >
                      <span className="block font-mono text-[12px] text-[var(--accent)]">
                        /oracles/ergusd
                      </span>
                      <span className="mt-1 block text-[12px] text-[var(--muted)]">
                        {t("docs.more.oracles.coop")}
                      </span>
                    </a>
                    <a
                      href={`${getGateway()}/v1/prices/erg/oracle`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-[14px] bg-[var(--wash)] px-3 py-2.5 transition-colors duration-[400ms] ease-[var(--ease)] hover:bg-[var(--wash-mid)]"
                    >
                      <span className="block font-mono text-[12px] text-[var(--accent)]">
                        /prices/erg/oracle
                      </span>
                      <span className="mt-1 block text-[12px] text-[var(--muted)]">
                        {t("docs.more.oracles.eip")}
                      </span>
                    </a>
                  </div>
                </article>
              </>
            )}
            {routesFor(tab).map((route, i) => (
              <RouteCard
                key={route.id}
                route={route}
                locale={locale}
                t={t}
                enter={tab === "more" ? i + 2 : i + 1}
              />
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

function StartPane({ t }: { t: (k: string) => string }) {
  return (
    <div className="docs-stack flex flex-col gap-2">
      <article className={DOC_CARD} style={enterAt(1)}>
        <p className="text-[15px] font-medium leading-none text-[var(--text)]">
          {t("docs.intro.title")}
        </p>
        <p className="mt-2 text-[13px] leading-snug text-[var(--muted)]">{t("docs.intro.body")}</p>
        <p className="mt-2 text-[13px] leading-snug text-[var(--muted)]">{t("docs.intro.attr")}</p>
        <p className="mt-3 text-[13px] leading-none text-[var(--muted)]">{t("docs.base")}</p>
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <code className="min-w-0 truncate font-mono text-[13px] text-[var(--text)]">
            {DOCS_PUBLIC_BASE}
          </code>
          <CopyText text={DOCS_PUBLIC_BASE} copyLabel={t("tx.copy")} copiedLabel={t("tx.copied")} />
        </div>
        <p className="mt-2 text-[12px] leading-snug text-[var(--muted-2)]">{t("docs.base.note")}</p>
        <ul className="mt-3 flex flex-col gap-2">
          {DOCS_ACCESS_LINKS.map((row) => (
            <li key={row.id} className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="w-[5.5rem] shrink-0 text-[12px] text-[var(--muted)]">
                {t(`docs.access.${row.id}`)}
              </span>
              <a
                href={row.href}
                className="min-w-0 break-all font-mono text-[12px] text-[var(--accent)] transition-colors duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-[var(--soft)]"
              >
                {row.href}
              </a>
            </li>
          ))}
        </ul>
      </article>

      <article className={DOC_CARD} style={enterAt(2)}>
        <p className="text-[15px] font-medium leading-none text-[var(--text)]">
          {t("docs.spec.title")}
        </p>
        {DOCS_SPEC_PARAS.map((id) => (
          <p
            key={id}
            className="mt-2 text-[13px] leading-snug text-[var(--muted)]"
          >
            {t(`docs.spec.${id}`)}
          </p>
        ))}
      </article>

      {(["cors", "auth", "page"] as const).map((id, i) => (
        <article key={id} className={DOC_CARD} style={enterAt(3 + i)}>
          <p className="text-[15px] font-medium leading-none text-[var(--text)]">
            {t(`docs.${id}.title`)}
          </p>
          <p className="mt-2 text-[13px] leading-snug text-[var(--muted)]">
            {t(`docs.${id}.body`)}
          </p>
        </article>
      ))}

      <article className={DOC_CARD} style={enterAt(6)}>
        <p className="text-[15px] font-medium leading-none text-[var(--text)]">
          {t("docs.rate.title")}
        </p>
        <p className="mt-2 text-[13px] leading-snug text-[var(--muted)]">{t("docs.rate.body")}</p>
        <dl className="mt-3">
          {DOCS_LIMIT_ROWS.map((id, i) => (
            <div
              key={id}
              className={clsx(
                "flex gap-4 py-2",
                i === 0 ? "pt-0" : "border-t border-[var(--border)]"
              )}
            >
              <dt className="w-[6.5rem] shrink-0 text-[12px] leading-snug text-[var(--muted)]">
                {t(`docs.limit.${id}.k`)}
              </dt>
              <dd className="min-w-0 text-[13px] leading-snug text-[var(--text)]">
                {t(`docs.limit.${id}.v`)}
              </dd>
            </div>
          ))}
        </dl>
      </article>

      <article className={DOC_CARD} style={enterAt(7)}>
        <p className="text-[13px] leading-none text-[var(--muted)]">{t("docs.try.title")}</p>
        <div className="mt-3 flex flex-col gap-2">
          {DOCS_EXAMPLE_URLS.map((line) => (
            <div key={line} className="flex min-w-0 items-start gap-2">
              <a
                href={line}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 break-all font-mono text-[12px] leading-relaxed text-[var(--accent)] transition-colors duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-[var(--soft)]"
              >
                {line}
              </a>
              <CopyText text={line} copyLabel={t("tx.copy")} copiedLabel={t("tx.copied")} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {DOCS_TRY_CURL.map((line) => (
            <div key={line} className="flex min-w-0 items-start gap-2">
              <code className="min-w-0 flex-1 break-all font-mono text-[12px] leading-relaxed text-[var(--text)]">
                {line}
              </code>
              <CopyText text={line} copyLabel={t("tx.copy")} copiedLabel={t("tx.copied")} />
            </div>
          ))}
        </div>
      </article>

      <article className={DOC_CARD} style={enterAt(8)}>
        <p className="text-[13px] font-medium leading-none text-[var(--text)]">
          {t("docs.machines.title")}
        </p>
        <p className="mt-2 text-[13px] leading-snug text-[var(--muted)]">{t("docs.machines.body")}</p>
        <a
          href="/openapi.json"
          className="mt-3 inline-block text-[13px] text-[var(--accent)] transition-colors duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-[var(--soft)]"
        >
          /openapi.json
        </a>
      </article>
    </div>
  );
}

function RouteCard({
  route,
  locale,
  t,
  enter,
}: {
  route: DocsRoute;
  locale: string;
  t: (k: string) => string;
  enter: number;
}) {
  const tryHref = route.tryPath ? `${getGateway()}${route.tryPath}` : null;
  return (
    <article className={DOC_CARD} style={enterAt(enter)}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={clsx(
            "text-[11px] font-medium uppercase tracking-wider",
            route.method === "POST" ? "text-[var(--accent)]" : "text-[var(--muted-2)]"
          )}
        >
          {route.method}
        </span>
        <code className="min-w-0 break-all font-mono text-[13px] text-[var(--text)]">
          {route.path}
        </code>
        <span className="text-[11px] uppercase tracking-wider text-[var(--muted-2)]">
          {t(SRC_KEYS[route.source])}
        </span>
        {route.tag ? (
          <span className="rounded-full bg-[var(--wash)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
            {locCopy(locale, route.tag)}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[15px] font-medium leading-none text-[var(--text)]">
        {locCopy(locale, route.title)}
      </p>
      <p className="mt-2 text-[13px] leading-snug text-[var(--muted)]">
        {locCopy(locale, route.blurb)}
      </p>
      {route.query && (
        <p className="mt-2 font-mono text-[12px] leading-snug text-[var(--muted-2)]">
          {locCopy(locale, route.query)}
        </p>
      )}
      {tryHref && (
        <a
          href={tryHref}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-[13px] text-[var(--accent)] transition-colors duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-[var(--soft)]"
        >
          {t("docs.open")}
        </a>
      )}
    </article>
  );
}

function CopyText({
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
      className="chip-press shrink-0 overflow-hidden rounded-[10px] px-2 py-1 text-[12px] text-[var(--muted)] transition-colors duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[var(--wash)] hover:text-[var(--text)]"
      aria-label={ok ? copiedLabel : copyLabel}
    >
      {ok ? copiedLabel : copyLabel}
    </button>
  );
}

function ApiMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-10 w-10">
      <path
        d="M8.2 6.4 4.6 12l3.6 5.6"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.8 6.4 19.4 12l-3.6 5.6"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
