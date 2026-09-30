import { isGithubHandle } from "./github-handle";

const GITHUB_AVATAR_SIZE = 460;
const UPSTREAM_TIMEOUT_MS = 4000;

export type GithubAvatarResult =
  | { status: "invalid_handle" }
  | { status: "not_found" }
  | { status: "ok"; contentType: string; response: Response }
  | { status: "unavailable" };

/**
 * Fetches github.com/<handle>.png server-side. Both the badge proxy and the
 * social image need it, and neither can let the browser do it: that URL answers
 * with a redirect carrying no CORS headers.
 */
export async function fetchGithubAvatar(
  handle: string
): Promise<GithubAvatarResult> {
  if (!(handle && isGithubHandle(handle))) {
    return { status: "invalid_handle" };
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `https://github.com/${handle}.png?size=${GITHUB_AVATAR_SIZE}`,
      {
        headers: { accept: "image/*" },
        redirect: "follow",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      }
    );
  } catch {
    return { status: "unavailable" };
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!(upstream.ok && contentType.startsWith("image/"))) {
    return { status: "not_found" };
  }

  return { contentType, response: upstream, status: "ok" };
}
