"use client";

import { Suspense } from "react";
import { AdminTableSkeleton } from "@/components/admin/admin-table-skeleton";
import { AdminJudging } from "@/components/admin/judging-panel";

export default function AdminJudgingPage() {
  return (
    <Suspense fallback={<AdminTableSkeleton title="Jurado" />}>
      <AdminJudging />
    </Suspense>
  );
}
