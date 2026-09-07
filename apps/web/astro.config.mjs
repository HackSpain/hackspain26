// @ts-check

import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import sentry from "@sentry/astro";
import { defineConfig } from "astro/config";

export default defineConfig({
  adapter: vercel(),
  integrations: [
    react(),
    sentry({
      project: "javascript",
      org: "hackspain",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  output: "server",
  site: "https://hackspain.com",
  trailingSlash: "never",
});
