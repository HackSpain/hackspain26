import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_REEL, demoMemes, freshMemes, memeAge, memeCaption, reelAdvance, reelArrive } from "./tv-memes";
import type { TvMeme } from "./tv-memes";

const meme = (id: string, createdAt: number): TvMeme => ({ _id: id, authorName: id, createdAt, teamName: "", text: `${id} #meme` });

test("only memes posted after the previous snapshot are new", () => {
  const before = [meme("c", 30), meme("b", 20)];
  assert.deepEqual(freshMemes(undefined, before), []);
  assert.deepEqual(freshMemes(before, [meme("e", 50), meme("d", 40), ...before]).map((row) => row._id), ["d", "e"]);
  // c is deleted and a slides back into the window: old, so not news.
  assert.deepEqual(freshMemes(before, [meme("b", 20), meme("a", 10)]), []);
});

test("the rotation walks the wall newest first and wraps around", () => {
  const memes = [meme("c", 30), meme("b", 20), meme("a", 10)];
  let reel = reelArrive(EMPTY_REEL, undefined, memes);
  assert.deepEqual([reel.currentId, reel.fresh], ["c", false]);
  reel = reelAdvance(reelAdvance(reel, memes), memes);
  assert.equal(reel.currentId, "a");
  assert.equal(reelAdvance(reel, memes).currentId, "c");
  assert.equal(reelAdvance(EMPTY_REEL, []).currentId, null);
});

test("a new meme cuts into the rotation, and a second one waits for the first", () => {
  const first = [meme("b", 20), meme("a", 10)];
  const second = [meme("c", 30), ...first];
  const third = [meme("d", 40), ...second];
  let reel = reelArrive(EMPTY_REEL, undefined, first);
  reel = reelArrive(reel, first, second);
  assert.deepEqual([reel.currentId, reel.fresh, reel.queue], ["c", true, []]);
  reel = reelArrive(reel, second, third);
  assert.deepEqual([reel.currentId, reel.fresh, reel.queue], ["c", true, ["d"]]);
  reel = reelAdvance(reel, third);
  assert.deepEqual([reel.currentId, reel.fresh, reel.queue], ["d", true, []]);
  // Back to the rotation, carrying on from the meme that was just on.
  assert.deepEqual([reelAdvance(reel, third).currentId, reelAdvance(reel, third).fresh], ["c", false]);
});

test("a deleted meme leaves the big cell and the queue", () => {
  const memes = [meme("c", 30), meme("b", 20), meme("a", 10)];
  const reel = reelArrive(EMPTY_REEL, undefined, memes);
  assert.equal(reelArrive(reel, memes, memes.slice(1)).currentId, "b");
  assert.equal(reelAdvance({ ...reel, queue: ["gone"] }, memes).currentId, "b");
});

test("captions lose the meme hashtag and nothing else", () => {
  assert.equal(memeCaption("Cuando el mentor pregunta por los tests #memes"), "Cuando el mentor pregunta por los tests");
  assert.equal(memeCaption("#meme git blame miente #git"), "git blame miente #git");
  assert.equal(memeCaption("#memento mori"), "#memento mori");
  assert.equal(memeCaption("#meme"), "");
});

test("ages read in minutes, hours and days", () => {
  assert.equal(memeAge(1000, 1000 + 20_000), "ahora");
  assert.equal(memeAge(0, 5 * 60_000), "hace 5 min");
  assert.equal(memeAge(0, 3 * 3_600_000), "hace 3 h");
  assert.equal(memeAge(0, 50 * 3_600_000), "hace 2 d");
});

test("the demo posts one new meme per step and starts over", () => {
  const at = (step: number) => demoMemes(step, 1_000_000, 8000);
  assert.deepEqual(freshMemes(at(0), at(1)).map((row) => row._id), ["demo-meme-4"]);
  assert.equal(at(1)[0]._id, "demo-meme-4");
  assert.equal(at(6).length, 10);
  assert.equal(at(7).length, 4);
  assert.deepEqual(freshMemes(at(7), at(8)).map((row) => row._id), ["demo-meme-4"]);
  assert.ok(at(8)[0].createdAt > at(6)[0].createdAt);
});
