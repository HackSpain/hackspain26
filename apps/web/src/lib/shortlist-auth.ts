export const SHORTLIST_COOKIE_NAME = "hs_shortlist_auth";

export function shortlistPassword(): string | null {
  const password = import.meta.env.SHORTLIST_PASSWORD;
  return typeof password === "string" && password.length > 0 ? password : null;
}

export async function shortlistExpectedToken(
  password: string
): Promise<string> {
  const data = new TextEncoder().encode(`hackspain-shortlist:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isShortlistAuthorized(
  cookieValue: string | undefined
): Promise<boolean> {
  const password = shortlistPassword();
  if (!password) {
    return false;
  }
  const expected = await shortlistExpectedToken(password);
  return cookieValue === expected;
}
