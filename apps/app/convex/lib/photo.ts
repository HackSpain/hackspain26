import type { Doc } from "../_generated/dataModel";
import { imagePathFor } from "./files";

/**
 * The participants map draws every photo inside a 28px disc, and the list
 * and profile panel use it at 52px at most. Uploads arrive at up to 2MB and
 * GitHub serves 460px avatars, so every surface that shows many people asks
 * for this width instead: the browser makes a copy at upload time
 * (`avatarThumbBlobUrl` / legacy `avatarThumbId`), older Convex uploads fall
 * back to the resizing file route, and GitHub honours `s=`.
 */
export const PHOTO_WIDTH = 128;

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
/** The browser-made 128px copy; anything bigger is not a thumbnail. */
export const MAX_THUMB_BYTES = 256 * 1024;

export const AVATAR_CONTENT_TYPES = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AvatarContentType = (typeof AVATAR_CONTENT_TYPES)[number];

export type AvatarUser = Pick<
  Doc<"users">,
  | "avatarBlobUrl"
  | "avatarId"
  | "avatarThumbBlobUrl"
  | "avatarThumbId"
  | "image"
>;

export function isAvatarContentType(value: string): value is AvatarContentType {
  return (AVATAR_CONTENT_TYPES as readonly string[]).includes(value);
}

/** Public Vercel Blob URLs from our store (and any other store on the same host). */
export function isVercelBlobUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === "https:" &&
    (parsed.hostname === "blob.vercel-storage.com" ||
      parsed.hostname.endsWith(".blob.vercel-storage.com"))
  );
}

export function hasUploadedAvatar(
  user: Pick<Doc<"users">, "avatarBlobUrl" | "avatarId">
): boolean {
  return Boolean(user.avatarBlobUrl?.trim() || user.avatarId);
}

export function storedBlobUrls(
  user: Pick<Doc<"users">, "avatarBlobUrl" | "avatarThumbBlobUrl">
): string[] {
  const urls: string[] = [];
  if (user.avatarBlobUrl) {
    urls.push(user.avatarBlobUrl);
  }
  if (
    user.avatarThumbBlobUrl &&
    user.avatarThumbBlobUrl !== user.avatarBlobUrl
  ) {
    urls.push(user.avatarThumbBlobUrl);
  }
  return urls;
}

/**
 * Full-size picture: a Vercel Blob upload, else a legacy Convex file, else
 * the GitHub avatar on `image`.
 */
export function avatarUrlFor(
  user: Pick<Doc<"users">, "avatarBlobUrl" | "avatarId" | "image">
): string | undefined {
  if (user.avatarBlobUrl?.trim()) {
    return user.avatarBlobUrl;
  }
  if (user.avatarId) {
    return imagePathFor(user.avatarId);
  }
  return user.image;
}

/** A GitHub avatar at PHOTO_WIDTH; any other external URL is left alone. */
export function externalThumbnail(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.hostname !== "avatars.githubusercontent.com") {
    return url;
  }
  parsed.searchParams.set("s", String(PHOTO_WIDTH));
  return parsed.toString();
}

export function avatarThumbnailFor(user: AvatarUser): string | undefined {
  if (user.avatarThumbBlobUrl?.trim()) {
    return user.avatarThumbBlobUrl;
  }
  if (user.avatarBlobUrl?.trim()) {
    return user.avatarBlobUrl;
  }
  if (user.avatarThumbId) {
    return imagePathFor(user.avatarThumbId);
  }
  if (user.avatarId) {
    return `${imagePathFor(user.avatarId)}?w=${PHOTO_WIDTH}`;
  }
  return user.image ? externalThumbnail(user.image) : undefined;
}
