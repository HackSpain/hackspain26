export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isLikelyEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

export function parseEmailList(values: readonly string[]): {
  emails: string[];
  invalid: string[];
} {
  const seen = new Set<string>();
  const emails: string[] = [];
  const invalid: string[] = [];
  const invalidSeen = new Set<string>();

  for (const value of values) {
    for (const part of value.split(/[\s,;]+/)) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }
      const email = normalizeEmail(trimmed);
      if (!isLikelyEmail(email)) {
        if (!invalidSeen.has(email)) {
          invalidSeen.add(email);
          invalid.push(email);
        }
        continue;
      }
      if (seen.has(email)) {
        continue;
      }
      seen.add(email);
      emails.push(email);
    }
  }
  return { emails, invalid };
}

function firstPathSegment(pathname: string): string {
  return pathname.replace(/^\/+/, "").split("/")[0]?.toLowerCase() ?? "";
}

function handleFromUrl(
  input: string,
  looksLikeHost: (value: string) => boolean,
  fromHost?: (host: string, pathname: string) => string | null
): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }
  let withProtocol = "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    withProtocol = trimmed;
  } else if (trimmed.startsWith("//")) {
    withProtocol = `https:${trimmed}`;
  } else if (looksLikeHost(trimmed)) {
    withProtocol = `https://${trimmed.replace(/^\/+/, "")}`;
  }
  if (withProtocol) {
    try {
      const url = new URL(withProtocol);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      const fromCustom = fromHost?.(host, url.pathname);
      if (fromCustom !== undefined && fromCustom !== null) {
        return fromCustom;
      }
      return firstPathSegment(url.pathname);
    } catch {
      return "";
    }
  }
  return (
    trimmed
      .replace(/^@/, "")
      .split(/[/?#\s]/)[0]
      ?.toLowerCase() ?? ""
  );
}

export function normalizeGithub(input: string): string {
  return handleFromUrl(
    input,
    (value) => value.includes("github.com"),
    (host, pathname) => {
      if (host === "github.com" || host === "gist.github.com") {
        return firstPathSegment(pathname);
      }
      if (host.endsWith(".github.io")) {
        return host.slice(0, -".github.io".length).toLowerCase();
      }
      return "";
    }
  );
}

export function normalizeTwitter(input: string): string {
  return handleFromUrl(
    input,
    (value) => value.includes("x.com") || value.includes("twitter.com")
  );
}

export { normalizePhone, PHONE_ERROR } from "./phone";

export function adminEmailAllowlist(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((value) => normalizeEmail(value))
      .filter((value) => value.length > 0)
  );
}
