import { describe, expect, test } from "bun:test";
import {
  PEOPLE_ATTENDANCE,
  PEOPLE_PAGE,
  PEOPLE_Q,
  PEOPLE_ROLE,
  PEOPLE_STATUS,
  peopleFiltersFrom,
  writePeopleFilter,
} from "./people-url";

describe("peopleFiltersFrom", () => {
  test("defaults missing params", () => {
    expect(peopleFiltersFrom(new URLSearchParams())).toEqual({
      attendance: "all",
      page: 1,
      q: "",
      role: "all",
      status: "all",
    });
  });

  test("reads q, role, status, attendance and page", () => {
    const params = new URLSearchParams(
      "q=ana&role=none&status=waitlist&attendance=attending&page=3"
    );
    expect(peopleFiltersFrom(params)).toEqual({
      attendance: "attending",
      page: 3,
      q: "ana",
      role: "none",
      status: "waitlist",
    });
  });
});

describe("writePeopleFilter", () => {
  test("drops all/empty/page 1 and resets page on other keys", () => {
    const params = new URLSearchParams("q=ana&page=2");
    const cleared = writePeopleFilter(params, PEOPLE_Q, "");
    expect(cleared.get(PEOPLE_Q)).toBe(null);
    expect(cleared.get(PEOPLE_PAGE)).toBe(null);
    const next = writePeopleFilter(params, PEOPLE_STATUS, "accepted");
    expect(next.get(PEOPLE_STATUS)).toBe("accepted");
    expect(next.get(PEOPLE_PAGE)).toBe(null);
    const paged = writePeopleFilter(params, PEOPLE_PAGE, "4");
    expect(paged.get(PEOPLE_PAGE)).toBe("4");
    expect(
      writePeopleFilter(params, PEOPLE_ATTENDANCE, "all").get(PEOPLE_ATTENDANCE)
    ).toBe(null);
    expect(
      writePeopleFilter(params, PEOPLE_ROLE, "none").get(PEOPLE_ROLE)
    ).toBe("none");
  });
});
