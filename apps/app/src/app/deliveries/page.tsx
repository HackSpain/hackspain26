"use client";

import { Suspense } from "react";
import { SponsorPanel } from "@/components/judging/deliveries-panel";
import { ProjectTableFallback } from "@/components/judging/project-table";

export default function SponsorJudgingPage() {
  return (
    <Suspense fallback={<ProjectTableFallback title="Entregas" />}>
      <SponsorPanel />
    </Suspense>
  );
}
