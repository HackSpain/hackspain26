import { test } from "node:test";
import assert from "node:assert/strict";
import { photoThumbnail } from "./photo";

test("uploaded photos are resized through the files route", () => {
	assert.equal(photoThumbnail("/api/files/abc"), "/api/files/abc?w=128");
	assert.equal(photoThumbnail("/api/files/abc?w=512", 64), "/api/files/abc?w=64");
});

test("GitHub avatars take their own size parameter", () => {
	assert.equal(
		photoThumbnail("https://avatars.githubusercontent.com/u/1?v=4"),
		"https://avatars.githubusercontent.com/u/1?v=4&s=128",
	);
});

test("other hosts and odd values pass through untouched", () => {
	assert.equal(photoThumbnail("https://example.com/a.png"), "https://example.com/a.png");
	assert.equal(photoThumbnail("not a url"), "not a url");
});
