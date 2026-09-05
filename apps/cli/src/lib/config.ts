import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_APP_URL } from "../version";
import { usageError } from "./errors";

const APP_DIR = "hackspain";
const HTTP_URL_PATTERN = /^https?:\/\//;
const TRAILING_SLASHES = /\/+$/;

function xdg(envKey: string, fallback: string): string {
  const value = process.env[envKey];
  return value?.trim() ? value : fallback;
}

/** Where credentials and config live. */
export function configDir(): string {
  if (process.platform === "win32") {
    return join(xdg("APPDATA", join(homedir(), "AppData", "Roaming")), APP_DIR);
  }
  return join(xdg("XDG_CONFIG_HOME", join(homedir(), ".config")), APP_DIR);
}

/** Where cursors, spool files and locks live. */
export function stateDir(): string {
  if (process.platform === "win32") {
    return join(
      xdg("LOCALAPPDATA", join(homedir(), "AppData", "Local")),
      APP_DIR
    );
  }
  return join(
    xdg("XDG_STATE_HOME", join(homedir(), ".local", "state")),
    APP_DIR
  );
}

export function ensureDir(path: string, mode = 0o700): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true, mode });
  }
}

/** Write via a sibling temp file + rename so readers never see a torn file. */
export function writeFileAtomic(
  path: string,
  content: string,
  mode = 0o600
): void {
  ensureDir(dirname(path));
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, content, { mode });
  try {
    chmodSync(tmp, mode);
  } catch {
    // Windows ignores POSIX modes; nothing to do.
  }
  renameSync(tmp, path);
}

export function readJsonFile<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

export type CliConfig = {
  appUrl?: string;
  telemetry?: { url?: string };
};

export function configPath(): string {
  return join(configDir(), "config.json");
}

export function readConfig(): CliConfig {
  return readJsonFile<CliConfig>(configPath()) ?? {};
}

export function writeConfig(config: CliConfig): void {
  writeFileAtomic(configPath(), `${JSON.stringify(config, null, 2)}\n`, 0o600);
}

export type UrlSource = "flag" | "env" | "config" | "default";

export function resolveAppUrl(override?: string): {
  url: string;
  source: UrlSource;
} {
  const candidates: [string | undefined, UrlSource][] = [
    [override, "flag"],
    [process.env.HACKSPAIN_APP_URL, "env"],
    [readConfig().appUrl, "config"],
    [DEFAULT_APP_URL, "default"],
  ];
  for (const [value, source] of candidates) {
    const url = value?.trim();
    if (!url) {
      continue;
    }
    if (!HTTP_URL_PATTERN.test(url)) {
      throw usageError(
        `Invalid server URL "${url}" (from ${source}).`,
        "It should look like https://app.hackspain.com or http://localhost:3000"
      );
    }
    return { url: url.replace(TRAILING_SLASHES, ""), source };
  }
  throw usageError(
    "No HackSpain server configured.",
    "Pass --url <https://app.hackspain.com> or set HACKSPAIN_APP_URL."
  );
}
