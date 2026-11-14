import { useReducedMotion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import type { LayoutProfile } from "./artboard";
import { artboardFor } from "./artboard";
import type { CellDef } from "./cells";
import { COMMUNITY_CELLS } from "./cells";

interface Props {
  "aria-hidden"?: boolean;
  className?: string;
  /** Merge the tiles into the community section's regions. */
  merged?: boolean;
  strokeOnly?: boolean;
  variant?: LayoutProfile;
}

const PAPER = "var(--color-hs-paper)";
const INK = "var(--color-hs-ink)";
const ORANGE = "var(--color-hs-orange)";
const TEAL = "var(--color-hs-teal)";

type Rect = readonly [x: number, y: number, w: number, h: number, fill: string];
type Tri = readonly [points: string, fill: string];

// Desktop Mondrian — strict horizontal bands, clean tiling.
// Each rect aligns to a content cell slot (or is purely decorative).
const DESKTOP_RECTS: readonly Rect[] = [
  // Band 1 (top row) — y 0-180 : 7 cells, narrow centered main cell
  [0, 0, 200, 180, PAPER],
  [200, 0, 190, 180, PAPER], // r1b
  [390, 0, 190, 180, PAPER],
  [580, 0, 280, 180, PAPER], // r1c (narrow centered main)
  [860, 0, 190, 180, PAPER],
  [1050, 0, 190, 180, PAPER], // r1d
  [1240, 0, 200, 180, ORANGE],

  // Band 2 (hero) — y 180-400
  [0, 180, 200, 220, PAPER],
  [200, 180, 280, 220, PAPER], // r3a
  [480, 180, 480, 220, PAPER], // hero
  [960, 180, 260, 220, PAPER], // r3b
  [1220, 180, 220, 220, PAPER],

  // Band 3 (content row) — y 400-650 : symmetric, centered main cell
  [0, 400, 220, 250, ORANGE], // horse cell (diagonal overlay below)
  [220, 400, 220, 250, TEAL], // r4b
  [440, 400, 560, 250, PAPER], // r4c (centered main)
  [1000, 400, 220, 250, PAPER], // r4d
  [1220, 400, 220, 250, PAPER], // quixote cell

  // Band 4 (open row) — y 650-830 : 5 equal cells (288 wide)
  [0, 650, 288, 180, PAPER], // o1
  [288, 650, 288, 180, PAPER], // o2
  [576, 650, 288, 180, PAPER], // o3
  [864, 650, 288, 180, PAPER], // o4
  [1152, 650, 288, 180, PAPER], // o5

  // Band 5 (footer) — y 830-900
  [0, 830, 360, 70, PAPER], // r5a
  [360, 830, 360, 70, PAPER], // r5b
  [720, 830, 360, 70, TEAL], // r5c
  [1080, 830, 360, 70, PAPER], // r5d
];

// Decorative triangles layered over tiles for Mondrian asymmetry.
const DESKTOP_TRIS: readonly Tri[] = [
  // Top-left orange diagonal (corner-to-corner, like the other corners)
  ["0,0 200,0 0,180", ORANGE],
  // Top-right teal wedge in orange corner tile
  ["1240,0 1440,180 1240,180", TEAL],
  // Hero band right: orange wedge in teal corner
  ["1220,180 1440,400 1220,400", ORANGE],
  // Band 3 left: paper diagonal over orange horse cell
  ["0,400 220,400 0,650", PAPER],
];

// Portrait layout (1440 x 2320): hero, two big content cards, footer.
// Boundaries mirror CELLS_COMPACT so the ink stroke grid frames each card.
// Tiles are paper so empty slots stay clean; content cards paint their own bg.
// The ornament strip's colours and diagonals come from React cells per section.
const COMPACT_RECTS: readonly Rect[] = [
  [0, 0, 1440, 580, PAPER],
  [0, 580, 1440, 640, PAPER],
  [0, 1220, 288, 200, PAPER], // orn1
  [288, 1220, 288, 200, PAPER], // orn2
  [576, 1220, 288, 200, PAPER], // orn3
  [864, 1220, 288, 200, PAPER], // orn4
  [1152, 1220, 288, 200, PAPER], // orn5
  [0, 1420, 1440, 660, PAPER],
  [0, 2080, 1440, 240, PAPER],
];

const TILES: Record<
  LayoutProfile,
  {
    rects: readonly Rect[];
    /** Stroke widths for the filled layer and the stroke-only overlay. */
    stroke: { fill: number; overlay: number };
    tris: readonly Tri[];
  }
> = {
  compact: { rects: COMPACT_RECTS, stroke: { fill: 4, overlay: 5 }, tris: [] },
  desktop: {
    rects: DESKTOP_RECTS,
    stroke: { fill: 5, overlay: 6 },
    tris: DESKTOP_TRIS,
  },
};

/** The community region containing the tile's centre, if any. */
function regionFor(
  [x, y, w, h]: Rect,
  regions: readonly CellDef[]
): CellDef | undefined {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return regions.find(
    (r) => cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h
  );
}

export function MosaicBackground({
  className = "",
  merged = false,
  strokeOnly = false,
  "aria-hidden": ariaHidden = true,
  variant = "desktop",
}: Props) {
  const reducedMotion = useReducedMotion();
  const { h: height, w: width } = artboardFor(variant);
  const { rects, stroke, tris } = TILES[variant];
  const regions = COMMUNITY_CELLS[variant];
  const sw = strokeOnly ? stroke.overlay : stroke.fill;
  const fixed = rects.filter((rect) => !regionFor(rect, regions));
  const split = rects.filter((rect) => regionFor(rect, regions));

  // The merge is a crossfade of whole layers: opacity is composited, while
  // moving tile geometry repaints every full-screen SVG on every frame.
  const layer = (visible: boolean): CSSProperties => ({
    opacity: visible ? 1 : 0,
    transition: reducedMotion
      ? "none"
      : "opacity 260ms cubic-bezier(0.23, 1, 0.32, 1)",
    willChange: "opacity",
  });
  const tile = ([x, y, w, h, fill]: Rect, key: string) => (
    <rect
      fill={strokeOnly ? "none" : fill}
      height={h}
      key={key}
      stroke={INK}
      strokeLinejoin="miter"
      strokeWidth={sw}
      width={w}
      x={x}
      y={y}
    />
  );
  const svg = (children: ReactNode, style?: CSSProperties) => (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      style={style}
      viewBox={`0 0 ${width} ${height}`}
    >
      <title>Mosaic background</title>
      {children}
    </svg>
  );

  return (
    <div aria-hidden={ariaHidden} className={className}>
      {svg(
        <>
          {!strokeOnly && <rect fill={PAPER} height={height} width={width} />}
          {fixed.map((rect) => tile(rect, rect.slice(0, 4).join("-")))}
        </>
      )}
      {svg(
        <>
          {split.map((rect) => tile(rect, rect.slice(0, 4).join("-")))}
          {tris.map(([points, fill]) => (
            <polygon
              fill={strokeOnly ? "none" : fill}
              key={points}
              points={points}
              stroke={INK}
              strokeLinejoin="bevel"
              strokeWidth={sw}
            />
          ))}
        </>,
        layer(!merged)
      )}
      {svg(
        regions.map((r) => tile([r.x, r.y, r.w, r.h, PAPER], r.id)),
        layer(merged)
      )}
    </div>
  );
}
