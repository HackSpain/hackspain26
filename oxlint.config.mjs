import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

export default defineConfig({
  extends: [core],
  ignorePatterns: core.ignorePatterns,
  rules: {
    // Preserve the project's established style where Ultracite is opinionated
    // but does not identify a correctness, safety, or accessibility problem.
    complexity: "off",
    // Exhaustive discriminated-union switches should fail type-checking when extended.
    "default-case": "off",
    "func-style": "off",
    // Valid ARIA roles are required for SVG and composite widgets without native equivalents.
    "jsx-a11y/prefer-tag-over-role": "off",
    "max-classes-per-file": "off",
    "no-inline-comments": "off",
    "no-negated-condition": "off",
    "no-plusplus": "off",
    "no-use-before-define": "off",
    "no-void": "off",
    "oxc/no-barrel-file": "off",
    "promise/avoid-new": "off",
    "promise/prefer-await-to-callbacks": "off",
    "promise/prefer-await-to-then": "off",
    // React Compiler safely opts these components out of memoization.
    "react/incompatible-library": "off",
    "prefer-destructuring": "off",
    "sort-keys": "off",
    "sort-vars": "off",
    "typescript/consistent-type-definitions": "off",
    "unicorn/consistent-function-scoping": "off",
    "unicorn/filename-case": "off",
    "unicorn/no-await-expression-member": "off",
    // Node's canonical filesystem encoding spelling is `utf8`.
    "unicorn/text-encoding-identifier-case": "off",
    "unicorn/prefer-ternary": "off",
  },
});
