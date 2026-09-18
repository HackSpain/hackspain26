import type { Doc } from "../_generated/dataModel";
import { imagePathFor } from "./files";

/**
 * The participants map draws every photo inside a 28px disc, and the list
 * and profile panel use it at 52px at most. Uploads arrive at up to 2MB and
 * GitHub serves 460px avatars, so every surface that shows many people asks
 * for this width instead: the browser makes a copy at upload time
 * (`avatarThumbId`), older uploads fall back to the resizing file route, and
 * GitHub honours `s=`.
 */
export const PHOTO_WIDTH = 128;

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

export function avatarThumbnailFor(
  user: Pick<Doc<"users">, "avatarId" | "avatarThumbId" | "image">,
): string | undefined {
  if (user.avatarThumbId) {
    return imagePathFor(user.avatarThumbId);
  }
  if (user.avatarId) {
    return `${imagePathFor(user.avatarId)}?w=${PHOTO_WIDTH}`;
  }
  return user.image ? externalThumbnail(user.image) : undefined;
}
