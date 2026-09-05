import { createHash } from "node:crypto";
import { basename } from "node:path";

const TRAILING_SEPARATORS = /[\\/]+$/;

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
  return gitBranch ? { dirHash, name, gitBranch } : { dirHash, name };
}
