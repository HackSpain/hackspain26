import type { Id } from "../_generated/dataModel";

/**
 * Images are served through the dashboard (`/api/files/<id>`, see
 * src/app/api/files/[id]/route.ts) so links carry our domain, never Convex's.
 * Feed images, team logos and profile pictures uploaded before Vercel Blob
 * go through here. New profile pictures are public Blob URLs instead.
 */
export function imagePathFor(imageId: Id<"_storage">): string {
  return `/api/files/${imageId}`;
}
