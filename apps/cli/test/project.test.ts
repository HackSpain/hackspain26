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
    logoUrl: "/tracks/maisa.png",
    markdown: undefined,
    note: "",
    slug: "maisa",
    sortOrder: 1,
    teamCount: 0,
    teamLimit: 15,
    website: "https://maisa.ai",
  },
  {
    _id: id("t2"),
    active: true,
    body: "",
    label: "Embat",
    logoUrl: undefined,
    markdown: undefined,
    note: "",
    slug: "embat",
    sortOrder: 2,
    teamCount: 0,
    teamLimit: 15,
    website: undefined,
  },
  {
    _id: id("t3"),
    active: true,
    body: "",
    label: "THEKER",
    logoUrl: undefined,
    markdown: undefined,
    note: "",
    slug: "theker",
    sortOrder: 3,
    teamCount: 0,
    teamLimit: 15,
    website: undefined,
  },
];

describe("planTracks", () => {
  test("register uses only the first slug and replaces the rest", () => {
    const plan = planTracks([id("t3")], tracks, { add: ["MAISA", "embat"] });
    expect(plan.next).toEqual([id("t1")]);
    expect(plan.added.map((t) => t.slug)).toEqual(["maisa"]);
    expect(plan.removed.map((t) => t.slug)).toEqual(["theker"]);
    expect(plan.unknown).toEqual([]);
  });

  test("register of the same track still drops extras already stored", () => {
    const plan = planTracks([id("t1"), id("t2")], tracks, { add: ["maisa"] });
    expect(plan.next).toEqual([id("t1")]);
    expect(plan.added).toEqual([]);
    expect(plan.removed.map((t) => t.slug)).toEqual(["embat"]);
  });

  test("unregister clears the track", () => {
    const plan = planTracks([id("t1"), id("t2")], tracks, {
      remove: ["embat"],
    });
    expect(plan.next).toEqual([]);
    expect(plan.removed.map((t) => t.slug)).toEqual(["embat"]);
  });

  test("reports unknown slugs instead of dropping them", () => {
    const plan = planTracks([], tracks, { add: ["nope", "maisa"] });
    expect(plan.unknown).toEqual(["nope"]);
    expect(plan.next).toEqual([]);
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
      videoUrl: undefined,
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
