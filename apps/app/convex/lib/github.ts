export function repoSlug(repoUrl: string | undefined): string | null {
  if (!repoUrl) {
    return null;
  }
  const trimmed = repoUrl.trim();
  const github = /github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?\/?$/.exec(trimmed);
  if (github) {
    return `${github[1]}/${github[2]}`;
  }
  const short = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(
    trimmed
  );
  return short ? `${short[1]}/${short[2]}` : null;
}

export function canonicalRepoUrl(raw: string): string | null {
  const slug = repoSlug(raw);
  return slug ? `https://github.com/${slug}` : null;
}

/** Canonical event names stored in feed posts after mapping GitHub's API payload. */
export const GITHUB_FEED_EVENTS = {
  pullRequest: "pull_request",
  push: "push",
  release: "release",
  tag: "tag",
} as const;

export function githubAuthHeader(userToken?: string | null): Record<string, string> {
  if (userToken) {
    return { authorization: `Bearer ${userToken}` };
  }
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    return { authorization: `Bearer ${token}` };
  }
  const id = process.env.GITHUB_CLIENT_ID;
  const secret = process.env.GITHUB_CLIENT_SECRET;
  if (id && secret) {
    return { authorization: `Basic ${btoa(`${id}:${secret}`)}` };
  }
  return {};
}

export function githubHeaders(opts?: {
  etag?: string;
  token?: string | null;
  userAgent?: string;
}): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    "user-agent": opts?.userAgent ?? "hackspain",
    "x-github-api-version": "2022-11-28",
    ...(opts?.etag ? { "if-none-match": opts.etag } : {}),
    ...githubAuthHeader(opts?.token),
  };
}

export function hasGithubAuth(userToken?: string | null): boolean {
  return Boolean(githubAuthHeader(userToken).authorization);
}

export async function inspectPublicGithubRepo(
  url: string
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const slug = repoSlug(url);
  if (!slug) {
    return {
      ok: false,
      message: "Usa https://github.com/org/repo (sin /tree ni /blob).",
    };
  }
  const canonical = `https://github.com/${slug}`;
  const response = await fetch(`https://api.github.com/repos/${slug}`, {
    headers: githubHeaders({ userAgent: "hackspain-submit" }),
  });
  if (response.status === 404) {
    return {
      ok: false,
      message: "Ese repo no existe o es privado. Tiene que ser público.",
    };
  }
  if (response.status === 403 || response.status === 429) {
    console.warn(`github repo check: ${response.status}`);
    return { ok: true, url: canonical };
  }
  if (!response.ok) {
    return {
      ok: false,
      message: "No hemos podido comprobar el repo. Inténtalo de nuevo.",
    };
  }
  const body = (await response.json()) as { private?: boolean };
  if (body.private) {
    return { ok: false, message: "El repo tiene que ser público." };
  }
  return { ok: true, url: canonical };
}
