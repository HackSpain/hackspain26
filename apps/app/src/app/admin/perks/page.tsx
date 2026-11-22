"use client";

import { Suspense } from "react";
import { AdminPerks } from "@/components/admin/perks-catalog";
import { LoadingText } from "@/components/page";

export default function AdminPerksPage() {
  return (
    <Suspense fallback={<LoadingText />}>
      <AdminPerks />
    </Suspense>
  );
}
