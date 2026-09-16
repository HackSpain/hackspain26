import { describe, expect, test } from "bun:test";
import { parseBefore } from "../src/commands/feed";
import type { FeedItem } from "../src/lib/feed-format";
import { stripAnsi } from "../src/lib/style";
import {
  frameWithSlots,
  harnessLabel,
  harnessLogoKey,
} from "../src/watcher/screen";
import {
  appendOlderFeed,
  createState,
  FEED_PREFETCH,
  feedLive,
  mergeNewerFeed,
  scrollFeed,
} from "../src/watcher/state";

const NOW = Date.UTC(2026, 8, 19, 12, 0, 0);

function post(n: number, extra: Partial<FeedItem> = {}): FeedItem {
  return {
    _id: `p${n}`,
    author: { name: `Hacker ${n}` },
    createdAt: NOW - n * 60_000,
    kind: "post",
    text: `post number ${n}`,
    ...extra,
  };
}

function page(from: number, size: number): FeedItem[] {
  return Array.from({ length: size }, (_, i) => post(from + i));
}

function state() {
  return createState({
    me: { email: "d@example.com", name: "Domènec" },
    uploadEnabled: false,
  });
}

function stateFor(imageProtocol: "kitty" | "iterm" | null) {
  const s = createState({
    imageProtocol,
    me: { email: "d@example.com", name: "Domènec" },
    uploadEnabled: false,
  });
  s.harnesses = [{ found: true, id: "claude-code", requests: 0, tokens: 0 }];
  return s;
}

describe("feed pages in the watcher", () => {
  test("the latest page loads newest first and older pages append", () => {
    const s = state();
    mergeNewerFeed(s, page(0, 15));
    expect(s.feed.map((p) => p._id)).toEqual(page(0, 15).map((p) => p._id));
    appendOlderFeed(s, page(15, 15), 15);
    expect(s.feed).toHaveLength(30);
    expect(s.feedExhausted).toBe(false);
    appendOlderFeed(s, page(30, 4), 15);
    expect(s.feed).toHaveLength(34);
    expect(s.feedExhausted).toBe(true);
    expect(s.feedNeedOlder).toBe(false);
  });

  test("new posts go on top and keep a scrolled view where it was", () => {
    const s = state();
    mergeNewerFeed(s, page(0, 15));
    scrollFeed(s, 3);
    expect(s.feedOffset).toBe(3);
    expect(s.feed[3]?._id).toBe("p3");
    // Two newer posts arrive; the reader still looks at p3.
    mergeNewerFeed(s, [post(-2), post(-1), ...page(0, 13)]);
    expect(s.feed[0]?._id).toBe("p-2");
    expect(s.feedOffset).toBe(5);
    expect(s.feed[s.feedOffset]?._id).toBe("p3");
    // Live view never moves.
    feedLive(s);
    mergeNewerFeed(s, [post(-3), ...page(-2, 14)]);
    expect(s.feedOffset).toBe(0);
  });

  test("a post deleted on the server disappears from the loaded window", () => {
    const s = state();
    mergeNewerFeed(s, page(0, 15));
    const withoutP4 = page(0, 15).filter((p) => p._id !== "p4");
    mergeNewerFeed(s, withoutP4);
    expect(s.feed.some((p) => p._id === "p4")).toBe(false);
    expect(s.feed).toHaveLength(14);
  });

  test("scrolling clamps and asks for an older page near the end", () => {
    const s = state();
    mergeNewerFeed(s, page(0, 15));
    expect(scrollFeed(s, -1)).toBe(false);
    expect(s.feedOffset).toBe(0);
    expect(s.feedNeedOlder).toBe(false);
    expect(scrollFeed(s, 5)).toBe(true);
    expect(s.feedNeedOlder).toBe(false);
    scrollFeed(s, 15 - FEED_PREFETCH - 5);
    expect(s.feedNeedOlder).toBe(true);
    scrollFeed(s, 100);
    expect(s.feedOffset).toBe(14);
    appendOlderFeed(s, page(15, 2), 15);
    expect(s.feedExhausted).toBe(true);
    scrollFeed(s, 100);
    expect(s.feedOffset).toBe(16);
    expect(s.feedNeedOlder).toBe(false);
  });
});

describe("feed pictures in the watcher frame", () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  function stateWithImage() {
    const s = createState({
      imageProtocol: "kitty",
      me: { email: "d@example.com", name: "Domènec" },
      uploadEnabled: false,
    });
    s.harnesses = [{ found: true, id: "claude-code", requests: 0, tokens: 0 }];
    mergeNewerFeed(s, [
      post(0, {
        imagePath: "/api/files/x",
        imageUrl: "https://app/api/files/x",
      }),
      post(1),
    ]);
    s.feedImages.set("p0", { height: 300, png, width: 800 });
    return s;
  }

  test("reserves blank rows after the post and reports the slot in screen cells", () => {
    const s = stateWithImage();
    const { lines, slots: all } = frameWithSlots(
      s,
      { columns: 120, rows: 40 },
      { now: NOW }
    );
    // Header and harness logos have their own slots; only the post here.
    const slots = all.filter((x) => x.key === "p0");
    expect(slots).toHaveLength(1);
    const [slot] = slots;
    expect(slot?.key).toBe("p0");
    expect(slot?.col).toBe(5);
    // 800×300 under 30×6: 30 columns would need 6 rows (30 * 0.375 / 2 ≈ 6).
    expect(slot?.columns).toBe(30);
    expect(slot?.rows).toBe(6);
    const plain = lines.map(stripAnsi);
    // The rows the picture covers are blank inside the box, and the link is gone.
    for (
      let r = slot?.row ?? 0;
      r < (slot?.row ?? 0) + (slot?.rows ?? 0);
      r++
    ) {
      expect(plain[r]?.replaceAll("│", "").trim()).toBe("");
    }
    expect(plain.join("\n")).not.toContain("image:");
    // The text of the post sits right above the picture.
    expect(plain[(slot?.row ?? 0) - 1]).toContain("post number 0");
  });

  test("falls back to the link when the terminal cannot draw or the box is too short", () => {
    const s = stateWithImage();
    s.imageProtocol = null;
    const noProtocol = frameWithSlots(
      s,
      { columns: 120, rows: 40 },
      { now: NOW }
    );
    expect(noProtocol.slots).toHaveLength(0);
    expect(noProtocol.lines.map(stripAnsi).join("\n")).toContain("image:");

    s.imageProtocol = "kitty";
    const cramped = frameWithSlots(s, { columns: 120, rows: 24 }, { now: NOW });
    expect(cramped.slots.filter((x) => x.key === "p0")).toHaveLength(0);
  });

  test("the subtitle says where the reader is", () => {
    const s = stateWithImage();
    const live = frameWithSlots(s, { columns: 120, rows: 40 }, { now: NOW });
    expect(live.lines.map(stripAnsi).join("\n")).toContain("↓ older");
    scrollFeed(s, 1);
    const scrolled = frameWithSlots(
      s,
      { columns: 120, rows: 40 },
      { now: NOW }
    );
    expect(scrolled.lines.map(stripAnsi).join("\n")).toContain("1 newer above");
  });
});

describe("watcher header and branding", () => {
  test("tall terminals with image support reserve the wordmark rows for the PNG", () => {
    const s = stateFor("kitty");
    const { lines, slots } = frameWithSlots(
      s,
      { columns: 120, rows: 50 },
      { now: NOW }
    );
    const logo = slots.find((slot) => slot.key === "logo");
    expect(logo).toEqual({ col: 0, columns: 36, key: "logo", row: 0, rows: 6 });
    const plain = lines.map(stripAnsi);
    for (let r = 0; r < 6; r++) {
      expect(plain[r]?.trim()).toBe("");
    }
    expect(plain[6]).toContain("live usage board");
  });

  test("without image support the ASCII wordmark stays", () => {
    const s = stateFor(null);
    const { lines, slots } = frameWithSlots(
      s,
      { columns: 120, rows: 50 },
      { now: NOW }
    );
    expect(slots.some((slot) => slot.key === "logo")).toBe(false);
    expect(stripAnsi(lines[0] ?? "").trim()).not.toBe("");
  });

  test("with image support the harness rows leave room for the real logo", () => {
    for (const size of [
      { columns: 120, rows: 50 },
      { columns: 80, rows: 40 },
      { columns: 60, rows: 12 },
    ]) {
      const s = stateFor("kitty");
      s.harnesses = [
        { found: true, id: "claude-code", requests: 3, tokens: 100 },
        { found: false, id: "codex", requests: 0, tokens: 0 },
      ];
      const { lines, slots } = frameWithSlots(s, size, { now: NOW });
      const claude = slots.find((x) => x.key === harnessLogoKey("claude-code"));
      const codex = slots.find((x) => x.key === harnessLogoKey("codex"));
      expect(claude).toMatchObject({ col: 2, columns: 2, rows: 1 });
      expect(codex).toMatchObject({ col: 2, columns: 2, rows: 1 });
      // One blank row between logos so the pictures do not touch.
      expect((codex?.row ?? 0) - (claude?.row ?? 0)).toBe(2);
      // Only the left column: in the wide layout another box shares the line.
      const gap = stripAnsi(lines[(claude?.row ?? 0) + 1] ?? "").slice(0, 40);
      expect(gap.replaceAll("│", "").trim()).toBe("");
      // The logo row shows the name after two blank cells, no glyph.
      const row = stripAnsi(lines[claude?.row ?? 0] ?? "");
      expect(row.startsWith("│    Claude Code")).toBe(true);
      expect(row).not.toContain("✻");
    }
  });

  test("harness rows carry a brand glyph before the name", () => {
    const s = stateFor(null);
    s.harnesses = [
      { found: true, id: "claude-code", requests: 3, tokens: 100 },
      { found: false, id: "codex", requests: 0, tokens: 0 },
    ];
    const text = frameWithSlots(s, { columns: 120, rows: 40 }, { now: NOW })
      .lines.map(stripAnsi)
      .join("\n");
    expect(text).toContain("✻ Claude Code");
    expect(text).toContain("⬡ Codex");
    expect(harnessLabel("something-new")).toContain("● something-new");
  });
});

describe("parseBefore", () => {
  test("accepts a ms cursor or an ISO date, rejects the rest", () => {
    expect(parseBefore()).toBeUndefined();
    expect(parseBefore("1789546968351")).toBe(1_789_546_968_351);
    expect(parseBefore("2026-09-19T12:00:00Z")).toBe(NOW);
    expect(() => parseBefore("yesterday")).toThrow(/--before/);
    expect(() => parseBefore("42")).toThrow(/--before/);
  });
});
