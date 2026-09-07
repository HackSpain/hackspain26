import type { CellDef } from "./cells";

/**
 * Compact (portrait) layout — artboard 1440 x 2320.
 *
 * hero | b1 | ornament (5 decorative cells) | b2 | foot
 */
export const CELLS_COMPACT: CellDef[] = [
  { delay: 0, h: 580, id: "hero", w: 1440, x: 0, y: 0 },
  { delay: 0.05, h: 640, id: "b1", w: 1440, x: 0, y: 580 },
  // Ornament strip — 5 equal cells, purely decorative
  { delay: 0.03, h: 200, id: "orn1", w: 288, x: 0, y: 1220 },
  { delay: 0.04, h: 200, id: "orn2", w: 288, x: 288, y: 1220 },
  { delay: 0.05, h: 200, id: "orn3", w: 288, x: 576, y: 1220 },
  { delay: 0.06, h: 200, id: "orn4", w: 288, x: 864, y: 1220 },
  { delay: 0.07, h: 200, id: "orn5", w: 288, x: 1152, y: 1220 },
  { delay: 0.1, h: 660, id: "b2", w: 1440, x: 0, y: 1420 },
  { delay: 0.15, h: 240, id: "foot", w: 1440, x: 0, y: 2080 },
];
