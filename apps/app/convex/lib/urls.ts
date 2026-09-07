import { v } from "convex/values";

export const urlKindValidator = v.union(
  v.literal("x"),
  v.literal("linkedin"),
  v.literal("github"),
  v.literal("web"),
  v.literal("repo"),
  v.literal("demo")
);

export const urlEntryValidator = v.object({
  kind: urlKindValidator,
  url: v.string(),
});

export const urlsValidator = v.array(urlEntryValidator);

export type UrlKind = "x" | "linkedin" | "github" | "web" | "repo" | "demo";

export type UrlEntry = { kind: UrlKind; url: string };

export function urlOf(
  urls: UrlEntry[] | undefined,
  kind: UrlKind
): string | undefined {
  return urls?.find((entry) => entry.kind === kind)?.url;
}

export function buildUrls(
  entries: { kind: UrlKind; url?: string | null }[]
): UrlEntry[] {
  const seen = new Set<UrlKind>();
  const out: UrlEntry[] = [];
  for (const entry of entries) {
    const url = entry.url?.trim();
    if (!url || seen.has(entry.kind)) {
      continue;
    }
    seen.add(entry.kind);
    out.push({ kind: entry.kind, url });
  }
  return out;
}

export function urlsFromRecord(row: {
  urls?: UrlEntry[];
  githubUrl?: string;
  xUrl?: string;
  linkedinUrl?: string;
  webUrl?: string;
}): UrlEntry[] {
  if (row.urls && row.urls.length > 0) {
    return row.urls;
  }
  return buildUrls([
    { kind: "x", url: row.xUrl },
    { kind: "linkedin", url: row.linkedinUrl },
    { kind: "github", url: row.githubUrl },
    { kind: "web", url: row.webUrl },
  ]);
}
