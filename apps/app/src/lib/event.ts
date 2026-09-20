import { SUBMIT_CLOSES_AT_MS } from "@convex/lib/submitWindow";

/**
 * Sunday 20 Sep 2026, 08:00 Europe/Madrid (CEST). The Submit tile
 * becomes the featured home card from this instant until 11:05.
 */
export const SUBMIT_FEATURED_AT_MS = Date.parse("2026-09-20T08:00:00+02:00");

export function isSubmitFeatured(now = Date.now()): boolean {
  return now >= SUBMIT_FEATURED_AT_MS && now < SUBMIT_CLOSES_AT_MS;
}
