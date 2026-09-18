import { describe, expect, test } from "bun:test";
import type { Id } from "../_generated/dataModel";
import type { DirectoryCard } from "./directory";
import { isProfileComplete, missingProfileFields } from "./profile";

const card: DirectoryCard = {
  city: "Madrid",
  interests: ["Open source"],
  role: "Backend",
  skills: ["Go"],
  university: "UPM",
  updatedAt: 0,
};

const complete = {
  avatarId: undefined,
  directory: card,
  image: "https://avatars.githubusercontent.com/u/1",
  name: "Ana",
};

describe("missingProfileFields", () => {
  test("a GitHub avatar counts as the photo", () => {
    expect(missingProfileFields(complete)).toEqual([]);
    expect(isProfileComplete(complete)).toBe(true);
  });

  test("an uploaded avatar counts as the photo", () => {
    expect(
      missingProfileFields({
        ...complete,
        avatarId: "st_1" as Id<"_storage">,
        image: undefined,
      })
    ).toEqual([]);
  });

  test("a Vercel Blob avatar counts as the photo", () => {
    expect(
      missingProfileFields({
        ...complete,
        avatarBlobUrl: "https://abc.public.blob.vercel-storage.com/avatars/u/photo",
        image: undefined,
      })
    ).toEqual([]);
  });

  test("blank name and no picture are both missing", () => {
    expect(
      missingProfileFields({ ...complete, image: "  ", name: "   " })
    ).toEqual(["name", "photo"]);
  });

  test("an incomplete card is reported as the directory", () => {
    expect(
      missingProfileFields({
        ...complete,
        directory: { ...card, skills: [] },
      })
    ).toEqual(["directory"]);
    expect(missingProfileFields({ ...complete, directory: undefined })).toEqual([
      "directory",
    ]);
  });
});
