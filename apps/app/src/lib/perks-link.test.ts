import assert from "node:assert/strict";
import { test } from "node:test";
import { linkParts } from "./perks";

test("turns http(s) URLs into href parts and keeps trailing punctuation", () => {
  assert.deepEqual(linkParts("Lee https://hackspain.com."), [
    { text: "Lee " },
    { text: "https://hackspain.com", href: "https://hackspain.com" },
    { text: "." },
  ]);
});

test("leaves plain text alone", () => {
  assert.deepEqual(linkParts("Sin enlaces"), [{ text: "Sin enlaces" }]);
});
