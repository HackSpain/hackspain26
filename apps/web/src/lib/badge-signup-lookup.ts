import type { BadgeShareParams } from "./badge-share-params";
import { findSharedBadge as findSharedBadgeFromConvex } from "./convex-landing";

export interface SharedBadge extends BadgeShareParams {
  /** The photo they put on their badge, when they chose one. */
  photoDataUri: string | null;
  /** Changes whenever the photo does, so caches can be told apart. */
  photoVersion: number | null;
}

/**
 * Resolves a shared link against confirmed participations, and answers with
 * what the record says rather than what the link claimed. Anyone can put any
 * name in a query string, so nothing reaches the page or the social image until
 * a confirmed attendee actually matches it.
 */
export async function findSharedBadge({
  fullName,
  githubHandle,
}: BadgeShareParams): Promise<SharedBadge | null> {
  if (!fullName) {
    return null;
  }
  return await findSharedBadgeFromConvex({ fullName, githubHandle });
}
