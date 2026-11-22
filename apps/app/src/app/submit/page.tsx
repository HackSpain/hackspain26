"use client";

import { Suspense } from "react";
import { SubmitPage } from "@/components/submit-page";
import { LoadingText } from "@/components/page";

export default function SubmitRoute() {
  return (
    <Suspense fallback={<LoadingText />}>
      <SubmitPage />
    </Suspense>
  );
}
