"use client";

import { Suspense } from "react";
import { TvRoute } from "@/components/tv/tv-route";

export default function TvPage() {
  return (
    <Suspense fallback={null}>
      <TvRoute />
    </Suspense>
  );
}
