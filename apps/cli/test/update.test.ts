import { describe, expect, test } from "bun:test";
import {
  assetName,
  isNewer,
  shouldAutoUpdate,
  tagFromReleaseAssetUrl,
} from "../src/commands/update";

describe("update", () => {
  test("asset names match the release matrix", () => {
    expect(assetName("linux", "x64")).toBe("hackspain-linux-x64");
    expect(assetName("darwin", "arm64")).toBe("hackspain-darwin-arm64");
    expect(assetName("win32", "x64")).toBe("hackspain-windows-x64.exe");
    expect(() => assetName("freebsd", "x64")).toThrow("No prebuilt binary");
    expect(() => assetName("linux", "ia32")).toThrow("No prebuilt binary");
  });

  test("version comparison", () => {
    expect(isNewer("0.2.0", "0.1.0")).toBe(true);
    expect(isNewer("cli-v1.0.0", "0.9.9")).toBe(true);
    expect(isNewer("0.1.0", "0.1.0")).toBe(false);
    expect(isNewer("0.1.0", "0.1.1")).toBe(false);
    expect(isNewer("0.1", "0.1.0")).toBe(false);
  });

  test("release tag comes from GitHub's redirected checksum URL", () => {
    expect(
      tagFromReleaseAssetUrl(
        "https://github.com/HackSpain/hackspain26/releases/download/cli-v0.5.3/SHA256SUMS"
      )
    ).toBe("cli-v0.5.3");
    expect(
      tagFromReleaseAssetUrl(
        "https://example.com/releases/download/cli-v9.9.9/SHA256SUMS"
      )
    ).toBeUndefined();
  });

  test("automatic updates are cached and stay out of scripts", () => {
    const base = {
      args: ["watch"],
      current: "0.5.3",
      interactive: true,
      now: 7 * 60 * 60 * 1000,
    };
    expect(shouldAutoUpdate(base)).toBe(true);
    expect(shouldAutoUpdate({ ...base, interactive: false })).toBe(false);
    expect(shouldAutoUpdate({ ...base, args: ["--json", "watch"] })).toBe(
      false
    );
    expect(shouldAutoUpdate({ ...base, args: ["update"] })).toBe(false);
    expect(shouldAutoUpdate({ ...base, current: "0.0.0-dev" })).toBe(false);
    expect(shouldAutoUpdate({ ...base, optedOut: true })).toBe(false);
    expect(
      shouldAutoUpdate({ ...base, lastCheckedAt: 2 * 60 * 60 * 1000 })
    ).toBe(false);
    expect(
      shouldAutoUpdate({ ...base, lastCheckedAt: 8 * 60 * 60 * 1000 })
    ).toBe(true);
  });
});
