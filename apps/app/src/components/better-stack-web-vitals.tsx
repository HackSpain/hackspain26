"use client";

import { useReportWebVitals } from "next/web-vitals";
import { useCallback } from "react";

type NextWebVital = Parameters<Parameters<typeof useReportWebVitals>[0]>[0];
type WebVital = NextWebVital & {
  route: string;
};

const endpoint = "/betterstack/web-vitals";
let pending: WebVital[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function flush(): void {
  const metrics = pending;
  pending = [];
  flushTimer = undefined;

  const body = JSON.stringify(
    metrics.map((webVital) => ({
      dt: Date.now(),
      platform: {
        environment: process.env.NODE_ENV,
        source: "web-vital",
      },
      source: "web-vital",
      webVital,
    }))
  );

  if (navigator.sendBeacon?.(endpoint, body)) {
    return;
  }

  // Keep the browser user agent. @logtail/next's fetch fallback replaces it
  // with next-logtail, which Vercel's managed bot filter challenges.
  void fetch(endpoint, {
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => null);
}

function enqueue(metric: WebVital): void {
  pending.push(metric);
  flushTimer ??= setTimeout(flush, 1000);
}

export function BetterStackWebVitals() {
  const report = useCallback((metric: NextWebVital) => {
    enqueue({ ...metric, route: window.location.pathname });
  }, []);

  useReportWebVitals(report);
  return null;
}
