import type { NextConfig } from "next";
import { withBetterStack } from "@logtail/next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.2.2", "127.0.0.1", "localhost"],
  redirects() {
    return [
      {
        source: "/participantes",
        destination: "/people",
        permanent: true,
      },
      {
        source: "/judging-sponsors",
        destination: "/deliveries",
        permanent: true,
      },
      {
        source: "/judging-sponsors/:submissionId",
        destination: "/deliveries?project=:submissionId",
        permanent: true,
      },
      {
        source: "/admin/equipos",
        destination: "/admin/teams",
        permanent: true,
      },
      {
        source: "/admin/evento",
        destination: "/admin/event",
        permanent: true,
      },
    ];
  },
};

const configuredApp = withBetterStack(nextConfig);
const errorsDsn = process.env.NEXT_PUBLIC_BETTER_STACK_ERRORS_DSN;
const sourceMapsConfigured = Boolean(
  process.env.BETTER_STACK_API_TOKEN &&
    process.env.BETTER_STACK_ERRORS_ORG &&
    process.env.BETTER_STACK_ERRORS_PROJECT &&
    process.env.BETTER_STACK_SOURCEMAPS_URL
);

export default errorsDsn
  ? withSentryConfig(configuredApp, {
      authToken: process.env.BETTER_STACK_API_TOKEN,
      org: process.env.BETTER_STACK_ERRORS_ORG,
      project: process.env.BETTER_STACK_ERRORS_PROJECT,
      sentryUrl: process.env.BETTER_STACK_SOURCEMAPS_URL,
      silent: true,
      sourcemaps: { disable: !sourceMapsConfigured },
      telemetry: false,
    })
  : configuredApp;
