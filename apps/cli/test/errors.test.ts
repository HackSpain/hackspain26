import { describe, expect, test } from "bun:test";
import {
  CliError,
  EXIT,
  explainError,
  RemoteError,
  serverMessage,
  usageError,
} from "../src/lib/errors";

function convexWrapped(message: string): Error {
  return new Error(
    `[Request ID: abc123] Server Error\nUncaught Error: ${message}\n    at handler (../convex/lib/auth.ts:10:11)`
  );
}

describe("explainError", () => {
  test("passes CliError through", () => {
    const e = explainError(usageError("bad flag", "try --help"));
    expect(e).toMatchObject({
      code: "USAGE",
      hint: "try --help",
      exitCode: EXIT.USAGE,
    });
  });

  test("maps the backend gate messages to exit codes and hints", () => {
    expect(explainError(convexWrapped("No has iniciado sesión"))).toMatchObject(
      {
        code: "UNAUTHENTICATED",
        exitCode: EXIT.AUTH,
      }
    );
    expect(
      explainError(
        convexWrapped("No hay inscripción a la hackathon con este email")
      )
    ).toMatchObject({ code: "NOT_REGISTERED", exitCode: EXIT.INELIGIBLE });
    expect(explainError(convexWrapped("Aún no te han aceptado"))).toMatchObject(
      {
        code: "NOT_ACCEPTED",
        exitCode: EXIT.INELIGIBLE,
      }
    );
    expect(
      explainError(convexWrapped("Confirma tus datos primero"))
    ).toMatchObject({
      code: "NOT_ONBOARDED",
      exitCode: EXIT.INELIGIBLE,
    });
  });

  test("reads the codes the server relays from ConvexError", () => {
    const e = explainError(
      new RemoteError({
        code: "BAD_CODE",
        message: "No hay ningún equipo con ese código",
      })
    );
    expect(e.code).toBe("BAD_CODE");
    expect(e.message).toBe("No hay ningún equipo con ese código");
    expect(e.hint).toContain("team show");
    expect(
      explainError(new RemoteError({ code: "VALIDATION", message: "x" }))
        .exitCode
    ).toBe(EXIT.USAGE);
  });

  test("strips the Convex wrapper from unknown server errors", () => {
    const e = explainError(convexWrapped("El dueño no puede salir del equipo"));
    expect(e).toMatchObject({
      code: "SERVER",
      message: "El dueño no puede salir del equipo",
      exitCode: EXIT.ERROR,
    });
    expect(serverMessage("plain message")).toBe("plain message");
  });

  test("peels the nested wrapper that actions produce", () => {
    const raw =
      "[Request ID: 381004e89f672509] Server Error\nUncaught Error: Uncaught Error: Could not verify code\n    at handleEmailAndPhoneProvider (…)";
    expect(serverMessage(raw)).toBe("Could not verify code");
    expect(explainError(new Error(raw))).toMatchObject({
      code: "BAD_OTP",
      message: "That code was not accepted.",
    });
  });

  test("recognises network failures", () => {
    const err = Object.assign(new Error("fetch failed"), {
      code: "ECONNREFUSED",
    });
    expect(explainError(err)).toMatchObject({
      code: "NETWORK",
      exitCode: EXIT.NETWORK,
    });
  });

  test("CliError defaults", () => {
    const e = new CliError("x");
    expect(e.exitCode).toBe(EXIT.ERROR);
    expect(e.code).toBe("ERROR");
  });
});
