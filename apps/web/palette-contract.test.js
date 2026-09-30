import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const THEME_BLOCK = /@theme(?: inline)? \{([^}]*)\}/s;
const PALETTE_BLOCK = /export const HS_PALETTE = \{([^}]*)\} as const;/s;
const ROOT_BLOCK = /:root \{([^}]*)\}/s;
const HEX = /^#[0-9a-f]{6}$/i;

function read(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function entries(source, pattern) {
  const pairs = [...source.matchAll(pattern)].map((match) => [
    match[1].toLowerCase(),
    match[2].toLowerCase(),
  ]);
  assert.ok(pairs.length > 0, "No palette entries found");
  assert.equal(new Set(pairs.map(([name]) => name)).size, pairs.length);
  for (const [name, value] of pairs) {
    assert.match(value, HEX, `${name} must use six-digit hex`);
  }
  return Object.fromEntries(pairs);
}

function themeColors(path) {
  const theme = read(path).match(THEME_BLOCK)?.[1];
  assert.ok(theme, `Missing @theme block in ${path}`);
  return entries(theme, /--color-hs-([a-z-]+):\s*([^;]+);/gi);
}

test("brand tokens match the public design guide across both apps", () => {
  const guide = read("./src/data/design.md")
    .split("## Colour\n")[1]
    ?.split("\n## ")[0];
  assert.ok(guide, "Missing Colour section in design.md");
  const expected = entries(guide, /^\| ([A-Za-z]+) \| `([^`]+)` \|/gim);

  const paletteSource = read("./src/components/theme/palette.ts").match(
    PALETTE_BLOCK
  )?.[1];
  assert.ok(paletteSource, "Missing HS_PALETTE object");
  const palette = entries(paletteSource, /\b([a-z]+):\s*"([^"]+)"/gi);
  const web = themeColors("./src/styles/global.css");
  const app = themeColors("../app/src/app/globals.css");

  assert.deepEqual(palette, { ...expected, cream: expected.paper });
  assert.deepEqual(web, { ...expected, cream: expected.paper });
  assert.deepEqual(app, expected);

  const appRoot = read("../app/src/app/globals.css").match(ROOT_BLOCK)?.[1];
  assert.ok(appRoot, "Missing dashboard :root block");
  const semanticColors = entries(
    appRoot.split("--radius:")[0],
    /--([a-z-]+):\s*([^;]+);/gi
  );
  assert.deepEqual(semanticColors, {
    background: expected.paper,
    foreground: expected.ink,
    card: expected.paper,
    "card-foreground": expected.ink,
    popover: expected.paper,
    "popover-foreground": expected.ink,
    primary: expected.gold,
    "primary-foreground": expected.ink,
    secondary: expected.teal,
    "secondary-foreground": expected.paper,
    muted: expected.sand,
    "muted-foreground": expected.brown,
    accent: expected.slate,
    "accent-foreground": expected.navy,
    destructive: expected.red,
    border: expected.ink,
    input: expected.ink,
    ring: expected.navy,
  });
});
