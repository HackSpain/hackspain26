"use client";

import { Suspense } from "react";
import { AdminTableSkeleton } from "@/components/admin/admin-table-skeleton";
import { AdminTeams } from "@/components/admin/teams-directory";

export default function AdminTeamsPage() {
  return (
    <Suspense fallback={<AdminTableSkeleton />}>
      <AdminTeams />
    </Suspense>
  );
}
