import { normalizeTwitter } from "../../../app/convex/lib/normalize";

const X_HANDLE = /^[a-z0-9_]{1,15}$/;

/**
 * The dashboard's X rules (`apps/app/convex/lib/normalize.ts`, a pure module)
 * and the pattern `users.setTwitterHandle` checks, so a rejected handle never
 * makes the trip. Accepts "@ana", "ana" or an x.com / twitter.com URL.
 */
export function normalizeX(value: string): string {
  return normalizeTwitter(value);
}

export function validateX(value: string): string | undefined {
  return X_HANDLE.test(normalizeX(value))
    ? undefined
    : "That does not look like an X handle.";
}
