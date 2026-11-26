import { defineConfig } from "oxlint";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

import base from "../../oxlint.config.mjs";

export default defineConfig({
  extends: [base, react, next],
  ignorePatterns: base.ignorePatterns,
  jsPlugins: [...base.jsPlugins, "@shadcn/lint"],
  rules: {
    // Documented core set is in @shadcn/lint adoption.md (the plugin has no preset).
    // Measured on 70882ae with that five-rule config and src/components/ui/** overrides:
    // no-arbitrary-values 572, no-restyle 434, no-inline-styles 84, no-raw-colors 1,
    // require-static-classes 0. no-unknown-classes is a later adoption step, not enabled.
    // Existing Oxlint/Biome do not check these; Biome lint is off in this workspace.
    "shadcn/require-static-classes": "error",
    "shadcn/no-raw-colors": [
      "error",
      {
        // Tool FP: fill-opacity-* is SVG fill opacity, not a theme color.
        // Remove when @shadcn/lint stops classifying it as undeclared color.
        allow: ["fill-opacity-*"],
      },
    ],
    // Skipped after measurement (SETUP's no-arbitrary-values is the noisiest here):
    // no-restyle 434: Card/Table/Button callers pass typography, spacing and color;
    // enabling needs a variant/contract pass, not a class strip.
    // no-arbitrary-values 572: 281 already use theme vars via var(); 104 are TV/closing
    // cqw broadcast layout; many remaining are brand border-[3px]. SETUP starter, still noisy.
    // no-inline-styles 84: Recharts, GSAP and dynamic widths; converting is a graphics rewrite.
  },
  overrides: [
    {
      files: ["src/components/ui/**"],
      rules: {
        // Primitives compose class strings; the documented ui override turns this off there.
        "shadcn/require-static-classes": "off",
      },
    },
    {
      files: ["src/components/participant-directory/network-canvas.tsx"],
      rules: {
        // The SVG is a custom keyboard-operable graph widget with an application role.
        "jsx-a11y/no-noninteractive-element-interactions": "off",
        "jsx-a11y/no-noninteractive-tabindex": "off",
      },
    },
    {
      files: ["**/*.tsx"],
      rules: {
        // Nested JSX conditionals are idiomatic conditional rendering here.
        "no-nested-ternary": "off",
        "unicorn/no-nested-ternary": "off",
      },
    },
    {
      files: ["**/*.test.ts"],
      rules: {
        // Async test doubles mirror production contracts; dynamic cleanup is isolated state.
        "require-await": "off",
        "typescript/no-dynamic-delete": "off",
      },
    },
  ],
});
