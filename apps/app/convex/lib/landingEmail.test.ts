import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptEmailText, reviewEmailText } from "./landingEmail";

test("review and accept emails name the edition and role", () => {
  const review = reviewEmailText({
    editionLabel: "HackSpain 2027",
    fullName: "Ada Lovelace",
    origin: "https://hackspain.com",
    roleLabel: "Hacker",
  });
  assert.match(review, /Hola Ada/);
  assert.match(review, /HackSpain 2027/);
  assert.match(review, /Hacker/);
  const accept = acceptEmailText({
    confirmUrl: "https://hackspain.com/confirmacion?token=t",
    editionLabel: "HackSpain 2027",
    fullName: "Ada Lovelace",
    requiresConfirmed: true,
  });
  assert.match(accept, /Tienes plaza/);
  assert.match(accept, /confirmacion\?token=t/);
});
