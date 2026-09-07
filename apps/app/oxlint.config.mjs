import { defineConfig } from "oxlint";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

import base from "../../oxlint.config.mjs";

export default defineConfig({
  extends: [base, react, next],
  ignorePatterns: base.ignorePatterns,
  overrides: [
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
