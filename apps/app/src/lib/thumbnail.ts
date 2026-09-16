/**
 * `?w=` on /api/files/<id>: the CLI asks for a small PNG it can hand straight
 * to a terminal's image protocol. Bounded so nobody turns the route into a
 * free resizing service, and PNG-only so the CLI needs no decoders.
 */
export const MIN_THUMBNAIL_WIDTH = 16;
export const MAX_THUMBNAIL_WIDTH = 1024;

export function parseThumbnailWidth(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") {
    return null;
  }
  if (!/^\d{1,4}$/.test(raw.trim())) {
    return null;
  }
  const width = Number.parseInt(raw, 10);
  if (width < MIN_THUMBNAIL_WIDTH) {
    return MIN_THUMBNAIL_WIDTH;
  }
  return Math.min(width, MAX_THUMBNAIL_WIDTH);
}
