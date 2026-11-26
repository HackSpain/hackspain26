import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { fail } from "./errors";

/**
 * Images are served through the dashboard (`/api/files/<id>`, see
 * src/app/api/files/[id]/route.ts) so links carry our domain, never Convex's.
 * Feed images and profile pictures both go through here.
 */
export function imagePathFor(imageId: Id<"_storage">): string {
  return `/api/files/${imageId}`;
}

/** Shared storage check for avatars, team logos and feed photos. */
export async function assertStoredImage(
  ctx: MutationCtx,
  imageId: Id<"_storage">,
  maxBytes: number,
  tooLargeMessage: string
): Promise<void> {
  const meta = await ctx.db.system.get(imageId);
  if (!meta) {
    fail("NOT_FOUND", "La imagen no se ha subido");
  }
  if (!meta.contentType?.startsWith("image/")) {
    fail("VALIDATION", "Solo se admiten imágenes");
  }
  if (meta.size > maxBytes) {
    fail("VALIDATION", tooLargeMessage);
  }
}
