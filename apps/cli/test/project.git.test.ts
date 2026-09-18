import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { currentGitBranch, projectRef } from "../src/watcher/project";

const root = mkdtempSync(join(tmpdir(), "hs-git-"));
afterAll(() => rmSync(root, { force: true, recursive: true }));

function repo(name: string, head: string): string {
  const dir = join(root, name);
  mkdirSync(join(dir, ".git"), { recursive: true });
  writeFileSync(join(dir, ".git", "HEAD"), head);
  return dir;
}

describe("git branch for every harness", () => {
  test("read from .git/HEAD, also from a subdirectory", () => {
    const dir = repo("app", "ref: refs/heads/feat/board\n");
    mkdirSync(join(dir, "src", "deep"), { recursive: true });
    expect(currentGitBranch(dir)).toBe("feat/board");
    expect(currentGitBranch(join(dir, "src", "deep"))).toBe("feat/board");
  });

  test("a worktree's .git file points at the real git dir", () => {
    const main = repo("main", "ref: refs/heads/main\n");
    const gitDir = join(main, ".git", "worktrees", "wt");
    mkdirSync(gitDir, { recursive: true });
    writeFileSync(join(gitDir, "HEAD"), "ref: refs/heads/spike\n");
    const worktree = join(root, "wt");
    mkdirSync(worktree);
    writeFileSync(join(worktree, ".git"), `gitdir: ${gitDir}\n`);
    expect(currentGitBranch(worktree)).toBe("spike");
  });

  test("detached HEAD or no repository: no branch, never a throw", () => {
    expect(
      currentGitBranch(
        repo("detached", "4b825dc642cb6eb9a060e54bf8d69288fbee4904\n")
      )
    ).toBeUndefined();
    expect(
      currentGitBranch(join(root, "nowhere", "at", "all"))
    ).toBeUndefined();
  });

  test("projectRef: the harness's own branch wins, the repository fills the gap", () => {
    const dir = repo("filled", "ref: refs/heads/main\n");
    expect(projectRef(dir)?.gitBranch).toBe("main");
    expect(projectRef(dir, "from-harness")?.gitBranch).toBe("from-harness");
  });
});
