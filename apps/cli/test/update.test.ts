import { describe, expect, test } from "bun:test";
import { assetName, isNewer } from "../src/commands/update";

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
});
