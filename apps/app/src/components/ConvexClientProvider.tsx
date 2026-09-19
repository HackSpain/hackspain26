"use client";

import { useConvexAuth } from "@convex-dev/auth/react";
import { captureException } from "@sentry/nextjs";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useEffect, useMemo } from "react";
import { recoveringTokenFetcher } from "@/lib/session-refresh";
import type { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.warn("NEXT_PUBLIC_CONVEX_URL is not set");
}

const convex = new ConvexReactClient(convexUrl ?? "");

function useRecoverableAuth() {
  const { fetchAccessToken, ...auth } = useConvexAuth();
  const recovery = useMemo(() => recoveringTokenFetcher(fetchAccessToken, (error) => {
    captureException(error, { tags: { operation: "session-refresh-recovery" } });
  }), [fetchAccessToken]);
  useEffect(() => () => recovery.cancel(), [recovery, auth.isAuthenticated]);
  return { ...auth, fetchAccessToken: recovery.fetch };
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useRecoverableAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
