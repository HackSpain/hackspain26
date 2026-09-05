import { describe, expect, test } from "bun:test";
import {
  type FeedItem,
  imageContentType,
  postLines,
} from "../src/lib/feed-format";
import { stripAnsi } from "../src/lib/style";

const NOW = Date.UTC(2026, 8, 19, 12, 0, 0);

describe("feed formatting", () => {
  test("a person's post shows who, team, text and image link", () => {
    const post: FeedItem = {
      _id: "p1",
      kind: "post",
      text: "Demo works!\nSecond line",
      createdAt: NOW - 120_000,
      author: { name: "Ana" },
      teamName: "Quijote Labs",
      imageUrl: "https://files.example/abc",
    };
    const lines = postLines(post, NOW).map(stripAnsi);
    expect(lines[0]).toBe("Ana · Quijote Labs · 2 min ago");
    expect(lines[1]).toBe("   Demo works!");
    expect(lines[2]).toBe("   Second line");
    expect(lines[3]).toBe("   image: https://files.example/abc");
  });

  test("a GitHub event shows the team, repo and link", () => {
    const post: FeedItem = {
      _id: "p2",
      kind: "github",
      text: "ana pushed 3 commits to main: fix auth",
      createdAt: NOW - 30_000,
      teamName: "Quijote Labs",
      github: {
        repo: "quijote/agentos",
        event: "push",
        url: "https://github.com/quijote/agentos/commit/abc",
      },
    };
    const lines = postLines(post, NOW).map(stripAnsi);
    expect(lines[0]).toBe("⑂ Quijote Labs · quijote/agentos · just now");
    expect(lines[1]).toContain("pushed 3 commits");
    expect(lines[2]).toContain("github.com/quijote/agentos/commit/abc");
  });

  test("image content types by extension", () => {
    expect(imageContentType("demo.PNG")).toBe("image/png");
    expect(imageContentType("shot.jpeg")).toBe("image/jpeg");
    expect(() => imageContentType("notes.txt")).toThrow("Unsupported image");
  });
});
