"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import clsx from "clsx";
import { Shell } from "@/components/Shell";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import { useKeepFresh, usePageSync } from "@/lib/page-sync";
import {
  INK_BG,
  INK_EVENT,
  SKIN_INKS,
  applyInk,
  parseSkinInk,
  type SkinInk,
} from "@/lib/skin-ink";

export function SettingsView() {
  const t = useT();
  const { locale, setLocale, locales } = useI18n();
  const { markSynced } = usePageSync();
  const [ink, setInk] = useState<SkinInk>("oled");

  useKeepFresh(() => markSynced());
  useEffect(() => {
    markSynced();
  }, [markSynced]);

  useEffect(() => {
    const sync = () => setInk(parseSkinInk(document.documentElement.dataset.ink));
    sync();
    window.addEventListener(INK_EVENT, sync);
    return () => window.removeEventListener(INK_EVENT, sync);
  }, []);

  return (
    <Shell>
      <div className="flex flex-col gap-3">
        <h1 className="m-0 text-[28px] font-semibold leading-none tracking-tight">{t("nav.settings")}</h1>
        <section
          className="home-tile-enter mod rounded-[20px] border border-[var(--border)] bg-[var(--module)] px-4 py-2 sm:px-5"
          style={{ "--enter": 0 } as CSSProperties}
        >
          <TumblerRow label={t("locale.switch")}>
            <Tumbler
              label={t("locale.switch")}
              value={locale}
              options={locales.map((l) => ({ id: l.id, label: l.native, title: l.label }))}
              onChange={setLocale}
            />
          </TumblerRow>
          <TumblerRow label={t("ink.switch")}>
            <Tumbler
              label={t("ink.switch")}
              value={ink}
              options={SKIN_INKS.map((id) => ({
                id,
                label: t(`ink.${id}`),
                swatch: INK_BG[id],
              }))}
              onChange={(id) => applyInk(id)}
            />
          </TumblerRow>
        </section>
      </div>
    </Shell>
  );
}

function TumblerRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <p className="m-0 text-[15px] font-semibold tracking-tight text-[var(--text)]">{label}</p>
      {children}
    </div>
  );
}

function Tumbler<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; title?: string; swatch?: string }[];
  onChange: (id: T) => void;
}) {
  const index = Math.max(0, options.findIndex((o) => o.id === value));
  return (
    <div
      className="set-tumbler"
      role="radiogroup"
      aria-label={label}
      style={{ "--n": options.length, "--i": index } as CSSProperties}
    >
      <span className="set-tumbler-thumb" aria-hidden />
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title ?? o.label}
            className={clsx("set-tumbler-opt", on && "is-on")}
            onClick={() => onChange(o.id)}
          >
            {o.swatch ? <span className="set-tumbler-swatch" style={{ background: o.swatch }} aria-hidden /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
