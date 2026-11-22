import { youtubeId } from "@convex/lib/submission";

export type VideoEmbed =
  | { kind: "youtube"; src: string }
  | { kind: "loom"; src: string }
  | { kind: "file"; src: string };

function pathSegments(pathname: string): string[] {
  return pathname.split("/").filter((part) => part.length > 0);
}

function loomId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "loom.com" && host !== "www.loom.com") {
    return null;
  }
  const [kind, id] = pathSegments(url.pathname);
  if ((kind === "share" || kind === "embed") && id) {
    return id;
  }
  return null;
}

function isDirectVideo(url: URL): boolean {
  return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url.pathname);
}

export function parseVideoUrl(raw: string | undefined): VideoEmbed | null {
  if (!raw) {
    return null;
  }
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const youtube = youtubeId(url);
    if (youtube) {
      return {
        kind: "youtube",
        src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtube)}`,
      };
    }
    const loom = loomId(url);
    if (loom) {
      return {
        kind: "loom",
        src: `https://www.loom.com/embed/${encodeURIComponent(loom)}`,
      };
    }
    if (isDirectVideo(url)) {
      return { kind: "file", src: url.href };
    }
    return null;
  } catch {
    return null;
  }
}
