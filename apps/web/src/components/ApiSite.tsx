"use client";

import { useEffect, type CSSProperties } from "react";
import { AddrFactCard } from "@/components/AddrFactCard";
import { INK } from "@/lib/palette";
import { useT } from "@/lib/i18n/I18nProvider";
import { useKeepFresh, usePageSync } from "@/lib/page-sync";

const WALLET_PATHS = [
  "GET /boxes/unspent/byAddress/{address}",
  "GET /boxes/unspent/unconfirmed/byAddress/{address}",
  "GET /boxes/unspent/byTokenId/{tokenId}",
  "GET /boxes/{boxId}",
  "GET /transactions/{txId}",
  "GET /addresses/{address}/balance/confirmed",
  "GET /addresses/{address}/balance/total",
  "GET /addresses/{address}/transactions",
  "GET /tokens/{tokenId}",
  "GET /tokens/bySymbol/{symbol}",
  "GET /epochs/params",
  "GET /blocks/headers",
  "GET /info",
  "GET /networkState",
  "POST /mempool/transactions/submit",
] as const;

const HOLES = [
  "POST /api/v1/boxes/search",
  "POST /api/v1/boxes/unspent/search",
  "POST /api/v1/boxes/unspent/search/union",
  "GET /api/v1/boxes/unspent/stream",
  "GET /api/v1/blocks/byGlobalIndex/stream",
] as const;

const COMPARE = ["paths", "amounts", "numbers", "byid", "holes"] as const;

function enterAt(i: number): CSSProperties {
  return { "--enter": i } as CSSProperties;
}

export function ApiSite() {
  const t = useT();
  const { markSynced } = usePageSync();
  useKeepFresh(() => markSynced());
  useEffect(() => {
    markSynced();
  }, [markSynced]);

  return (
    <div className="docs-stack flex flex-col gap-2">
      <AddrFactCard
        className="min-h-0 h-auto"
        enter={0}
        label={t("apiSite.eyebrow")}
        ink={INK.cyan}
        mark={<ApiMark />}
      >
        <h1 className="mt-0.5 text-[17px] font-semibold leading-none tracking-tight">{t("apiSite.title")}</h1>
        <p className="mt-1.5 max-w-3xl text-[12px] leading-snug text-[var(--muted-2)]">{t("apiSite.lead")}</p>
        <p className="mt-3 font-mono text-[13px] text-[var(--text)]">https://api.ergoscan.me/api/v1</p>
        <p className="mt-2 text-[12px] leading-snug text-[var(--muted-2)]">{t("apiSite.same")}</p>
        <a
          href="https://ergoscan.me"
          className="mt-3 inline-block text-[13px] text-[var(--accent)] transition-colors duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-[var(--soft)]"
        >
          {t("apiSite.explorer")}
        </a>
      </AddrFactCard>

      <section
        className="home-tile-enter mod rounded-[20px] border border-[var(--border)] bg-[var(--module)] px-4 py-4"
        style={enterAt(1)}
      >
        <h2 className="text-[15px] font-semibold text-[var(--text)]">{t("apiSite.compare")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[var(--muted-2)]">
                <th className="py-2 pr-3 font-medium" />
                <th className="py-2 pr-3 font-medium">{t("apiSite.col.off")}</th>
                <th className="py-2 font-medium">{t("apiSite.col.us")}</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((id) => (
                <tr key={id} className="border-t border-[var(--border)]">
                  <th className="py-2.5 pr-3 align-top font-medium text-[var(--text)]">{t(`apiSite.row.${id}`)}</th>
                  <td className="py-2.5 pr-3 align-top text-[var(--muted)]">{t(`apiSite.off.${id}`)}</td>
                  <td className="py-2.5 align-top text-[var(--text)]">{t(`apiSite.us.${id}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="home-tile-enter mod rounded-[20px] border border-[var(--border)] bg-[var(--module)] px-4 py-4"
        style={enterAt(2)}
      >
        <h2 className="text-[15px] font-semibold text-[var(--text)]">{t("apiSite.holesTitle")}</h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-[var(--muted)]">{t("apiSite.holesBody")}</p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {HOLES.map((path) => (
            <li key={path} className="font-mono text-[12px] text-[var(--text)]">
              {path}
            </li>
          ))}
        </ul>
      </section>

      <section
        className="home-tile-enter mod rounded-[20px] border border-[var(--border)] bg-[var(--module)] px-4 py-4"
        style={enterAt(3)}
      >
        <h2 className="text-[15px] font-semibold text-[var(--text)]">{t("apiSite.amountsTitle")}</h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-[var(--muted)]">{t("apiSite.amountsBody")}</p>
        <h2 className="mt-4 text-[15px] font-semibold text-[var(--text)]">{t("apiSite.indexTitle")}</h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-[var(--muted)]">{t("apiSite.indexBody")}</p>
      </section>

      <section
        className="home-tile-enter mod rounded-[20px] border border-[var(--border)] bg-[var(--module)] px-4 py-4"
        style={enterAt(4)}
      >
        <h2 className="text-[15px] font-semibold text-[var(--text)]">{t("apiSite.pathsTitle")}</h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-[var(--muted)]">{t("apiSite.pathsLead")}</p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {WALLET_PATHS.map((path) => (
            <li key={path} className="font-mono text-[12px] leading-snug text-[var(--text)]">
              {path}
            </li>
          ))}
        </ul>
        <pre className="mt-4 overflow-x-auto rounded-[12px] bg-[var(--wash)] px-3 py-2.5 font-mono text-[12px] leading-relaxed text-[var(--text)]">
{`curl -sS https://api.ergoscan.me/api/v1/info
curl -sS https://api.ergoscan.me/api/v1/epochs/params`}
        </pre>
      </section>

      <section
        className="home-tile-enter mod rounded-[20px] border border-[var(--border)] bg-[var(--module)] px-4 py-4"
        style={enterAt(5)}
      >
        <h2 className="text-[15px] font-semibold text-[var(--text)]">{t("apiSite.rateTitle")}</h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-[var(--muted)]">{t("apiSite.rateBody")}</p>
        <a
          href="https://api.ergoscan.me/openapi.json"
          className="mt-3 inline-block font-mono text-[13px] text-[var(--accent)] transition-colors duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-[var(--soft)]"
        >
          /openapi.json
        </a>
      </section>
    </div>
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
