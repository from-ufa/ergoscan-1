"use client";

import { Shell } from "@/components/Shell";
import { useT } from "@/lib/i18n/I18nProvider";

export function BadAddressView({ address }: { address: string }) {
  const t = useT();
  return (
    <Shell>
      <section className="mod rounded-[20px] border border-[var(--border)] bg-[var(--module)] px-4 py-4">
        <h1 className="m-0 text-[17px] font-semibold leading-[1.15] tracking-tight text-[var(--warning)]">
          {t("address.bad.title")}
        </h1>
        <p className="mt-2 text-[13px] leading-[1.4] text-[var(--muted)]">{t("address.bad.body")}</p>
        <p className="mt-3 break-all font-mono text-[12px] leading-[1.4] text-[var(--text)]">{address}</p>
      </section>
    </Shell>
  );
}
