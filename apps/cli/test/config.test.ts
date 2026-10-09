import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configDir, readConfig, resolveAppUrl } from "../src/lib/config";

let root: string;
const previousConfig = process.env.XDG_CONFIG_HOME;
const previousUrl = process.env.HACKSPAIN_APP_URL;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "hackspain-config-"));
  process.env.XDG_CONFIG_HOME = root;
  delete process.env.HACKSPAIN_APP_URL;
  mkdirSync(configDir(), { recursive: true });
});
afterEach(() => {
  if (previousConfig === undefined) {
    delete process.env.XDG_CONFIG_HOME;
  } else {
    process.env.XDG_CONFIG_HOME = previousConfig;
  }
  if (previousUrl === undefined) {
    delete process.env.HACKSPAIN_APP_URL;
  } else {
    process.env.HACKSPAIN_APP_URL = previousUrl;
  }
  rmSync(root, { recursive: true, force: true });
});
function write(contents: string) {
  writeFileSync(join(configDir(), "config.json"), contents);
}
test("missing config uses the default, valid config retains URL resolution", () => {
  expect(readConfig()).toEqual({});
  write(
    JSON.stringify({
      appUrl: " https://example.com/ ",
      telemetry: { url: "https://example.com/telemetry" },
    })
  );
  expect(resolveAppUrl()).toEqual({
    source: "config",
    url: "https://example.com",
  });
  expect(readConfig().telemetry?.url).toBe("https://example.com/telemetry");
});
test.each([
  "{",
  "null",
  "[]",
  '{"appUrl":42}',
  '{"telemetry":null}',
  '{"telemetry":{"url":42}}',
])("invalid configuration %s reports a usage error", (contents) => {
  write(contents);
  expect(readConfig).toThrow(/CLI configuration/);
  try {
    readConfig();
  } catch (error) {
    expect(error).toMatchObject({ code: "USAGE", exitCode: 2 });
  }
});
test("unreadable config is not treated as absent", () => {
  mkdirSync(join(configDir(), "config.json"));
  expect(readConfig).toThrow("Cannot read CLI configuration");
});
test("flag and environment override malformed config", () => {
  write('{"appUrl":42}');
  process.env.HACKSPAIN_APP_URL = "https://environment.com/";
  expect(resolveAppUrl("https://flag.com/")).toEqual({
    source: "flag",
    url: "https://flag.com",
  });
  expect(resolveAppUrl()).toEqual({
    source: "env",
    url: "https://environment.com",
  });
});
