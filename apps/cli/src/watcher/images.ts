import type { ImageProtocol } from "../lib/term-images";
import {
  itermSequence,
  kittyDelete,
  kittyDeleteAll,
  kittyPlace,
  kittyTransmit,
} from "../lib/term-images";

/**
 * Pictures on the live screen. The text frame is redrawn row by row; images
 * live outside that text and are reconciled against the slots the frame
 * reserved for them (blank rows inside the feed box).
 *
 * Kitty keeps image data server-side under an id, so a picture is sent once
 * and then placed, moved or removed with tiny commands. iTerm2-style
 * terminals attach the image to the cells it covers: rewriting those cells
 * erases it, so the picture is re-sent whenever a row it covers was
 * repainted or it moved.
 */

export type ImageSlot = {
  key: string;
  /** 0-based screen row and column of the picture's top-left cell. */
  row: number;
  col: number;
  columns: number;
  rows: number;
};

export type ImageWriter = (text: string) => void;

const ESC = String.fromCodePoint(27);

function moveTo(row: number, col: number): string {
  return `${ESC}[${row + 1};${col + 1}H`;
}

function sameSlot(a: ImageSlot, b: ImageSlot): boolean {
  return (
    a.row === b.row &&
    a.col === b.col &&
    a.columns === b.columns &&
    a.rows === b.rows
  );
}

function touches(slot: ImageSlot, rows: Set<number>): boolean {
  for (let r = slot.row; r < slot.row + slot.rows; r++) {
    if (rows.has(r)) {
      return true;
    }
  }
  return false;
}

export class ScreenImages {
  private readonly kittyIds = new Map<string, number>();
  private nextId = 1;
  private placed = new Map<string, ImageSlot>();
  private readonly protocol: ImageProtocol;
  private readonly write: ImageWriter;

  constructor(protocol: ImageProtocol, write: ImageWriter) {
    this.protocol = protocol;
    this.write = write;
  }

  /**
   * Bring the screen in line with `slots`. `changedRows` is the set of text
   * rows just repainted, or "all" after a full repaint.
   */
  sync(
    slots: ImageSlot[],
    pngs: Map<string, Uint8Array>,
    changedRows: Set<number> | "all"
  ): void {
    const next = new Map<string, ImageSlot>();
    for (const slot of slots) {
      if (pngs.has(slot.key)) {
        next.set(slot.key, slot);
      }
    }
    if (this.protocol === "kitty") {
      this.syncKitty(next, pngs, changedRows === "all");
    } else {
      this.syncIterm(next, pngs, changedRows);
    }
    this.placed = next;
  }

  /** Remove everything (leaving the alternate screen). */
  clear(): void {
    if (this.protocol === "kitty" && this.kittyIds.size > 0) {
      this.write(kittyDeleteAll());
    }
    this.kittyIds.clear();
    this.placed.clear();
  }

  private syncKitty(
    next: Map<string, ImageSlot>,
    pngs: Map<string, Uint8Array>,
    all: boolean
  ): void {
    let out = "";
    if (all) {
      // A full repaint cleared the screen; every placement must come back.
      for (const id of this.kittyIds.values()) {
        out += kittyDelete(id);
      }
    } else {
      for (const [key, slot] of this.placed) {
        const target = next.get(key);
        const id = this.kittyIds.get(key);
        if (id !== undefined && !(target && sameSlot(slot, target))) {
          out += kittyDelete(id);
        }
      }
    }
    for (const [key, slot] of next) {
      const previous = this.placed.get(key);
      if (!all && previous && sameSlot(previous, slot)) {
        continue;
      }
      let id = this.kittyIds.get(key);
      if (id === undefined) {
        id = this.nextId++;
        this.kittyIds.set(key, id);
        const png = pngs.get(key);
        if (!png) {
          continue;
        }
        out += kittyTransmit(png, id);
      }
      out +=
        moveTo(slot.row, slot.col) + kittyPlace(id, slot.columns, slot.rows);
    }
    if (out) {
      this.write(out);
    }
  }

  private syncIterm(
    next: Map<string, ImageSlot>,
    pngs: Map<string, Uint8Array>,
    changedRows: Set<number> | "all"
  ): void {
    let out = "";
    for (const [key, slot] of next) {
      const previous = this.placed.get(key);
      const needsDraw =
        changedRows === "all" ||
        !previous ||
        !sameSlot(previous, slot) ||
        touches(slot, changedRows);
      if (!needsDraw) {
        continue;
      }
      const png = pngs.get(key);
      if (!png) {
        continue;
      }
      out +=
        moveTo(slot.row, slot.col) +
        itermSequence(png, slot.columns, slot.rows);
    }
    if (out) {
      this.write(out);
    }
  }
}
