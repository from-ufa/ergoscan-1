"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import {
  INK_BG,
  INK_EVENT,
  INK_MODULE,
  SKIN_INKS,
  applyInk,
  parseSkinInk,
  type SkinInk,
} from "@/lib/skin-ink";
import { ChoiceCell, ChoiceSwatch, ChoiceSwitch } from "./ChoiceSwitch";

export function InkSwitch() {
  const t = useT();
  const [ink, setInk] = useState<SkinInk>("oled");

  useEffect(() => {
    const sync = () => setInk(parseSkinInk(document.documentElement.dataset.ink));
    sync();
    window.addEventListener(INK_EVENT, sync);
    return () => window.removeEventListener(INK_EVENT, sync);
  }, []);

  return (
    <ChoiceSwitch label={t("ink.switch")} cols={3}>
      {SKIN_INKS.map((id) => {
        const on = ink === id;
        return (
          <ChoiceCell key={id} pressed={on} onClick={() => applyInk(id)}>
            <ChoiceSwatch style={{ background: INK_BG[id] }}>
              <span
                className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-[3px]"
                style={{ background: INK_MODULE[id] }}
              />
            </ChoiceSwatch>
            {t(`ink.${id}`)}
          </ChoiceCell>
        );
      })}
    </ChoiceSwitch>
  );
}
