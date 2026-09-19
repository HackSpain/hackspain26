import type { NextConfig } from "next";
import { withBetterStack } from "@logtail/next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.2.2", "127.0.0.1", "localhost"],
  async redirects() {
    return [
      {
        source: "/admin/applications",
        destination: "/admin/perks",
        permanent: false,
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
