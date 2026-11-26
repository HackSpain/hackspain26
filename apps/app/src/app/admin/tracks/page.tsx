"use client";

import { Suspense } from "react";
import { TracksAdmin } from "@/components/admin/tracks-admin";
import { LoadingText } from "@/components/page";

export default function AdminTracksPage() {
  return (
    <Suspense fallback={<LoadingText />}>
      <TracksAdmin />
    </Suspense>
  );
}
