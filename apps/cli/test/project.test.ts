import { describe, expect, test } from "bun:test";
import type { Submission, Track } from "../src/lib/participant";
import { planTracks, projectArgsFrom } from "../src/lib/project";

type Id = Track["_id"];
const id = (s: string) => s as Id;

const tracks: Track[] = [
  {
    _id: id("t1"),
    slug: "maisa",
    label: "Maisa",
    body: "",
    note: "",
    sortOrder: 1,
    active: true,
  },
  {
    _id: id("t2"),
    slug: "embat",
    label: "Embat",
    body: "",
    note: "",
    sortOrder: 2,
    active: true,
  },
  {
    _id: id("t3"),
    slug: "theker",
    label: "THEKER",
    body: "",
    note: "",
    sortOrder: 3,
    active: true,
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
      remove: ["maisa"],
      add: ["embat"],
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
      name: "",
      description: "",
      repoUrl: undefined,
      demoUrl: undefined,
      challengeIds: [],
      perkIds: [],
    });
  });

  test("lifts repo/demo out of the url entries", () => {
    const submission = {
      name: "AgentOS",
      description: "d",
      urls: [
        { kind: "repo", url: "https://github.com/a/b" },
        { kind: "demo", url: "https://demo" },
      ],
      challengeIds: [id("t1")],
      perkIds: [],
    } as unknown as Submission;
    expect(projectArgsFrom(submission)).toMatchObject({
      name: "AgentOS",
      repoUrl: "https://github.com/a/b",
      demoUrl: "https://demo",
      challengeIds: [id("t1")],
    });
  });
});
