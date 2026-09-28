"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { ChoiceCell, ChoiceSwatch, ChoiceSwitch } from "./ChoiceSwitch";

export function LocaleSwitch() {
  const { locale, setLocale, locales, t } = useI18n();

  return (
    <ChoiceSwitch label={t("locale.switch")} cols={2}>
      {locales.map((l) => (
        <ChoiceCell
          key={l.id}
          pressed={locale === l.id}
          onClick={() => setLocale(l.id)}
          title={l.label}
        >
          <ChoiceSwatch style={{ background: "var(--wash)" }}>
            <span className="text-[9px] font-semibold tracking-[0.04em]">{l.native}</span>
          </ChoiceSwatch>
          {l.label}
        </ChoiceCell>
      ))}
    </ChoiceSwitch>
  );
}
