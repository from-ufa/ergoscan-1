"use client";

import type { ReactNode } from "react";
import { mergeRegistryBook, type RegistryBookRow } from "@/lib/address-book";

/** Merges before children render, on the server pass and on hydration alike, so names never flicker. */
export function RegistryBook({ rows, children }: { rows: RegistryBookRow[]; children: ReactNode }) {
  mergeRegistryBook(rows);
  return <>{children}</>;
}
