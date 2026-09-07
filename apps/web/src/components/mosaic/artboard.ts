export interface Artboard {
  h: number;
  w: number;
}

export const ARTBOARD_DESKTOP: Artboard = { h: 900, w: 1440 };

const ARTBOARD_COMPACT: Artboard = { h: 2320, w: 1440 };

export type LayoutProfile = "desktop" | "compact";

export const COMPACT_MEDIA_QUERY = "(max-width: 767px)";

export function artboardFor(profile: LayoutProfile): Artboard {
  return profile === "compact" ? ARTBOARD_COMPACT : ARTBOARD_DESKTOP;
}
