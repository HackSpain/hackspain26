import { chmodSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Command } from "commander";
import { contextFor } from "../lib/context";
import { CliError, EXIT } from "../lib/errors";
import { uiFor } from "../lib/output";
import { VERSION } from "../version";

export const REPO = "HackSpain/hackspain26";

const TAG_PREFIX = /^cli-v/;
const V_PREFIX = /^v/;
const WHITESPACE = /\s+/;
const CPUS: Record<string, string> = { x64: "x64", arm64: "arm64" };

export function assetName(
  platform = process.platform,
  arch = process.arch
): string {
  const os = platform === "win32" ? "windows" : platform;
  const cpu = CPUS[arch];
  if (!(["linux", "darwin", "windows"].includes(os) && cpu)) {
    throw new CliError(`No prebuilt binary for ${platform}/${arch}.`, {
      hint: "Build from source: bun run --filter cli build:bin:host",
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

async function latestRelease(fetchImpl: typeof fetch): Promise<Release> {
  const response = await fetchImpl(
    `https://api.github.com/repos/${REPO}/releases/latest`,
    {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": `hackspain-cli/${VERSION}`,
      },
    }
  );
  if (!response.ok) {
    throw new CliError(
      `GitHub answered ${response.status} while checking for updates.`,
      {
        exitCode: EXIT.NETWORK,
      }
    );
  }
  return (await response.json()) as Release;
}

function sha256(bytes: Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
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
      const release = await latestRelease(fetch);
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

      const asset = assetName();
      const base = `https://github.com/${REPO}/releases/download/${release.tag_name}`;
      const [binary, sums] = await ui.spin(
        `Downloading ${asset} ${latest}…`,
        () =>
          Promise.all([fetch(`${base}/${asset}`), fetch(`${base}/SHA256SUMS`)]),
        "Downloaded"
      );
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
      }
      renameSync(staging, target);
      ui.result({ current: VERSION, installed: latest, path: target });
      ui.celebrate(
        `Updated ${VERSION} → ${latest}. You are on the newest build.`
      );
    });
}
