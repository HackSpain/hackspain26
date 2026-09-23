import { chmodSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Command } from "commander";
import { readJsonFile, stateDir, writeFileAtomic } from "../lib/config";
import { contextFor } from "../lib/context";
import { CliError, EXIT } from "../lib/errors";
import type { Ui } from "../lib/output";
import { uiFor } from "../lib/output";
import { VERSION } from "../version";

export const REPO = "HackSpain/hackspain26";

const TAG_PREFIX = /^cli-v/;
const RELEASE_TAG = /^cli-v\d+\.\d+\.\d+$/;
const V_PREFIX = /^v/;
const WHITESPACE = /\s+/;
const CPUS: Record<string, string> = { arm64: "arm64", x64: "x64" };
const AUTO_UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const UPDATE_CHECK_TIMEOUT_MS = 3000;
const MANUAL_UPDATE_CHECK_TIMEOUT_MS = 15_000;
const UPDATE_DOWNLOAD_TIMEOUT_MS = 2 * 60 * 1000;

type UpdateState = { checkedAt: number };

export function tagFromReleaseAssetUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/");
    const tag = parts[parts.lastIndexOf("download") + 1];
    return url.hostname === "github.com" && tag && RELEASE_TAG.test(tag)
      ? tag
      : undefined;
  } catch {
    // Invalid redirect URL.
  }
}

export function assetName(
  platform = process.platform,
  arch = process.arch
): string {
  const os = platform === "win32" ? "windows" : platform;
  const cpu = CPUS[arch];
  if (!(["linux", "darwin", "windows"].includes(os) && cpu)) {
    throw new CliError(`No prebuilt binary for ${platform}/${arch}.`, {
      hint: "Build from source: pnpm --filter cli build:bin:host",
    });
  }
  return `hackspain-${os}-${cpu}${os === "windows" ? ".exe" : ""}`;
}

/** Semver-ish compare on dotted numbers; anything non-numeric sorts as 0. */
export function isNewer(candidate: string, current: string): boolean {
  const parse = (v: string) =>
    v
      .replace(TAG_PREFIX, "")
      .replace(V_PREFIX, "")
      .split(".")
      .map((p) => Number.parseInt(p, 10) || 0);
  const a = parse(candidate);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) {
      return diff > 0;
    }
  }
  return false;
}

type Release = { tag_name: string; html_url: string };

async function latestRelease(
  fetchImpl: typeof fetch,
  signal?: AbortSignal
): Promise<Release> {
  const response = await fetchImpl(
    `https://github.com/${REPO}/releases/latest/download/SHA256SUMS`,
    {
      headers: {
        "user-agent": `hackspain-cli/${VERSION}`,
      },
      redirect: "manual",
      signal,
    }
  );
  const location = response.headers.get("location");
  if (!(response.status >= 300 && response.status < 400 && location)) {
    throw new CliError(
      `GitHub answered ${response.status} while checking for updates.`,
      {
        exitCode: EXIT.NETWORK,
      }
    );
  }
  const tag = tagFromReleaseAssetUrl(new URL(location, response.url).href);
  if (!tag) {
    throw new CliError("GitHub returned an invalid latest release URL.");
  }
  return {
    html_url: `https://github.com/${REPO}/releases/tag/${tag}`,
    tag_name: tag,
  };
}

function sha256(bytes: Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

function updateStatePath(): string {
  return join(stateDir(), "update.json");
}

function lastCheckedAt(): number | undefined {
  const value = readJsonFile<Partial<UpdateState>>(
    updateStatePath()
  )?.checkedAt;
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function markChecked(now: number): void {
  try {
    writeFileAtomic(
      updateStatePath(),
      `${JSON.stringify({ checkedAt: now })}\n`
    );
  } catch {
    // Cache failures must never block the command or a manual update.
  }
}

export function shouldAutoUpdate(options: {
  args: string[];
  current?: string;
  interactive: boolean;
  lastCheckedAt?: number;
  now: number;
  optedOut?: boolean;
}): boolean {
  const current = options.current ?? VERSION;
  return (
    current !== "0.0.0-dev" &&
    options.interactive &&
    !options.optedOut &&
    !options.args.some((arg) =>
      ["--help", "-h", "--json", "--version", "-v", "update"].includes(arg)
    ) &&
    (options.lastCheckedAt === undefined ||
      options.now < options.lastCheckedAt ||
      options.now - options.lastCheckedAt >= AUTO_UPDATE_INTERVAL_MS)
  );
}

async function installRelease(
  release: Release,
  fetchImpl: typeof fetch,
  ui?: Ui
): Promise<string> {
  const latest = release.tag_name.replace(TAG_PREFIX, "");
  const asset = assetName();
  const base = `https://github.com/${REPO}/releases/download/${release.tag_name}`;
  const signal = AbortSignal.timeout(UPDATE_DOWNLOAD_TIMEOUT_MS);
  const download = () =>
    Promise.all([
      fetchImpl(`${base}/${asset}`, { signal }),
      fetchImpl(`${base}/SHA256SUMS`, { signal }),
    ]);
  const [binary, sums] = ui
    ? await ui.spin(`Downloading ${asset} ${latest}…`, download, "Downloaded")
    : await download();
  if (!(binary.ok && sums.ok)) {
    throw new CliError("Could not download the release assets.", {
      exitCode: EXIT.NETWORK,
    });
  }
  const bytes = new Uint8Array(await binary.arrayBuffer());
  const expected = (await sums.text())
    .split("\n")
    .find((line) => line.trim().endsWith(` ${asset}`))
    ?.split(WHITESPACE)[0];
  if (!expected) {
    throw new CliError(`${asset} is not listed in SHA256SUMS.`);
  }
  const actual = sha256(bytes);
  if (actual !== expected) {
    throw new CliError("Checksum mismatch; the download was discarded.");
  }

  const target = process.execPath;
  const staging = join(dirname(target), `.${asset}.${process.pid}.tmp`);
  try {
    await Bun.write(staging, bytes);
    chmodSync(staging, 0o755);
    if (process.platform === "win32") {
      // A running .exe cannot be overwritten, but it can be renamed away.
      const old = `${target}.old`;
      try {
        unlinkSync(old);
      } catch {
        // No previous leftover.
      }
      renameSync(target, old);
      try {
        renameSync(staging, target);
      } catch (error) {
        renameSync(old, target);
        throw error;
      }
    } else {
      renameSync(staging, target);
    }
  } catch (error) {
    try {
      unlinkSync(staging);
    } catch {
      // It was already renamed into place.
    }
    throw error;
  }
  return latest;
}

/** Update release binaries in interactive sessions; never block work on failure. */
export async function autoUpdate(
  args: string[],
  options: { silent?: boolean } = {}
): Promise<string | undefined> {
  const now = Date.now();
  if (
    !shouldAutoUpdate({
      args,
      current: VERSION,
      interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
      lastCheckedAt: lastCheckedAt(),
      now,
      optedOut: process.env.HACKSPAIN_NO_AUTO_UPDATE === "1",
    })
  ) {
    return;
  }
  // Mark before the network call so an outage does not slow every command.
  markChecked(now);
  const ui = options.silent
    ? undefined
    : uiFor({ interactive: true, json: false });
  try {
    const release = await latestRelease(
      fetch,
      AbortSignal.timeout(UPDATE_CHECK_TIMEOUT_MS)
    );
    const latest = release.tag_name.replace(TAG_PREFIX, "");
    if (!isNewer(latest, VERSION)) {
      return;
    }
    ui?.info(`Updating ${VERSION} → ${latest} before continuing…`);
    await installRelease(release, fetch, ui);
    ui?.success(`Updated to ${latest}. Restarting this command…`);
    return latest;
  } catch {
    ui?.warn(
      "Automatic update failed; continuing. Run hackspain update to retry."
    );
  }
}

export async function restartCurrentCommand(): Promise<number> {
  const child = Bun.spawn([process.execPath, ...process.argv.slice(2)], {
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  });
  return await child.exited;
}

export function registerUpdate(program: Command): void {
  program
    .command("update")
    .description("Download the latest release and replace this binary")
    .option("--check", "only report whether a newer version exists")
    .action(async (opts: { check?: boolean }, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      if (VERSION === "0.0.0-dev") {
        throw new CliError("This is a source checkout, not a release binary.", {
          hint: "Pull the repo instead of updating.",
        });
      }
      const release = await latestRelease(
        fetch,
        AbortSignal.timeout(MANUAL_UPDATE_CHECK_TIMEOUT_MS)
      );
      const latest = release.tag_name.replace(TAG_PREFIX, "");
      const newer = isNewer(latest, VERSION);
      if (!newer || opts.check) {
        ui.result({
          current: VERSION,
          latest,
          updateAvailable: newer,
          url: release.html_url,
        });
        ui.info(
          newer
            ? `Update available: ${VERSION} → ${latest}.`
            : `Already on the latest version (${VERSION}).`
        );
        return;
      }

      const installed = await installRelease(release, fetch, ui);
      markChecked(Date.now());
      ui.result({
        current: VERSION,
        installed: latest,
        path: process.execPath,
      });
      ui.celebrate(
        `Updated ${VERSION} → ${installed}. You are on the newest build.`
      );
    });
}
