// @ts-check

import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import sentry from "@sentry/astro";
import { defineConfig } from "astro/config";

const sourceMapsConfigured = Boolean(
  process.env.BETTER_STACK_API_TOKEN &&
    process.env.BETTER_STACK_ERRORS_ORG &&
    process.env.BETTER_STACK_ERRORS_PROJECT &&
    process.env.BETTER_STACK_SOURCEMAPS_URL
);

export default defineConfig({
  adapter: vercel(),
  // Astro 7 defaults to JSX whitespace rules ("jsx"); keep the HTML-aware
  // compression from Astro 6 so spaces between inline elements survive.
  compressHTML: true,
  integrations: [
    react(),
    sentry({
      ...(sourceMapsConfigured
        ? {
            authToken: process.env.BETTER_STACK_API_TOKEN,
            org: process.env.BETTER_STACK_ERRORS_ORG,
            project: process.env.BETTER_STACK_ERRORS_PROJECT,
            url: process.env.BETTER_STACK_SOURCEMAPS_URL,
          }
        : { sourcemaps: { disable: true } }),
      telemetry: false,
    }),
  ],
  output: "server",
  site: "https://hackspain.com",
  trailingSlash: "never",
});
