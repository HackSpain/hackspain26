import { normalizeGithubLogin } from "./githubProfile";
import { normalizeLinkedinSlug } from "./linkedinProfile";
import { urlOf } from "./urls";
import type { UrlEntry } from "./urls";

/** Resolve the identifiers displayed on a participant's directory sheet. */
function participantGithubLogin(
  githubUsername: string | undefined,
  urls: UrlEntry[] | undefined
): string | null {
  return (
    normalizeGithubLogin(githubUsername ?? "") ??
    normalizeGithubLogin(urlOf(urls, "github") ?? "")
  );
}

function participantLinkedinSlug(urls: UrlEntry[] | undefined): string | null {
  return normalizeLinkedinSlug(urlOf(urls, "linkedin") ?? "");
}

export function matchesParticipantProfile(
  kind: "github" | "linkedin",
  value: string,
  githubUsername: string | undefined,
  urls: UrlEntry[] | undefined
): boolean {
  const expected =
    kind === "github"
      ? participantGithubLogin(githubUsername, urls)
      : participantLinkedinSlug(urls);
  return expected !== null && expected === value;
}
