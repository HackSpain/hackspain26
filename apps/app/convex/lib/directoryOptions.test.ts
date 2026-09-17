import { describe, expect, test } from "bun:test";
import { parseDirectoryCard } from "./directory";
import {
  canonical,
  canonicalTags,
  CITY_OPTIONS,
  INTEREST_OPTIONS,
  ROLE_OPTIONS,
  SKILL_GROUPS,
  SKILL_OPTIONS,
  UNIVERSITY_OPTIONS,
} from "./directoryOptions";

describe("canonical", () => {
  test("matches accents, case and English names", () => {
    expect(canonical(UNIVERSITY_OPTIONS, "UPM")).toBe(
      "Universidad Politécnica de Madrid"
    );
    expect(canonical(UNIVERSITY_OPTIONS, "technical university of madrid")).toBe(
      "Universidad Politécnica de Madrid"
    );
    expect(canonical(UNIVERSITY_OPTIONS, "universidad politecnica de madrid.")).toBe(
      "Universidad Politécnica de Madrid"
    );
    expect(canonical(CITY_OPTIONS, "Seville")).toBe("Sevilla");
    expect(canonical(CITY_OPTIONS, "san sebastián")).toBe(
      "Donostia / San Sebastián"
    );
    expect(canonical(ROLE_OPTIONS, "fullstack")).toBe("Full-stack Developer");
  });

  test("unknown text is not matched", () => {
    expect(canonical(UNIVERSITY_OPTIONS, "MIT")).toBeUndefined();
    expect(canonical(SKILL_OPTIONS, "")).toBeUndefined();
  });

  test("no two options share a spelling", () => {
    for (const list of [ROLE_OPTIONS, CITY_OPTIONS, UNIVERSITY_OPTIONS, SKILL_OPTIONS, INTEREST_OPTIONS]) {
      const seen = new Map<string, string>();
      for (const option of list) {
        for (const key of [option.value, ...(option.aliases ?? [])]) {
          const folded = key.normalize("NFD").replaceAll(/[̀-ͯ]/g, "").toLowerCase();
          const owner = seen.get(folded);
          expect(owner === undefined || owner === option.value, `${key} in ${owner} and ${option.value}`).toBe(true);
          seen.set(folded, option.value);
        }
      }
    }
    expect(SKILL_GROUPS.length).toBeGreaterThan(3);
  });
});

describe("canonicalTags", () => {
  test("folds aliases and drops duplicates that fold together", () => {
    expect(canonicalTags(SKILL_OPTIONS, ["ReactJS", "react", "JS", "OpenCV", "yolo", "Cobol"])).toEqual([
      "React",
      "JavaScript",
      "Computer Vision",
      "Cobol",
    ]);
  });
});

describe("parseDirectoryCard", () => {
  test("stores the curated spellings", () => {
    const card = parseDirectoryCard({
      city: "bilbo",
      interests: "agents, Open Source",
      role: "backend",
      skills: ["golang", "k8s"],
      university: "EHU",
    });
    expect(card).toMatchObject({
      city: "Bilbao",
      interests: ["Agentes IA", "Open source"],
      role: "Backend Developer",
      skills: ["Go", "Kubernetes"],
      university: "Universidad del País Vasco",
    });
  });
});
