import { test } from "node:test";
import assert from "node:assert/strict";
import type { Id } from "../_generated/dataModel";
import { avatarThumbnailFor, externalThumbnail } from "./photo";

const avatarId = "kg2avatar" as Id<"_storage">;
const thumbId = "kg2thumb" as Id<"_storage">;

test("an uploaded thumbnail wins, then the resizing route, then GitHub", () => {
  assert.equal(
    avatarThumbnailFor({ avatarId, avatarThumbId: thumbId, image: "x" }),
    "/api/files/kg2thumb"
  );
  assert.equal(
    avatarThumbnailFor({ avatarId, image: "x" }),
    "/api/files/kg2avatar?w=128"
  );
  assert.equal(
    avatarThumbnailFor({ image: "https://avatars.githubusercontent.com/u/1?v=4" }),
    "https://avatars.githubusercontent.com/u/1?v=4&s=128"
  );
  assert.equal(avatarThumbnailFor({}), undefined);
});

test("other hosts and odd values pass through untouched", () => {
  assert.equal(externalThumbnail("https://example.com/a.png"), "https://example.com/a.png");
  assert.equal(externalThumbnail("not a url"), "not a url");
});
