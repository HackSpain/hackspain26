/** GitHub's own rule: alphanumeric or single hyphens, up to 39 characters. */
const GITHUB_HANDLE_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export function isGithubHandle(value: string): boolean {
  return GITHUB_HANDLE_RE.test(value);
}
