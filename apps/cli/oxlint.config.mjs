import { defineConfig } from "oxlint";

import base from "../../oxlint.config.mjs";

export default defineConfig({
  extends: [base],
  ignorePatterns: base.ignorePatterns,
  rules: {
    // ANSI terminal sequences are clearer as hexadecimal escapes.
    "no-control-regex": "off",
    // The watcher loop observes state mutated by signal handlers and external callers.
    "no-unmodified-loop-condition": "off",
    "unicorn/escape-case": "off",
    "unicorn/no-hex-escape": "off",
    // No-op callbacks implement optional terminal and persistence adapters.
    "unicorn/no-useless-undefined": "off",
  },
  overrides: [
    {
      files: ["test/**"],
      rules: {
        "no-bitwise": "off",
        "no-empty": "off",
        "require-await": "off",
      },
    },
  ],
});
