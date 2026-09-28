"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/I18nProvider";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  return (
    <div className="max-w-lg">
      <h1 className="text-[28px] font-semibold tracking-tight">{t("error.title")}</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--muted)]">{t("error.body")}</p>
      {error.digest ? (
        <p className="mt-3 font-mono text-[12px] tabular-nums text-[var(--muted-2)]">
          {error.digest}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="chip-press overflow-hidden rounded-[10px] bg-[var(--wash)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--muted)] hover:text-[var(--text)]"
        >
          {t("error.retry")}
        </button>
        <Link
          href="/"
          className="chip-press overflow-hidden rounded-[10px] bg-[var(--wash)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--muted)] hover:text-[var(--text)]"
        >
          {t("nav.home")}
        </Link>
      </div>
    </div>
  );
}
