import type { LayoutProfile } from "../mosaic/artboard";
import {
  codeSvg,
  communitySvg,
  compassSvg,
  horseSvg,
  medalSvg,
  quixoteSvg,
  sparkSvg,
  sunSvg,
  trophySvg,
  windmillSvg,
} from "../theme/assets";

const SVG_MAP = {
  code: codeSvg,
  community: communitySvg,
  compass: compassSvg,
  horse: horseSvg,
  medal: medalSvg,
  quixote: quixoteSvg,
  spark: sparkSvg,
  sun: sunSvg,
  trophy: trophySvg,
  windmill: windmillSvg,
} as const;

type IllArt = keyof typeof SVG_MAP;

export interface IllDef {
  box: string;
  clip?: string;
  delay: number;
  /** Edge-to-edge in slot (preserveAspectRatio none). */
  fill?: "none";
  h: number;
  id: string;
  img: string;
  svg: string | null;
  w: number;
  x: number;
  y: number;
}

const SCHEDULE: (IllArt | null)[][] = [
  ["windmill", "sun", "horse", "quixote", null, null], // Inicio
  ["sun", "quixote", "windmill", "compass", null, null], // Misión
  ["spark", "code", null, "compass", null, null], // Tracks
  ["medal", "trophy", null, "spark", null, null], // Gran premio
  ["community", "sun", null, "quixote", null, null], // Comida, bebida y charlas
  ["trophy", "windmill", "horse", "quixote", null, null], // Apúntate
];

function slot4Geometry(
  _art: IllArt | null
): Pick<IllDef, "x" | "y" | "w" | "h" | "clip"> {
  return { h: 220, w: 360, x: 160, y: -20 };
}

function slot5Geometry(
  art: IllArt | null
): Pick<IllDef, "x" | "y" | "w" | "h" | "clip"> {
  if (art === "code") {
    return { h: 160, w: 160, x: 540, y: 180 };
  }
  return { h: 160, w: 160, x: 160, y: 180 };
}

function slot4GeometryCompact(
  art: IllArt | null
): Pick<IllDef, "x" | "y" | "w" | "h" | "clip"> {
  if (art === "spark" || art === "medal") {
    return { h: 320, w: 520, x: 940, y: 620 };
  }
  return { h: 320, w: 520, x: -20, y: 620 };
}

function slot5GeometryCompact(
  art: IllArt | null
): Pick<IllDef, "x" | "y" | "w" | "h" | "clip"> {
  if (art === "code") {
    return { h: 300, w: 520, x: 940, y: 960 };
  }
  return { h: 300, w: 520, x: -20, y: 960 };
}

function boxFor(slotIndex: number, art: IllArt | null): string {
  if (slotIndex === 5 && art === "code") {
    return "items-stretch justify-stretch p-0 min-h-0 min-w-0";
  }
  if (slotIndex === 4) {
    return "items-center justify-center p-2";
  }
  if (slotIndex === 5) {
    return "items-end justify-center pb-2";
  }
  if (slotIndex === 0 && art === "windmill") {
    return "items-center justify-center";
  }
  if (slotIndex === 0) {
    return "items-end justify-center";
  }
  if (slotIndex === 1) {
    return "items-center justify-center p-3";
  }
  if (slotIndex === 2) {
    return "items-center justify-center";
  }
  return "items-end justify-center";
}

function delayFor(slotIndex: number, art: IllArt | null): number {
  if (slotIndex === 5 && art === "code") {
    return 0.05;
  }
  if (slotIndex === 4) {
    return 0.01;
  }
  if (slotIndex === 5) {
    return 0.06;
  }
  if (slotIndex === 0) {
    return 0.04;
  }
  if (slotIndex === 1) {
    return 0.05;
  }
  if (slotIndex === 2) {
    return 0.03;
  }
  return 0.07;
}

function imgFor(slotIndex: number, art: IllArt | null): string {
  if (slotIndex === 5 && art === "code") {
    return "";
  }
  if (slotIndex === 1 && art === "quixote") {
    return "h-[90%] w-auto max-h-[96%]";
  }
  if (slotIndex === 1 && art === "compass") {
    return "h-[92%] w-auto max-h-[96%]";
  }
  if (slotIndex === 3 && art === "compass") {
    return "h-full w-auto max-w-[100%] max-h-full object-contain object-bottom";
  }
  if (slotIndex === 3 && art === "quixote") {
    return "h-full w-auto max-w-[100%] max-h-full object-contain object-bottom";
  }
  if (slotIndex === 0 && art === "windmill") {
    return "h-[84%] w-auto max-w-[90%]";
  }
  if (slotIndex === 0) {
    return "h-[94%] w-auto";
  }
  if (slotIndex === 1) {
    return "h-full w-auto";
  }
  if (slotIndex === 2) {
    return "w-full h-auto";
  }
  if (slotIndex === 3) {
    return "h-full w-auto max-w-[98%]";
  }
  if (slotIndex === 4) {
    return "h-[98%] w-auto max-w-[100%]";
  }
  return "w-[78%] h-auto max-h-[88%]";
}

const SLOT_IDS = [
  "ill-tl",
  "ill-tr",
  "ill-horse",
  "ill-br",
  "ill-slot-4",
  "ill-slot-5",
] as const;

export function illustrationsForSection(
  sectionIndex: number,
  profile: LayoutProfile = "desktop"
): IllDef[] {
  const rowIndex = Math.max(0, Math.min(SCHEDULE.length - 1, sectionIndex));
  const row = SCHEDULE[rowIndex];
  if (row === undefined) {
    return [];
  }
  const compact = profile === "compact";
  return SLOT_IDS.map((id, i) => {
    const art = row[i] ?? null;
    const svg = art ? SVG_MAP[art] : null;

    let x: number;
    let y: number;
    let w: number;
    let h: number;
    let clip: string | undefined;

    if (compact) {
      // Side accents drawn over the two middle cards so the themed art shows.
      if (i === 0) {
        x = -60;
        y = 760;
        w = 340;
        h = 300;
      } else if (i === 1) {
        x = 1160;
        y = 760;
        w = 340;
        h = 300;
      } else if (i === 2) {
        x = -50;
        y = 1740;
        w = 340;
        h = 300;
      } else if (i === 3) {
        x = 1160;
        y = 1740;
        w = 340;
        h = 300;
      } else if (i === 4) {
        ({ x, y, w, h, clip } = slot4GeometryCompact(art));
      } else {
        ({ x, y, w, h, clip } = slot5GeometryCompact(art));
      }
    } else if (i === 0) {
      // Windmill — cell 2 of the top row (200-390), centered.
      x = 200;
      y = 0;
      w = 190;
      h = 180;
    } else if (i === 1) {
      // Sun — cell 6 of the top row (1050-1240), centered (mirrors windmill).
      x = 1050;
      y = 0;
      w = 190;
      h = 180;
    } else if (i === 2) {
      // Horse — centered vertically in the content band (400-650).
      x = 0;
      y = 425;
      w = 200;
      h = 200;
    } else if (i === 3) {
      // Quixote/compass/trophy — centered vertically in the content band.
      x = 1220;
      y = 425;
      w = 220;
      h = 200;
    } else if (i === 4) {
      ({ x, y, w, h, clip } = slot4Geometry(art));
    } else {
      ({ x, y, w, h, clip } = slot5Geometry(art));
    }

    const fill = i === 5 && art === "code" ? ("none" as const) : undefined;

    return {
      box: boxFor(i, art),
      clip,
      delay: delayFor(i, art),
      fill,
      h,
      id,
      img: imgFor(i, art),
      svg,
      w,
      x,
      y,
    };
  });
}
