import { describe, expect, spyOn, test } from "bun:test";
import { ConvexError } from "convex/values";
import { fromError } from "./respond";

describe("CLI API errors", () => {
  test("returns a known coded domain error to the client", async () => {
    const response = fromError(
      new ConvexError({ code: "BAD_CODE", message: "Código no válido" })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        data: { code: "BAD_CODE", message: "Código no válido" },
        kind: "convex",
      },
      ok: false,
    });
  });

  test("does not return unexpected error details", async () => {
    const log = spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const error of [
        new Error("database password is private"),
        new ConvexError({ code: "UNKNOWN", message: "private detail" }),
      ]) {
        const response = fromError(error);
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({
          error: { kind: "error", message: "Server error. Try again later." },
          ok: false,
        });
      }
    } finally {
      log.mockRestore();
    }
  });

  test("preserves known legacy domain copy but rejects added details", async () => {
    const domain = fromError(new Error("El dueño no puede salir del equipo"));
    expect(domain.status).toBe(500);
    expect(await domain.json()).toEqual({
      error: { kind: "error", message: "El dueño no puede salir del equipo" },
      ok: false,
    });

    const log = spyOn(console, "error").mockImplementation(() => {});
    try {
      const unexpected = fromError(
        new Error("El dueño no puede salir del equipo: private detail")
      );
      expect(unexpected.status).toBe(500);
      expect(await unexpected.json()).toEqual({
        error: { kind: "error", message: "Server error. Try again later." },
        ok: false,
      });
    } finally {
      log.mockRestore();
    }
  });

  test("keeps authentication failures at 401 without returning token details", async () => {
    const response = fromError(new Error("Invalid token: private-token-value"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { kind: "error", message: "No has iniciado sesión" },
      ok: false,
    });
  });
});
