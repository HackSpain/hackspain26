import { defineConfig } from "oxlint";
import astro from "ultracite/oxlint/astro";
import react from "ultracite/oxlint/react";

import base from "../../oxlint.config.mjs";

export default defineConfig({
  extends: [base, astro, react],
  ignorePatterns: base.ignorePatterns,
  rules: {
    // @sentry/astro exposes a runtime default that the import resolver misses.
    "import/default": "off",
  },
  overrides: [
    {
      files: ["src/components/share/lanyard-badge.tsx"],
      rules: {
        // Three.js and Rapier objects are mutable by design and live behind refs.
        "react/immutability": "off",
      },
    },
    {
      files: [
        "src/components/media/participants-count-up.tsx",
        "src/components/pages/landing-page.tsx",
        "src/components/referral/use-referral-href.ts",
        "src/components/share/confirmation-page.tsx",
        "src/components/share/lanyard-badge.tsx",
        "src/components/share/use-device-tilt.ts",
        "src/components/share/use-image-from-src.ts",
      ],
      rules: {
        // These effects synchronize browser-only APIs, media queries, and decoded images.
        "react/set-state-in-effect": "off",
      },
    },
    {
      files: ["**/*.astro"],
      rules: {
        // Astro frontmatter can place exports before imports by design.
        "import/first": "off",
        "unicorn/prefer-module": "off",
      },
    },
  ],
});
