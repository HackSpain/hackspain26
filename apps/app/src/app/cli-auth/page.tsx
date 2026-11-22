"use client";

import { Suspense } from "react";
import { CliAuthCard } from "@/components/cli-auth-card";
import { AuthScreen, LoadingText } from "@/components/page";

export default function CliAuthPage() {
  return (
    <Suspense
      fallback={
        <AuthScreen>
          <LoadingText />
        </AuthScreen>
      }
    >
      <CliAuthCard />
    </Suspense>
  );
}
