import { describe, expect, test } from "bun:test";
import type { Submission, Track } from "../src/lib/participant";
import { planTracks, projectArgsFrom } from "../src/lib/project";

type Id = Track["_id"];
const id = (s: string) => s as Id;

const tracks: Track[] = [
  {
    _id: id("t1"),
    active: true,
    body: "",
    label: "Maisa",
    note: "",
    slug: "maisa",
    sortOrder: 1,
  },
  {
    _id: id("t2"),
    active: true,
    body: "",
    label: "Embat",
    note: "",
    slug: "embat",
    sortOrder: 2,
  },
  {
    _id: id("t3"),
    active: true,
    body: "",
    label: "THEKER",
    note: "",
    slug: "theker",
    sortOrder: 3,
  },
];

describe("planTracks", () => {
  test("register adds in catalogue order and ignores duplicates", () => {
    const plan = planTracks([id("t3")], tracks, { add: ["MAISA", "theker"] });
    expect(plan.next).toEqual([id("t1"), id("t3")]);
    expect(plan.added.map((t) => t.slug)).toEqual(["maisa"]);
    expect(plan.unknown).toEqual([]);
  });

  test("unregister removes only what was there", () => {
    const plan = planTracks([id("t1"), id("t2")], tracks, {
      remove: ["embat", "theker"],
    });
    expect(plan.next).toEqual([id("t1")]);
    expect(plan.removed.map((t) => t.slug)).toEqual(["embat"]);
  });

  test("move swaps one for another", () => {
    const plan = planTracks([id("t1")], tracks, {
      add: ["embat"],
      remove: ["maisa"],
    });
    expect(plan.next).toEqual([id("t2")]);
  });

  test("reports unknown slugs instead of dropping them", () => {
    const plan = planTracks([], tracks, { add: ["nope", "maisa"] });
    expect(plan.unknown).toEqual(["nope"]);
    expect(plan.next).toEqual([id("t1")]);
  });
});

describe("projectArgsFrom", () => {
  test("empty draft when nothing exists", () => {
    expect(projectArgsFrom(null)).toEqual({
      challengeIds: [],
      demoUrl: undefined,
      description: "",
      name: "",
      perkIds: [],
      repoUrl: undefined,
    });
  });

  test("lifts repo/demo out of the url entries", () => {
    const submission = {
      challengeIds: [id("t1")],
      description: "d",
      name: "AgentOS",
      perkIds: [],
      urls: [
        { kind: "repo", url: "https://github.com/a/b" },
        { kind: "demo", url: "https://demo" },
      ],
    } as unknown as Submission;
    expect(projectArgsFrom(submission)).toMatchObject({
      challengeIds: [id("t1")],
      demoUrl: "https://demo",
      name: "AgentOS",
      repoUrl: "https://github.com/a/b",
    });
  });
});
