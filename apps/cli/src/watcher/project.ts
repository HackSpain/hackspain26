import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

const TRAILING_SEPARATORS = /[\\/]+$/;

const HEAD_REF = /^ref: refs\/heads\/(.+)$/;
const GITDIR_FILE = /^gitdir: (.+)$/;
const CONFIG_LINES = /\r?\n/;
const CONFIG_SECTION = /^\s*\[([^\]]+)]\s*$/;
const ORIGIN_SECTION = /^remote\s+"origin"$/i;
const CONFIG_URL = /^\s*url\s*=\s*(.+?)\s*$/i;
const GITHUB_SCP_REMOTE =
  /^(?:[^@/]+@)?github\.com:([^/]+)\/([^/]+?)(?:\.git)?\/?$/i;
const GIT_SUFFIX = /\.git$/i;
const REPO_COMPONENT = /^[A-Za-z0-9_.-]+$/;
const BRANCH_TTL_MS = 30_000;
const branchCache = new Map<string, { at: number; branch?: string }>();
const repoCache = new Map<string, { at: number; repo?: string }>();

function gitDirAt(gitPath: string): string | undefined {
  // A worktree or submodule has a `.git` file pointing at the real git dir.
  if (statSync(gitPath).isDirectory()) {
    return gitPath;
  }
  const target = GITDIR_FILE.exec(readFileSync(gitPath, "utf8").trim())?.[1];
  if (!target) {
    return;
  }
  return isAbsolute(target) ? target : resolve(dirname(gitPath), target);
}

function findGitDir(cwd: string): string | undefined {
  let dir = cwd;
  for (;;) {
    try {
      return gitDirAt(join(dir, ".git"));
    } catch {
      const parent = dirname(dir);
      if (parent === dir) {
        return;
      }
      dir = parent;
    }
  }
}

function readHead(gitDir: string): string | undefined {
  const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
  return HEAD_REF.exec(head)?.[1];
}

function commonGitDir(gitDir: string): string {
  try {
    const target = readFileSync(join(gitDir, "commondir"), "utf8").trim();
    return isAbsolute(target) ? target : resolve(gitDir, target);
  } catch {
    return gitDir;
  }
}

function originUrl(config: string): string | undefined {
  let inOrigin = false;
  for (const line of config.split(CONFIG_LINES)) {
    const section = CONFIG_SECTION.exec(line)?.[1];
    if (section !== undefined) {
      inOrigin = ORIGIN_SECTION.test(section);
      continue;
    }
    if (inOrigin) {
      const url = CONFIG_URL.exec(line)?.[1];
      if (url) {
        return url;
      }
    }
  }
}

/** A GitHub remote becomes only `owner/repo`; credentials and paths never leave. */
export function githubRepoSlug(remote: string): string | undefined {
  const scp = GITHUB_SCP_REMOTE.exec(remote.trim());
  if (scp) {
    return `${scp[1]}/${scp[2]}`;
  }
  try {
    const url = new URL(remote.trim());
    if (url.hostname.toLowerCase() !== "github.com") {
      return;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 2) {
      return;
    }
    const owner = parts[0];
    const name = parts[1]?.replace(GIT_SUFFIX, "");
    if (!(owner && name)) {
      return;
    }
    return REPO_COMPONENT.test(owner) && REPO_COMPONENT.test(name)
      ? `${owner}/${name}`
      : undefined;
  } catch {
    // Invalid or non-URL remotes are intentionally ignored.
  }
}

/**
 * The checked-out branch of the repository `cwd` is in, read from
 * `.git/HEAD` (no git binary). Claude Code, Codex, Copilot CLI and Qwen Code
 * log a branch, so this fills it for the rest and every harness reports one. It
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
  try {
    const gitDir = findGitDir(cwd);
    branch = gitDir ? readHead(gitDir) : undefined;
  } catch {
    branch = undefined;
  }
  branchCache.set(cwd, { at: now, branch });
  return branch;
}

export function currentGitRepo(
  cwd: string,
  now = Date.now()
): string | undefined {
  const cached = repoCache.get(cwd);
  if (cached && now - cached.at < BRANCH_TTL_MS) {
    return cached.repo;
  }
  let repo: string | undefined;
  try {
    const gitDir = findGitDir(cwd);
    const config = gitDir
      ? readFileSync(join(commonGitDir(gitDir), "config"), "utf8")
      : "";
    const remote = originUrl(config);
    repo = remote ? githubRepoSlug(remote) : undefined;
  } catch {
    repo = undefined;
  }
  repoCache.set(cwd, { at: now, repo });
  return repo;
}

/**
 * Privacy rule for every collector: a working directory leaves the machine
 * only as a stable hash plus its last path segment.
 */
export function projectRef(
  cwd: string | undefined,
  gitBranch?: string
):
  | { dirHash: string; name: string; gitBranch?: string; repo?: string }
  | undefined {
  if (!cwd) {
    return;
  }
  const normalized = cwd.replace(TRAILING_SEPARATORS, "");
  const dirHash = createHash("sha256")
    .update(normalized)
    .digest("hex")
    .slice(0, 16);
  const name = basename(normalized.replaceAll("\\", "/")) || "root";
  const branch = gitBranch ?? currentGitBranch(normalized);
  const repo = currentGitRepo(normalized);
  return {
    dirHash,
    ...(branch ? { gitBranch: branch } : {}),
    name,
    ...(repo ? { repo } : {}),
  };
}
