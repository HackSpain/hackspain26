import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const THEME_BLOCK = /@theme(?: inline)? \{([^}]*)\}/s;
const PALETTE_BLOCK = /export const HS_PALETTE = \{([^}]*)\} as const;/s;

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
  return Object.fromEntries(pairs);
}

function themeColors(path) {
  const theme = read(path).match(THEME_BLOCK)?.[1];
  assert.ok(theme, `Missing @theme block in ${path}`);
  return entries(theme, /--color-hs-([a-z]+):\s*(#[0-9a-f]{6});/gi);
}

test("brand tokens match the public design guide across both apps", () => {
  const guide = read("./src/data/design.md")
    .split("## Colour\n")[1]
    ?.split("\n## ")[0];
  assert.ok(guide, "Missing Colour section in design.md");
  const expected = entries(
    guide,
    /^\| ([A-Za-z]+) \| `(#(?:[0-9a-f]{6}))` \|/gim
  );

  const paletteSource = read("./src/components/theme/palette.ts").match(
    PALETTE_BLOCK
  )?.[1];
  assert.ok(paletteSource, "Missing HS_PALETTE object");
  const palette = entries(paletteSource, /\b([a-z]+):\s*"(#[0-9a-f]{6})"/gi);
  const web = themeColors("./src/styles/global.css");
  const app = themeColors("../app/src/app/globals.css");

  assert.deepEqual(palette, { ...expected, cream: expected.paper });
  assert.deepEqual(web, { ...expected, cream: expected.paper });
  assert.deepEqual(app, expected);
});
