import { describe, expect, test } from "bun:test";
import type { ImageSlot } from "../src/watcher/images";
import { ScreenImages } from "../src/watcher/images";

const ESC = String.fromCodePoint(27);

function fakePng(seed: number): Uint8Array {
  const bytes = new Uint8Array(40);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes[39] = seed;
  return bytes;
}

function harness(protocol: "kitty" | "iterm") {
  const writes: string[] = [];
  const images = new ScreenImages(protocol, (text) => writes.push(text));
  const pngs = new Map([
    ["a", fakePng(1)],
    ["b", fakePng(2)],
  ]);
  const slot = (key: string, row: number): ImageSlot => ({
    col: 5,
    columns: 12,
    key,
    row,
    rows: 6,
  });
  const out = () => writes.join("");
  const reset = () => writes.splice(0);
  return { images, out, pngs, reset, slot };
}

const count = (text: string, needle: string) => text.split(needle).length - 1;

describe("ScreenImages on kitty", () => {
  test("first sync stores each picture once and places it at its slot", () => {
    const h = harness("kitty");
    h.images.sync([h.slot("a", 10), h.slot("b", 20)], h.pngs, "all");
    const out = h.out();
    expect(count(out, "a=t,i=1,f=100")).toBe(1);
    expect(count(out, "a=t,i=2,f=100")).toBe(1);
    expect(out).toContain(`${ESC}[11;6H${ESC}_Ga=p,i=1,c=12,r=6,q=2`);
    expect(out).toContain(`${ESC}[21;6H${ESC}_Ga=p,i=2,c=12,r=6,q=2`);
  });

  test("an unchanged frame writes nothing", () => {
    const h = harness("kitty");
    h.images.sync([h.slot("a", 10)], h.pngs, "all");
    h.reset();
    h.images.sync([h.slot("a", 10)], h.pngs, new Set([3, 4]));
    expect(h.out()).toBe("");
  });

  test("a moved picture is deleted and re-placed without re-sending bytes", () => {
    const h = harness("kitty");
    h.images.sync([h.slot("a", 10)], h.pngs, "all");
    h.reset();
    h.images.sync([h.slot("a", 14)], h.pngs, new Set());
    const out = h.out();
    expect(out).toContain("a=d,d=i,i=1");
    expect(out).toContain(`${ESC}[15;6H${ESC}_Ga=p,i=1,c=12,r=6`);
    expect(out).not.toContain("a=t,");
  });

  test("a picture that scrolled away is deleted; a full repaint re-places all", () => {
    const h = harness("kitty");
    h.images.sync([h.slot("a", 10), h.slot("b", 20)], h.pngs, "all");
    h.reset();
    h.images.sync([h.slot("b", 20)], h.pngs, new Set());
    expect(h.out()).toContain("a=d,d=i,i=1");
    expect(h.out()).not.toContain("a=d,d=i,i=2");
    h.reset();
    h.images.sync([h.slot("b", 20)], h.pngs, "all");
    expect(h.out()).toContain("a=d,d=i,i=2");
    expect(h.out()).toContain("a=p,i=2,c=12,r=6");
    h.reset();
    h.images.clear();
    expect(h.out()).toBe(`${ESC}_Ga=d,d=A,q=2${ESC}\\`);
  });

  test("slots without a fetched picture are skipped", () => {
    const h = harness("kitty");
    h.images.sync([h.slot("missing", 10)], h.pngs, "all");
    expect(h.out()).toBe("");
  });
});

describe("ScreenImages on iTerm2", () => {
  test("draws at the slot and re-sends only when a covered row was repainted", () => {
    const h = harness("iterm");
    h.images.sync([h.slot("a", 10)], h.pngs, "all");
    expect(h.out()).toContain(
      `${ESC}[11;6H${ESC}]1337;File=inline=1;size=40;width=12;height=6;preserveAspectRatio=1:`
    );
    h.reset();
    h.images.sync([h.slot("a", 10)], h.pngs, new Set([2, 30]));
    expect(h.out()).toBe("");
    h.images.sync([h.slot("a", 10)], h.pngs, new Set([12]));
    expect(count(h.out(), "1337;File")).toBe(1);
  });

  test("clear has nothing to undo: cells were erased by the text", () => {
    const h = harness("iterm");
    h.images.sync([h.slot("a", 10)], h.pngs, "all");
    h.reset();
    h.images.clear();
    expect(h.out()).toBe("");
  });
});
