import type { Id } from "../_generated/dataModel";

/**
 * Images are served through the dashboard (`/api/files/<id>`, see
 * src/app/api/files/[id]/route.ts) so links carry our domain, never Convex's.
 * Feed images and profile pictures both go through here.
 */
export function imagePathFor(imageId: Id<"_storage">): string {
  return `/api/files/${imageId}`;
}
