"use client";

import { useState, type PointerEvent as ReactPointerEvent } from "react";

/**
 * Finger-down arming for `--float-shadow-press`.
 * CSS `:active` covers a mouse click; `is-armed` keeps the 80ms well on pointer.
 */
export function usePaperPress(enabled: boolean) {
  const [armed, setArmed] = useState(false);

  const arm = () => {
    if (!enabled) return;
    setArmed(true);
  };

  const disarm = () => setArmed(false);

  const bind = enabled
    ? {
        onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
          if (e.button !== 0) return;
          arm();
        },
        onPointerUp: () => {
          requestAnimationFrame(disarm);
        },
        onPointerCancel: disarm,
        onPointerLeave: disarm,
      }
    : {};

  return { armed, arm, disarm, bind };
}
