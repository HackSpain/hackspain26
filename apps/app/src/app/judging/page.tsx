"use client";

import { Suspense } from "react";
import { ProjectTableFallback } from "@/components/judging/project-table";
import { JudgingPanel } from "@/components/judging/queue-panel";

export default function JudgingPage() {
  return (
    <Suspense fallback={<ProjectTableFallback title="Juzgar" />}>
      <JudgingPanel />
    </Suspense>
  );
}
