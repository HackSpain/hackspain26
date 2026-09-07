export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  const digits = trimmed.replaceAll(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    return null;
  }
  return `+${digits}`;
}

export function adminEmailAllowlist(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((value) => normalizeEmail(value))
      .filter((value) => value.length > 0)
  );
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function generateNumericCode(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => (byte % 10).toString()).join("");
}
