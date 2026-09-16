import { describe, expect, test } from "bun:test";
import {
  detectImageProtocol,
  imageCells,
  itermSequence,
  kittyDelete,
  kittyDeleteAll,
  kittyPlace,
  kittySequence,
  kittyTransmit,
  pngSize,
  renderImage,
} from "../src/lib/term-images";

const ESC = String.fromCodePoint(27);
const BEL = String.fromCodePoint(7);

/** Signature + IHDR only: enough for pngSize, and bytes for the encoders. */
function fakePng(width: number, height: number, padding = 0): Uint8Array {
  const bytes = new Uint8Array(24 + padding);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([73, 72, 68, 82], 12); // "IHDR"
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

describe("detectImageProtocol", () => {
  test("never draws when there is no TTY, in tmux, or when opted out", () => {
    expect(detectImageProtocol({ KITTY_WINDOW_ID: "1" }, false)).toBeNull();
    expect(
      detectImageProtocol({ KITTY_WINDOW_ID: "1", TMUX: "/tmp/x" }, true)
    ).toBeNull();
    expect(
      detectImageProtocol(
        { HACKSPAIN_NO_IMAGES: "1", TERM_PROGRAM: "iTerm.app" },
        true
      )
    ).toBeNull();
  });

  test("kitty-protocol terminals", () => {
    expect(detectImageProtocol({ TERM: "xterm-kitty" }, true)).toBe("kitty");
    expect(detectImageProtocol({ KITTY_WINDOW_ID: "3" }, true)).toBe("kitty");
    expect(detectImageProtocol({ TERM_PROGRAM: "ghostty" }, true)).toBe(
      "kitty"
    );
    expect(detectImageProtocol({ TERM_PROGRAM: "WezTerm" }, true)).toBe(
      "kitty"
    );
    expect(detectImageProtocol({ KONSOLE_VERSION: "230800" }, true)).toBe(
      "kitty"
    );
    expect(detectImageProtocol({ KONSOLE_VERSION: "211200" }, true)).toBeNull();
  });

  test("iterm-protocol terminals", () => {
    expect(detectImageProtocol({ TERM_PROGRAM: "iTerm.app" }, true)).toBe(
      "iterm"
    );
    expect(detectImageProtocol({ LC_TERMINAL: "iTerm2" }, true)).toBe("iterm");
    expect(detectImageProtocol({ TERM_PROGRAM: "vscode" }, true)).toBe("iterm");
    expect(detectImageProtocol({ TERM_PROGRAM: "WarpTerminal" }, true)).toBe(
      "iterm"
    );
  });

  test("everything else gets the link", () => {
    expect(detectImageProtocol({ TERM: "xterm-256color" }, true)).toBeNull();
    expect(
      detectImageProtocol({ TERM_PROGRAM: "Apple_Terminal" }, true)
    ).toBeNull();
    expect(detectImageProtocol({}, true)).toBeNull();
  });
});

describe("pngSize", () => {
  test("reads IHDR and rejects non-PNG bytes", () => {
    expect(pngSize(fakePng(640, 360))).toEqual({ height: 360, width: 640 });
    expect(pngSize(new Uint8Array([255, 216, 255]))).toBeNull(); // JPEG
    expect(pngSize(new Uint8Array(30))).toBeNull();
  });
});

describe("imageCells", () => {
  test("keeps the aspect on a 2:1 cell grid and caps the width", () => {
    expect(imageCells(576, 324)).toEqual({ columns: 36, rows: 10 });
    expect(imageCells(64, 64)).toEqual({ columns: 4, rows: 2 });
  });

  test("tall pictures give up columns to respect the row cap", () => {
    // Square: 36 columns would need 18 rows; the 12-row cap wins.
    expect(imageCells(2000, 2000)).toEqual({ columns: 24, rows: 12 });
    // Portrait: never taller than the cap, never narrower than one cell.
    expect(imageCells(16, 1000)).toEqual({ columns: 1, rows: 12 });
    expect(imageCells(600, 1200, { maxRows: 6 })).toEqual({
      columns: 6,
      rows: 6,
    });
  });

  test("the watcher's tighter bounds apply to both axes", () => {
    expect(imageCells(1600, 900, { maxColumns: 30, maxRows: 6 })).toEqual({
      columns: 21,
      rows: 6,
    });
    expect(imageCells(200, 200, { maxColumns: 30, maxRows: 6 })).toEqual({
      columns: 12,
      rows: 6,
    });
  });
});

describe("encoders", () => {
  test("kitty: PNG direct, quiet, sized, chunked with m flags", () => {
    const png = fakePng(576, 324, 7000);
    const seq = kittySequence(png, 36, 10);
    const chunks = seq.split(`${ESC}\\`).filter(Boolean);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toStartWith(`${ESC}_Ga=T,f=100,c=36,r=10,q=2,m=1;`);
    expect(chunks.at(-1)).toStartWith(`${ESC}_Gm=0;`);
    for (const chunk of chunks.slice(1, -1)) {
      expect(chunk).toStartWith(`${ESC}_Gm=1;`);
    }
    const payload = chunks
      .map((chunk) => chunk.slice(chunk.indexOf(";") + 1))
      .join("");
    expect(Buffer.from(payload, "base64")).toEqual(Buffer.from(png));
  });

  test("kitty: a small image is one chunk ending with m=0", () => {
    const seq = kittySequence(fakePng(32, 32), 2, 1);
    expect(seq).toStartWith(`${ESC}_Ga=T,f=100,c=2,r=1,q=2,m=0;`);
    expect(seq.split(`${ESC}\\`).filter(Boolean)).toHaveLength(1);
  });

  test("kitty: the watcher stores once, then places, moves and deletes by id", () => {
    const png = fakePng(32, 32);
    expect(kittyTransmit(png, 7)).toStartWith(`${ESC}_Ga=t,i=7,f=100,q=2,m=0;`);
    expect(kittyPlace(7, 12, 6)).toBe(`${ESC}_Ga=p,i=7,c=12,r=6,q=2${ESC}\\`);
    expect(kittyDelete(7)).toBe(`${ESC}_Ga=d,d=i,i=7,q=2${ESC}\\`);
    expect(kittyDeleteAll()).toBe(`${ESC}_Ga=d,d=A,q=2${ESC}\\`);
  });

  test("iterm: OSC 1337 with byte size and a cell box that keeps the aspect", () => {
    const png = fakePng(100, 50);
    const seq = itermSequence(png, 36, 10);
    expect(seq).toStartWith(
      `${ESC}]1337;File=inline=1;size=${png.byteLength};width=36;height=10;preserveAspectRatio=1:`
    );
    expect(seq).toEndWith(BEL);
    expect(seq).toContain(Buffer.from(png).toString("base64"));
  });

  test("renderImage picks the protocol, honours bounds, refuses non-PNG bytes", () => {
    expect(renderImage("kitty", fakePng(576, 324))).toContain("c=36,r=10");
    expect(renderImage("iterm", fakePng(576, 324))).toContain(
      "width=36;height=10"
    );
    expect(renderImage("kitty", fakePng(2000, 2000))).toContain("c=24,r=12");
    expect(
      renderImage("kitty", fakePng(2000, 2000), { maxColumns: 30, maxRows: 6 })
    ).toContain("c=12,r=6");
    expect(renderImage("kitty", new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
