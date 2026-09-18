/**
 * Destination after /cli-auth/handoff signs the browser in. The CLI passes
 * `next` as a dashboard path; anything that could leave this origin
 * (absolute URLs, protocol-relative `//host`, backslash tricks) falls back to
 * the home page.
 */
export function safeNextPath(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value.startsWith("/")) {
    return "/";
  }
  if (value.startsWith("//") || value.includes("\\")) {
    return "/";
  }
  if (/^\/[^/?#]*:/.test(value)) {
    return "/";
  }
  return value;
}
