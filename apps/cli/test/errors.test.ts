import { describe, expect, test } from "bun:test";
import {
  CliError,
  EXIT,
  explainError,
  RemoteError,
  serverMessage,
  terminalExplained,
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
      exitCode: EXIT.USAGE,
      hint: "try --help",
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

  test("TRACK_FULL tells you to pick another track", () => {
    const e = explainError(
      new RemoteError({
        code: "TRACK_FULL",
        message: "Maisa ya tiene 15 equipos. Únete a otro track.",
      })
    );
    expect(e.code).toBe("TRACK_FULL");
    expect(e.exitCode).toBe(EXIT.ERROR);
    expect(e.message).toBe(
      "That track already has 15 teams. Join a different one."
    );
    expect(e.hint).toContain("track register");
  });

  test("EVENT_CLOSED is ineligible and gets English copy plus the profile hint", () => {
    const e = explainError(
      new RemoteError({
        code: "EVENT_CLOSED",
        message:
          "La hackathon terminó el sábado. Solo puedes editar tu perfil.",
      })
    );
    expect(e.code).toBe("EVENT_CLOSED");
    expect(e.exitCode).toBe(EXIT.INELIGIBLE);
    expect(e.message).toBe("The hackathon is not running right now.");
    expect(e.hint).toContain("hackspain profile");
  });

  test("email OTP codes get English copy and a hint", () => {
    const unregistered = explainError(
      new RemoteError({
        code: "UNREGISTERED",
        message: "No hay inscripción a la hackathon con este email",
      })
    );
    expect(unregistered.exitCode).toBe(EXIT.INELIGIBLE);
    expect(unregistered.message).toBe("This email has no HackSpain signup.");
    expect(unregistered.hint).toContain("contact the organisers");

    for (const code of [
      "BAD_OTP",
      "OTP_EXPIRED",
      "TOO_MANY_ATTEMPTS",
      "SEND_FAILED",
    ]) {
      const e = explainError(new RemoteError({ code, message: "es" }));
      expect(e.code).toBe(code);
      expect(e.exitCode).toBe(EXIT.ERROR);
      expect(e.message).not.toBe("es");
      expect(e.hint).toBeTruthy();
    }
  });

  test("terminalExplained cleans the server copy the terminal will style", () => {
    const explained = explainError(
      new RemoteError({
        code: "NOT_FOUND",
        message: "No existe el equipo Quijote\u001B]52;c;ZXZpbA==\u0007 Labs",
      })
    );
    expect(explained.message).toContain("\u001B]52");
    const shown = terminalExplained({ ...explained, hint: "x\u001B[2Jy\r" });
    expect(shown.message).toBe("No existe el equipo Quijote Labs");
    expect(shown.hint).toBe("xy");
    expect(shown.code).toBe("NOT_FOUND");
    expect(shown.exitCode).toBe(EXIT.ERROR);
    expect(terminalExplained(explained).hint).toBeUndefined();
  });

  test("strips the Convex wrapper from unknown server errors", () => {
    const e = explainError(convexWrapped("El dueño no puede salir del equipo"));
    expect(e).toMatchObject({
      code: "SERVER",
      exitCode: EXIT.ERROR,
      message: "El dueño no puede salir del equipo",
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
