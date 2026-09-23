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

/** The approval card for `hackspain auth login`. */
export const CLI_AUTH_PATH = "/cli-auth";

/**
 * The only place a stored return-to may send a freshly signed-in user: the
 * approval card itself, bare or with a query and/or a fragment. New CLI links
 * carry `hs-code` in the fragment, older ones in the query; both stay intact.
 * Anything else (another path, `/cli-auth/handoff`, an absolute URL, a
 * tampered value) is dropped so the redirect never leaves this allowlist.
 */
export function safeCliAuthReturnTo(
  raw: string | null | undefined,
): string | null {
  if (!raw || !raw.startsWith(CLI_AUTH_PATH)) {
    return null;
  }
  const rest = raw.slice(CLI_AUTH_PATH.length);
  if (rest !== "" && !rest.startsWith("?") && !rest.startsWith("#")) {
    return null;
  }
  return raw;
}

/**
 * What the gate stores when a logged-out visitor lands on /cli-auth. The
 * fragment is included on purpose: it never reaches the server, and the
 * `/login` round trip would otherwise lose the code the CLI put there.
 */
export function cliAuthReturnTo(location: {
  pathname: string;
  search: string;
  hash: string;
}): string | null {
  return safeCliAuthReturnTo(
    location.pathname + location.search + location.hash,
  );
}
