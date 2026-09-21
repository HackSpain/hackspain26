import assert from "node:assert/strict";
import { test } from "node:test";
import { directoryCsv, directoryCsvFileName } from "./export";
import type { DirectoryParticipant } from "./types";

const ana: DirectoryParticipant = {
  achievements: 'Won "best demo"',
  bio: "Hace cosas",
  city: "Madrid",
  company: "Acme, Inc.",
  degree: "Informática",
  displayName: "Ana Pérez",
  email: "ana@example.com",
  freeTime: "Bici",
  githubUsername: "ana",
  id: "u1",
  interests: ["IA", "Clima"],
  project: {
    description: "App",
    id: "p1",
    name: "Nube",
    techStack: ["TS"],
    urls: [
      { kind: "repo", url: "https://github.com/ana/nube" },
      { kind: "demo", url: "https://nube.app" },
    ],
  },
  role: "Developer",
  skills: ["React", "TS"],
  team: { id: "t1", name: "Equipo 1" },
  tracks: [{ id: "c1", label: "Build", slug: "build" }],
  university: "UPM",
  urls: [
    { kind: "linkedin", url: "https://linkedin.com/in/anaperez" },
    { kind: "x", url: "https://x.com/ana" },
    { kind: "web", url: "https://ana.dev" },
  ],
};

test("csv has every directory field, BOM, and quotes commas", () => {
  const csv = directoryCsv([ana]);
  const [, row] = csv.slice(1).split("\r\n");
  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.equal(
    row,
    'u1,ana@example.com,Ana Pérez,Developer,Madrid,UPM,"Acme, Inc.",Informática,Hace cosas,React; TS,IA; Clima,Equipo 1,Nube,Build,ana,https://linkedin.com/in/anaperez,https://x.com/ana,https://ana.dev,"Won ""best demo""",Bici,https://github.com/ana/nube,https://nube.app,',
  );
});

test("file name is dated", () => {
  assert.match(
    directoryCsvFileName(new Date("2026-09-21T12:00:00Z")),
    /^hackspain-participantes-\d{8}-\d{4}\.csv$/,
  );
});
