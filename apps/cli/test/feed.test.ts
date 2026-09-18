import { describe, expect, test } from "bun:test";
import type { FeedItem } from "../src/lib/feed-format";
import {
  imageContentType,
  postLines,
  withImageUrls,
} from "../src/lib/feed-format";
import { stripAnsi } from "../src/lib/style";

const NOW = Date.UTC(2026, 8, 19, 12, 0, 0);

describe("feed formatting", () => {
  test("a person's post shows who, team, text and image link", () => {
    const post: FeedItem = {
      _id: "p1",
      author: { name: "Ana" },
      createdAt: NOW - 120_000,
      imageUrl: "https://files.example/abc",
      kind: "post",
      teamName: "Quijote Labs",
      text: "Demo works!\nSecond line",
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
      createdAt: NOW - 30_000,
      github: {
        event: "push",
        repo: "quijote/agentos",
        url: "https://github.com/quijote/agentos/commit/abc",
      },
      kind: "github",
      teamName: "Quijote Labs",
      text: "ana pushed 3 commits to main: fix auth",
    };
    const lines = postLines(post, NOW).map(stripAnsi);
    expect(lines[0]).toBe("⑂ Quijote Labs · quijote/agentos · just now");
    expect(lines[1]).toContain("pushed 3 commits");
    expect(lines[2]).toContain("github.com/quijote/agentos/commit/abc");
  });

  test("remote posts cannot inject terminal controls", () => {
    const post: FeedItem = {
      _id: "hostile",
      author: {
        name: "Ana\u001B]52;c;ZXZpbA==\u0007",
      },
      createdAt: NOW,
      imageUrl: "https://files.example/image\rforged",
      kind: "post",
      teamName: "Quijote\u001B[2J Labs",
      text: [
        "visible\u001B]8;;https://evil.example\u0007 link\u001B]8;;\u0007",
        "safe\u001BPignored\u001B\\ text\u202E",
      ].join("\n"),
    };

    const rendered = postLines(post, NOW).map(stripAnsi).join("\n");
    expect(rendered).toContain("Ana · Quijote Labs");
    expect(rendered).toContain("visible link");
    expect(rendered).toContain("safe text");
    expect(rendered).toContain("image: https://files.example/imageforged");
    expect(rendered).not.toContain("evil.example");
    expect(rendered.replaceAll("\n", "")).not.toMatch(/\p{Cc}/u);
  });

  test("image paths become links on the dashboard domain", () => {
    const [withImage, without] = withImageUrls(
      [{ imagePath: "/api/files/abc" }, { imagePath: undefined }],
      "https://hackspain.app/"
    );
    expect(withImage?.imageUrl).toBe("https://hackspain.app/api/files/abc");
    expect(without?.imageUrl).toBeUndefined();
  });

  test("image content types by extension", () => {
    expect(imageContentType("demo.PNG")).toBe("image/png");
    expect(imageContentType("shot.jpeg")).toBe("image/jpeg");
    expect(() => imageContentType("notes.txt")).toThrow("Unsupported image");
  });
});
