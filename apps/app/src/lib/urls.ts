import type { UrlKind } from "@convex/lib/urls";

export type { UrlEntry, UrlKind } from "@convex/lib/urls";
export { urlOf } from "@convex/lib/urls";

const LABELS: Record<UrlKind, string> = {
  demo: "Demo",
  github: "GitHub",
  linkedin: "LinkedIn",
  repo: "Repo",
  video: "Vídeo",
  web: "Web",
  x: "X",
};

export function urlLabel(kind: UrlKind): string {
  return LABELS[kind];
}

export function urlDisplay(kind: UrlKind, url: string): string {
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (kind === "github") {
      return parts[0] ?? parsed.hostname;
    }
    if (kind === "x") {
      return parts[0] ? `@${parts[0]}` : parsed.hostname;
    }
    if (kind === "linkedin") {
      const slug =
        parts[0] === "in" || parts[0] === "company" ? parts[1] : parts[0];
      return slug ?? parsed.hostname.replace(/^www\./, "");
    }
    const host = parsed.hostname.replace(/^www\./, "");
    return parts.length > 0 ? `${host}/${parts.join("/")}` : host;
  } catch {
    return url.replace(/^https?:\/\//i, "");
  }
}
