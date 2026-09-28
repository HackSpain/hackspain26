import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const base = process.argv[2];

if (!base) {
  throw new Error("Pass the base commit SHA to check-changed-quality.mjs");
}

function gitFiles(args) {
  return execFileSync("git", [...args, "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
}

const changed = [
  ...new Set([
    ...gitFiles(["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`]),
    ...gitFiles(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]),
    ...gitFiles(["ls-files", "--others", "--exclude-standard"]),
  ]),
].toSorted();

let failed = false;

function check(workspace, command, paths) {
  if (paths.length === 0) {
    return;
  }
  console.log(`${workspace}: ${command} (${paths.length} changed files)`);
  const result = spawnSync(
    "pnpm",
    ["--filter", workspace, "exec", ...command, "--no-error-on-unmatched-pattern", ...paths],
    { cwd: root, stdio: "inherit" }
  );
  if (result.error) {
    throw result.error;
  }
  failed ||= result.status !== 0;
}

function format(workspace, command, paths) {
  if (paths.length === 0) {
    return;
  }
  console.log(`${workspace}: ${command} (${paths.length} changed files)`);
  const result = spawnSync(
    "pnpm",
    ["--filter", workspace, "exec", ...command, "--no-errors-on-unmatched", ...paths],
    { cwd: root, stdio: "inherit" }
  );
  if (result.error) {
    throw result.error;
  }
  failed ||= result.status !== 0;
}

for (const workspace of ["app", "web"]) {
  const prefix = `apps/${workspace}/`;
  const files = changed
    .filter((path) => path.startsWith(prefix))
    .map((path) => path.slice(prefix.length));
  check(
    workspace,
    ["oxlint", "-c", "oxlint.config.mjs", "--report-unused-disable-directives-severity=error"],
    files.filter((path) => /\.(?:[cm]?[jt]sx?|astro)$/.test(path))
  );
  format(
    workspace,
    ["biome", workspace === "app" ? "format" : "check"],
    files.filter((path) => /\.(?:[cm]?[jt]sx?|astro|jsonc?|css)$/.test(path))
  );
}

if (changed.includes("oxlint.config.mjs")) {
  const result = spawnSync(
    "pnpm",
    ["exec", "oxlint", "-c", "oxlint.config.mjs", "oxlint.config.mjs"],
    { cwd: root, stdio: "inherit" }
  );
  if (result.error) {
    throw result.error;
  }
  failed ||= result.status !== 0;
}

process.exitCode = failed ? 1 : 0;
