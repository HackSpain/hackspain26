import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const TRAILING_SEPARATORS = /[\\/]+$/;

const HEAD_REF = /^ref: refs\/heads\/(.+)$/;
const GITDIR_FILE = /^gitdir: (.+)$/;
const BRANCH_TTL_MS = 30_000;
const branchCache = new Map<string, { at: number; branch?: string }>();

function readHead(gitPath: string): string | undefined {
  // A worktree or submodule has a `.git` file pointing at the real git dir.
  const gitDir = statSync(gitPath).isDirectory()
    ? gitPath
    : GITDIR_FILE.exec(readFileSync(gitPath, "utf8").trim())?.[1];
  if (!gitDir) {
    return;
  }
  const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
  return HEAD_REF.exec(head)?.[1];
}

/**
 * The checked-out branch of the repository `cwd` is in, read from
 * `.git/HEAD` (no git binary). Only Claude Code, Codex and Qwen Code log a
 * branch, so this fills it for the rest and every harness reports one. It
 * is the branch when the watcher reads the log, which for a catch-up can
 * differ from the one at the time; a harness's own value always wins.
 */
export function currentGitBranch(
  cwd: string,
  now = Date.now()
): string | undefined {
  const cached = branchCache.get(cwd);
  if (cached && now - cached.at < BRANCH_TTL_MS) {
    return cached.branch;
  }
  let branch: string | undefined;
  let dir = cwd;
  for (;;) {
    try {
      branch = readHead(join(dir, ".git"));
      break;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  }
  branchCache.set(cwd, { at: now, branch });
  return branch;
}

/**
 * Privacy rule for every collector: a working directory leaves the machine
 * only as a stable hash plus its last path segment.
 */
export function projectRef(
  cwd: string | undefined,
  gitBranch?: string
): { dirHash: string; name: string; gitBranch?: string } | undefined {
  if (!cwd) {
    return;
  }
  const normalized = cwd.replace(TRAILING_SEPARATORS, "");
  const dirHash = createHash("sha256")
    .update(normalized)
    .digest("hex")
    .slice(0, 16);
  const name = basename(normalized) || "root";
  const branch = gitBranch ?? currentGitBranch(normalized);
  return branch ? { dirHash, gitBranch: branch, name } : { dirHash, name };
}
