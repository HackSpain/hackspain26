"use client";

import { Suspense } from "react";
import { AdminCrm, CrmFallback } from "@/components/admin/people-crm";

export default function AdminCrmPage() {
  return (
    <Suspense fallback={<CrmFallback />}>
      <AdminCrm />
    </Suspense>
  );
}
