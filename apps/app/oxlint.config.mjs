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
    // no-unknown-classes is a later adoption step, not enabled.
    "shadcn/require-static-classes": "error",
    "shadcn/no-raw-colors": [
      "error",
      {
        // Tool FP: fill-opacity-* is SVG fill opacity, not a theme color.
        // Remove when @shadcn/lint stops classifying it as undeclared color.
        allow: ["fill-opacity-*"],
      },
    ],
    "shadcn/no-restyle": [
      "error",
      {
        allow: [
          "layout",
          "hs-enter",
          "duration-press",
          "duration-enter",
          "duration-exit",
          "ease-out",
          "transition-press",
          "transition-surface",
        ],
        contracts: [
          {
            pattern: "^Card$",
            allow: [
              "layout",
              "spacing",
              "color",
              "shape",
              "effects",
              "motion",
              "hs-enter",
              "duration-enter",
              "ease-out",
            ],
          },
          { pattern: "^Badge$", allow: ["layout", "spacing"] },
          {
            pattern: "^CardTitle$",
            allow: ["layout", "typography", "spacing"],
          },
          {
            pattern: "^CardDescription$",
            allow: ["layout", "typography", "color", "spacing", "shape"],
          },
          {
            pattern: "^CardContent$",
            allow: ["layout", "spacing", "typography", "color"],
          },
          { pattern: "^CardHeader$", allow: ["layout", "spacing"] },
          { pattern: "^Frame$", allow: ["layout", "spacing", "color"] },
          {
            pattern: "^Table$",
            allow: ["layout", "typography", "shape", "spacing"],
          },
          { pattern: "^TableHeader$", allow: ["layout", "color", "shape"] },
          {
            pattern: "^TableRow$",
            allow: ["layout", "color", "motion", "shape"],
          },
          { pattern: "^TableCell$", allow: ["layout", "typography", "color"] },
          { pattern: "^TableHead$", allow: ["layout", "typography"] },
          { pattern: "^Label$", allow: ["layout", "typography", "color"] },
          { pattern: "^SheetBody$", allow: ["layout", "spacing"] },
          {
            pattern: "^SheetTitle$",
            allow: ["layout", "typography", "spacing"],
          },
          { pattern: "^SheetDescription$", allow: ["layout", "typography"] },
          {
            pattern: "^AlertDescription$",
            allow: ["layout", "typography", "color", "spacing"],
          },
          {
            pattern: "^DropdownMenuItem$",
            allow: ["layout", "typography", "color"],
          },
          { pattern: "^DropdownMenuLabel$", allow: ["layout", "typography"] },
        ],
      },
    ],
    "shadcn/no-arbitrary-values": ["error", { allow: ["layout"] }],
    "shadcn/no-inline-styles": "error",
  },
  overrides: [
    {
      files: ["src/components/ui/**"],
      rules: {
        // Primitives own appearance and may use structural values such as ring-[3px].
        "shadcn/require-static-classes": "off",
        "shadcn/no-restyle": "off",
        "shadcn/no-arbitrary-values": "off",
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
