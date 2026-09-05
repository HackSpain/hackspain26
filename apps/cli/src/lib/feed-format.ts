import { extname } from "node:path";
import { usageError } from "./errors";
import { formatAgo } from "./output";
import { c, highlight } from "./style";

/** The subset of a feed post the CLI renders; the watcher stores this shape too. */
export type FeedItem = {
  _id: string;
  kind: "post" | "github";
  text: string;
  createdAt: number;
  author?: { name?: string; email?: string };
  teamName?: string;
  imageUrl?: string;
  github?: { repo: string; event: string; url: string; actor?: string };
};

const IMAGE_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function imageContentType(path: string): string {
  const type = IMAGE_TYPES[extname(path).toLowerCase()];
  if (!type) {
    throw usageError(
      `Unsupported image "${path}".`,
      "Use a .jpg, .png, .webp or .gif file."
    );
  }
  return type;
}

/** One post as terminal lines: who, what, and any links. */
export function postLines(post: FeedItem, now = Date.now()): string[] {
  const when = c.dim(formatAgo(post.createdAt, now));
  const lines: string[] = [];
  if (post.kind === "github") {
    const repo = post.github?.repo ?? "";
    lines.push(
      `${c.teal("⑂")} ${highlight(post.teamName ?? repo)} ${c.dim(`·${post.teamName ? ` ${repo} ·` : ""}`)} ${when}`
    );
    lines.push(`   ${post.text}`);
    if (post.github?.url) {
      lines.push(`   ${c.dim(post.github.url)}`);
    }
    return lines;
  }
  const who = post.author?.name ?? post.author?.email ?? "someone";
  lines.push(
    `${highlight(who)}${post.teamName ? c.dim(` · ${post.teamName}`) : ""} ${c.dim("·")} ${when}`
  );
  if (post.text) {
    lines.push(...post.text.split("\n").map((l) => `   ${l}`));
  }
  if (post.imageUrl) {
    lines.push(`   ${c.dim("image:")} ${c.dim(post.imageUrl)}`);
  }
  return lines;
}
