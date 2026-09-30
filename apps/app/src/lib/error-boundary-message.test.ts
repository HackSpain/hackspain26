import assert from "node:assert/strict";
import { test } from "node:test";
import { ConvexError } from "convex/values";
import { errorBoundaryMessage } from "./error-boundary-message";

const fallback = "Ha ocurrido un error inesperado.";

test("shows only a coded domain error's user-facing message", () => {
  const error = new ConvexError({
    code: "VALIDATION",
    message: "Revisa el formulario.",
  });
  assert.equal(errorBoundaryMessage(error), "Revisa el formulario.");
});

test("hides unexpected, uncoded, malformed and server errors", () => {
  const unexpected = new Error("DATABASE_URL=secret");
  const uncoded = new ConvexError("internal query failure");
  const unknownCode = new ConvexError({
    code: "INTERNAL",
    message: "database details",
  });
  const malformed = new ConvexError({ code: "VALIDATION", message: 123 });
  const server = Object.assign(
    new ConvexError({ code: "VALIDATION", message: "database details" }),
    { digest: "next-digest" }
  );

  for (const error of [unexpected, uncoded, unknownCode, malformed, server]) {
    assert.equal(errorBoundaryMessage(error), fallback);
  }
});
