"use client";

import { usePathname } from "next/navigation";
import { MissPanel } from "@/components/MissPanel";

export function NotFoundClient() {
  const path = usePathname() || "";
  return <MissPanel looked={path} copy="route" />;
}
