import type { LayoutProfile } from "./artboard";
import { CELLS_COMPACT } from "./cells-compact";

export interface CellDef {
  clip?: string;
  delay: number;
  h: number;
  id: string;
  w: number;
  x: number;
  y: number;
}

/**
 * Desktop content grid — strict horizontal bands, no y-overlap.
 *
 * Bands: 0-180 (top) | 180-400 (hero) | 400-650 | 650-830 (open) | 830-900
 * (footer). The hero band sits one row up from center; the open band at
 * 650-830 is intentionally free for additional content.
 * Each content cell is a clean rectangle aligned to a mosaic tile.
 * Decorative-only tiles (corners, triangles, accents) are drawn by
 * MosaicBackground and intentionally have no entry here.
 *
 * Top, content and open bands share the same symmetric column layout
 * (220 | centered 560 | 220) so each has a clean, neatly centered main cell
 * (`r1c`, `r4c`, `open`).
 */
const CELLS: CellDef[] = [
  // Band 1 (top row) — y 0-180 : 7 cells, narrow centered main cell (r1c)
  // Columns: 0-200 | 200-390 (r1b) | 390-580 | 580-860 (r1c) | 860-1050 |
  // 1050-1240 (r1d) | 1240-1440
  { delay: 0.03, h: 180, id: "r1b", w: 190, x: 200, y: 0 },
  { delay: 0.02, h: 180, id: "r1c", w: 280, x: 580, y: 0 },
  { delay: 0.04, h: 180, id: "r1d", w: 190, x: 1050, y: 0 },

  // Band 2 (hero row) — y 180-400
  { delay: 0.05, h: 220, id: "r3a", w: 280, x: 200, y: 180 },
  { delay: 0, h: 220, id: "hero", w: 480, x: 480, y: 180 },
  { delay: 0.07, h: 220, id: "r3b", w: 260, x: 960, y: 180 },

  // Band 3 (content row) — y 400-650 : symmetric, centered main cell (r4c)
  { delay: 0.06, h: 250, id: "r4b", w: 220, x: 220, y: 400 },
  { delay: 0.04, h: 250, id: "r4c", w: 560, x: 440, y: 400 },
  { delay: 0.08, h: 250, id: "r4d", w: 220, x: 1000, y: 400 },

  // Band 4 (open row) — y 650-830 : 5 equal cells (288 wide), free on the homepage
  { delay: 0.03, h: 180, id: "o1", w: 288, x: 0, y: 650 },
  { delay: 0.05, h: 180, id: "o2", w: 288, x: 288, y: 650 },
  { delay: 0.04, h: 180, id: "o3", w: 288, x: 576, y: 650 },
  { delay: 0.06, h: 180, id: "o4", w: 288, x: 864, y: 650 },
  { delay: 0.07, h: 180, id: "o5", w: 288, x: 1152, y: 650 },

  // Band 5 (footer) — y 830-900
  { delay: 0.03, h: 70, id: "r5a", w: 360, x: 0, y: 830 },
  { delay: 0.05, h: 70, id: "r5b", w: 360, x: 360, y: 830 },
  { delay: 0.07, h: 70, id: "r5c", w: 360, x: 720, y: 830 },
  { delay: 0.09, h: 70, id: "r5d", w: 360, x: 1080, y: 830 },
];

export function cellsForProfile(profile: LayoutProfile): CellDef[] {
  if (profile !== "compact") {
    return CELLS;
  }
  return CELLS_COMPACT;
}
