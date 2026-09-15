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
