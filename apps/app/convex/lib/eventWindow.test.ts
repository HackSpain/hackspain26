import { describe, expect, test } from "bun:test";
import { editionDatesLine } from "./eventWindow";

describe("editionDatesLine", () => {
  test("formats a same-month Madrid range", () => {
    expect(
      editionDatesLine(
        Date.parse("2027-03-12T10:00:00+01:00"),
        Date.parse("2027-03-14T18:00:00+01:00")
      )
    ).toBe("Madrid · 12—14 marzo 2027");
  });

  test("is undefined until both bounds exist", () => {
    expect(editionDatesLine(Date.parse("2027-03-12T10:00:00+01:00"))).toBe(
      undefined
    );
  });
});
