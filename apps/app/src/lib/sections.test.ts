import { describe, expect, test } from "bun:test";
import {
  isPathAllowedWhenClosed,
  JUDGING_PATH,
  JUDGING_SPONSORS_PATH,
} from "./sections";

describe("isPathAllowedWhenClosed", () => {
  test("keeps home, profile, directory, perks and insights", () => {
    expect(isPathAllowedWhenClosed("/")).toBe(true);
    expect(isPathAllowedWhenClosed("/profile")).toBe(true);
    expect(isPathAllowedWhenClosed("/participantes")).toBe(true);
    expect(isPathAllowedWhenClosed("/perks")).toBe(true);
    expect(isPathAllowedWhenClosed("/insights")).toBe(true);
  });

  test("keeps judging after the hackathon window closes", () => {
    expect(isPathAllowedWhenClosed(JUDGING_PATH)).toBe(true);
    expect(isPathAllowedWhenClosed(`${JUDGING_PATH}/grupo-1`)).toBe(true);
    expect(isPathAllowedWhenClosed(JUDGING_SPONSORS_PATH)).toBe(true);
  });

  test("still gates live participant surfaces", () => {
    expect(isPathAllowedWhenClosed("/tracks")).toBe(false);
    expect(isPathAllowedWhenClosed("/teams")).toBe(false);
    expect(isPathAllowedWhenClosed("/feed")).toBe(false);
    expect(isPathAllowedWhenClosed("/submit")).toBe(false);
  });

  test("judges keep challenge briefs when the window is closed", () => {
    expect(isPathAllowedWhenClosed("/tracks", true)).toBe(true);
    expect(isPathAllowedWhenClosed("/tracks/maisa", true)).toBe(true);
    expect(isPathAllowedWhenClosed("/teams", true)).toBe(false);
  });
});
