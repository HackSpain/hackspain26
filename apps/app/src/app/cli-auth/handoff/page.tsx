"use client";

import { Suspense } from "react";
import { HandoffCard } from "@/components/cli-handoff";
import { AuthScreen, LoadingText } from "@/components/page";

export default function CliHandoffPage() {
  return (
    <Suspense
      fallback={
        <AuthScreen>
          <LoadingText />
        </AuthScreen>
      }
    >
      <HandoffCard />
    </Suspense>
  );
}
