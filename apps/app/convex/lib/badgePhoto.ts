const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DATA_URI_RE = /^data:([a-z]+\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/;

/** Comfortably above a 400px square JPEG, far below anything worth storing. */
export const BADGE_PHOTO_MAX_LENGTH = 300_000;

export function isValidBadgePhoto(value: unknown): value is string {
  if (typeof value !== "string" || value.length > BADGE_PHOTO_MAX_LENGTH) {
    return false;
  }
  const match = DATA_URI_RE.exec(value);
  if (!match) {
    return false;
  }
  const mediaType = match[1];
  return mediaType !== undefined && ALLOWED_MEDIA_TYPES.has(mediaType);
}
