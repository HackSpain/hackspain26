import { describe, expect, test } from "bun:test";
import {
  parseGithubRepoUrl,
  parseOptionalProductUrl,
  parseProjectName,
  parseYoutubeWatchUrl,
} from "./submission";

describe("parseYoutubeWatchUrl", () => {
  test("accepts watch, short and youtu.be links", () => {
    expect(parseYoutubeWatchUrl("https://www.youtube.com/watch?v=dQw4w9wgGcQ")).toEqual({
      ok: true,
      value: "https://www.youtube.com/watch?v=dQw4w9wgGcQ",
    });
    expect(parseYoutubeWatchUrl("https://youtu.be/dQw4w9wgGcQ")).toEqual({
      ok: true,
      value: "https://www.youtube.com/watch?v=dQw4w9wgGcQ",
    });
    expect(parseYoutubeWatchUrl("https://youtube.com/embed/dQw4w9wgGcQ")).toEqual({
      ok: true,
      value: "https://www.youtube.com/watch?v=dQw4w9wgGcQ",
    });
  });

  test("rejects loom, files and empty", () => {
    expect(parseYoutubeWatchUrl("https://www.loom.com/share/abc").ok).toBe(false);
    expect(parseYoutubeWatchUrl("https://cdn.example.com/demo.mp4").ok).toBe(false);
    expect(parseYoutubeWatchUrl("").ok).toBe(false);
  });
});

describe("parseGithubRepoUrl", () => {
  test("normalizes owner/repo shapes", () => {
    expect(parseGithubRepoUrl("https://github.com/HackSpain/hackspain26.git")).toEqual({
      ok: true,
      value: "https://github.com/HackSpain/hackspain26",
    });
    expect(parseGithubRepoUrl("HackSpain/hackspain26")).toEqual({
      ok: true,
      value: "https://github.com/HackSpain/hackspain26",
    });
  });

  test("rejects trees, blobs and empty", () => {
    expect(parseGithubRepoUrl("https://github.com/HackSpain/hackspain26/tree/main").ok).toBe(
      false
    );
    expect(parseGithubRepoUrl("").ok).toBe(false);
  });
});

describe("parseOptionalProductUrl", () => {
  test("allows empty and public http(s)", () => {
    expect(parseOptionalProductUrl("")).toEqual({ ok: true, value: undefined });
    expect(parseOptionalProductUrl("https://demo.hackspain.com")).toEqual({
      ok: true,
      value: "https://demo.hackspain.com/",
    });
  });

  test("rejects localhost", () => {
    expect(parseOptionalProductUrl("http://localhost:3000").ok).toBe(false);
  });
});

describe("parseProjectName", () => {
  test("trims and enforces length", () => {
    expect(parseProjectName("  ok  ")).toEqual({ ok: true, value: "ok" });
    expect(parseProjectName("x").ok).toBe(false);
  });
});
