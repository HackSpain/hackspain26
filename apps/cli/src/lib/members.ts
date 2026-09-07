import { usageError } from "./errors";

export type IdentifierType = "email" | "github" | "twitter";
export type MemberInput = {
  identifierType: IdentifierType;
  identifier: string;
};

const TYPES: IdentifierType[] = ["email", "github", "twitter"];

/**
 * Parse `github:octocat`, `email:a@b.c`, `twitter:@handle`. A bare value with
 * an `@` in the middle is an email; a bare `@handle` is a Twitter/X handle;
 * anything else is a GitHub login.
 */
export function parseMember(raw: string): MemberInput {
  const value = raw.trim();
  if (!value) {
    throw usageError("Empty member identifier.");
  }
  const colon = value.indexOf(":");
  if (colon > 0) {
    const type = value.slice(0, colon).toLowerCase();
    const identifier = value.slice(colon + 1).trim();
    if (!TYPES.includes(type as IdentifierType)) {
      throw usageError(
        `Unknown member type "${type}" in "${raw}".`,
        "Use github:<login>, email:<address> or twitter:<handle>."
      );
    }
    if (!identifier) {
      throw usageError(`Missing identifier after "${type}:".`);
    }
    return { identifierType: type as IdentifierType, identifier };
  }
  if (value.startsWith("@")) {
    return { identifierType: "twitter", identifier: value };
  }
  if (value.includes("@")) {
    return { identifierType: "email", identifier: value };
  }
  return { identifierType: "github", identifier: value };
}

export function formatMember(member: {
  identifierType: IdentifierType;
  identifier: string;
}): string {
  switch (member.identifierType) {
    case "github":
      return `github:${member.identifier}`;
    case "twitter":
      return `x:${member.identifier}`;
    default:
      return member.identifier;
  }
}
