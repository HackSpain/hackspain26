/**
 * One width rule for the whole shell. Header, admin sidebar and page
 * content all use it, so the nav lines up with the cards on every page.
 */
export function contentWidth(pathname: string): string {
  if (pathname === "/admin/tv") {
    return "mx-auto w-full max-w-[1800px] px-3";
  }
  if (pathname.startsWith("/admin")) {
    return "mx-auto w-full max-w-[90rem] px-3";
  }
  return "mx-auto w-full max-w-6xl px-4";
}

/**
 * Pages whose main content runs edge to edge. The shell keeps its own rows
 * (the back link, banners) inside `contentWidth`; the page wraps whatever else
 * it wants contained.
 */
export function fullBleed(pathname: string): boolean {
  return pathname === "/people" || pathname === "/participantes";
}
