"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { chromeFor } from "@/lib/chrome";
import { useT } from "@/lib/i18n/I18nProvider";

const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

export function ChromeHeading() {
  const path = usePathname();
  const t = useT();
  const reduce = useReducedMotion();
  const { titleKey, heading } = chromeFor(path);
  const title = t(titleKey);
  const Tag = heading ? "h1" : "p";

  return (
    <div className="pointer-events-none relative h-full w-[min(20rem,46vw)] shrink-0 overflow-hidden text-center">
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={titleKey}
          className="absolute inset-0 flex items-center justify-center"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
        >
          <Tag
            data-scout="title"
            className="m-0 max-w-full truncate text-[17px] font-semibold leading-none tracking-[-0.02em] text-[var(--text)]"
          >
            {title}
          </Tag>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
