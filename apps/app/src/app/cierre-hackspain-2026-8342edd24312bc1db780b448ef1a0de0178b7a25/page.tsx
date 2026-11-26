"use client";

import { Suspense } from "react";
import { ClosingRoute } from "@/components/closing/closing-route";

export default function ClosingPage() {
  return (
    <Suspense fallback={null}>
      <ClosingRoute />
    </Suspense>
  );
}
