import { test } from "node:test";
import assert from "node:assert/strict";
import type { Id } from "../_generated/dataModel";
import {
  avatarThumbnailFor,
  avatarUrlFor,
  externalThumbnail,
  hasUploadedAvatar,
  isVercelBlobUrl,
  storedBlobUrls,
} from "./photo";

const avatarId = "kg2avatar" as Id<"_storage">;
const thumbId = "kg2thumb" as Id<"_storage">;
const blobUrl = "https://abc.public.blob.vercel-storage.com/avatars/u/photo";
const thumbBlobUrl = "https://abc.public.blob.vercel-storage.com/avatars/u/thumb";

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

test("a Vercel Blob upload wins over a legacy Convex file", () => {
  assert.equal(
    avatarUrlFor({ avatarBlobUrl: blobUrl, avatarId, image: "x" }),
    blobUrl
  );
  assert.equal(avatarUrlFor({ avatarId, image: "x" }), "/api/files/kg2avatar");
  assert.equal(
    avatarThumbnailFor({
      avatarBlobUrl: blobUrl,
      avatarId,
      avatarThumbBlobUrl: thumbBlobUrl,
      avatarThumbId: thumbId,
      image: "x",
    }),
    thumbBlobUrl
  );
  assert.equal(
    avatarThumbnailFor({ avatarBlobUrl: blobUrl, avatarId, image: "x" }),
    blobUrl
  );
});

test("other hosts and odd values pass through untouched", () => {
  assert.equal(externalThumbnail("https://example.com/a.png"), "https://example.com/a.png");
  assert.equal(externalThumbnail("not a url"), "not a url");
});

test("only https Vercel Blob hosts count as blob uploads", () => {
  assert.equal(isVercelBlobUrl(blobUrl), true);
  assert.equal(isVercelBlobUrl("https://blob.vercel-storage.com/x"), true);
  assert.equal(isVercelBlobUrl("http://abc.public.blob.vercel-storage.com/x"), false);
  assert.equal(
    isVercelBlobUrl("https://evil.com.blob.vercel-storage.com.attacker/x"),
    false
  );
  assert.equal(isVercelBlobUrl("https://example.com/photo.png"), false);
  assert.equal(isVercelBlobUrl("not a url"), false);
});

test("hasUploadedAvatar treats Blob and Convex ids as a photo", () => {
  assert.equal(hasUploadedAvatar({ avatarBlobUrl: blobUrl }), true);
  assert.equal(hasUploadedAvatar({ avatarId }), true);
  assert.equal(hasUploadedAvatar({}), false);
});

test("storedBlobUrls skips a duplicate thumb", () => {
  assert.deepEqual(storedBlobUrls({ avatarBlobUrl: blobUrl, avatarThumbBlobUrl: thumbBlobUrl }), [
    blobUrl,
    thumbBlobUrl,
  ]);
  assert.deepEqual(storedBlobUrls({ avatarBlobUrl: blobUrl, avatarThumbBlobUrl: blobUrl }), [
    blobUrl,
  ]);
});
