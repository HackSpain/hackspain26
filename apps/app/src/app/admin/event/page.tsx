"use client";

import { Suspense } from "react";
import { AdminEvent } from "@/components/admin/event-page";
import { LoadingText } from "@/components/page";

export default function AdminEventPage() {
  return (
    <Suspense fallback={<LoadingText />}>
      <AdminEvent />
    </Suspense>
  );
}
