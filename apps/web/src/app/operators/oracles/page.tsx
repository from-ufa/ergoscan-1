"use client";

import { useEffect } from "react";
import { Shell } from "@/components/Shell";
import { useKeepFresh, usePageSync } from "@/lib/page-sync";

export default function OracleOperatorsPage() {
  const { markSynced } = usePageSync();
  useKeepFresh(() => markSynced());
  useEffect(() => {
    markSynced();
  }, [markSynced]);
  return <Shell />;
}
