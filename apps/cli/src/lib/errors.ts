export const EXIT = {
  AUTH: 3,
  ERROR: 1,
  INELIGIBLE: 4,
  INTERRUPTED: 130,
  NETWORK: 5,
  OK: 0,
  USAGE: 2,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export type Explained = {
  code: string;
  message: string;
  hint?: string;
  exitCode: ExitCode;
};

export class CliError extends Error {
  readonly code: string;
  readonly hint?: string;
  readonly exitCode: ExitCode;

  constructor(
    message: string,
    options: { code?: string; hint?: string; exitCode?: ExitCode } = {}
  ) {
    super(message);
    this.name = "CliError";
    this.code = options.code ?? "ERROR";
    this.hint = options.hint;
    this.exitCode = options.exitCode ?? EXIT.ERROR;
  }
}

/** A ConvexError relayed by the server: `data` is `{ code, message }` from convex/lib/errors.ts. */
export class RemoteError extends Error {
  readonly data: unknown;

  constructor(data: unknown) {
    const record = data as { message?: unknown } | null;
    super(
      typeof record?.message === "string"
        ? record.message
        : JSON.stringify(data)
    );
    this.name = "RemoteError";
    this.data = data;
  }
}

export function usageError(message: string, hint?: string): CliError {
  return new CliError(message, { code: "USAGE", exitCode: EXIT.USAGE, hint });
}

export function authError(
  message = "You are not logged in.",
  hint = "Run `hackspain auth login`."
): CliError {
  return new CliError(message, {
    code: "UNAUTHENTICATED",
    exitCode: EXIT.AUTH,
    hint,
  });
}

/**
 * The backend's gate helpers throw plain `Error` with Spanish copy (the web
 * renders `err.message` directly). Convex wraps them as
 * "[Request ID: …] Server Error\nUncaught Error: <message>", so substring
 * matching is the only option. Keep these in sync with convex/lib/auth.ts.
 */
const GATE_MESSAGES: {
  needle: string;
  explained: Omit<Explained, "message"> & { message: string };
}[] = [
  {
    explained: {
      code: "UNAUTHENTICATED",
      exitCode: EXIT.AUTH,
      hint: "Run `hackspain auth login`.",
      message: "You are not logged in.",
    },
    needle: "No has iniciado sesión",
  },
  {
    explained: {
      code: "UNAUTHENTICATED",
      exitCode: EXIT.AUTH,
      hint: "Run `hackspain auth login` again.",
      message: "Your session points at a user that no longer exists.",
    },
    needle: "Usuario no encontrado",
  },
  {
    explained: {
      code: "NOT_REGISTERED",
      exitCode: EXIT.INELIGIBLE,
      hint: "Log in with the email you applied with, or sign up at https://hackspain.com/signup.",
      message: "This email has no HackSpain signup.",
    },
    needle: "No hay inscripción a la hackathon con este email",
  },
  {
    explained: {
      code: "NOT_ACCEPTED",
      exitCode: EXIT.INELIGIBLE,
      hint: "You will get an email when it is. Check the dashboard for status.",
      message: "Your application has not been accepted yet.",
    },
    needle: "Aún no te han aceptado",
  },
  {
    explained: {
      code: "NOT_ONBOARDED",
      exitCode: EXIT.INELIGIBLE,
      hint: "Finish onboarding in the dashboard, then retry.",
      message: "You still need to confirm your details.",
    },
    needle: "Confirma tus datos primero",
  },
  {
    explained: {
      code: "NOT_ADMIN",
      exitCode: EXIT.INELIGIBLE,
      message: "This action needs an organiser account.",
    },
    needle: "Se necesita acceso de admin",
  },
  {
    // @convex-dev/auth, wrong or expired one-time code.
    needle: "Could not verify code",
    explained: {
      code: "BAD_OTP",
      exitCode: EXIT.ERROR,
      hint: "Codes expire after 15 minutes. Run `hackspain auth login` to get a new one.",
      message: "That code was not accepted.",
    },
  },
];

const CODED_EXIT: Record<string, ExitCode> = {
  ALREADY_IN_TEAM: EXIT.ERROR,
  BAD_CODE: EXIT.ERROR,
  NOT_FOUND: EXIT.ERROR,
  NOT_MEMBER: EXIT.ERROR,
  NOT_OWNER: EXIT.ERROR,
  NO_TEAM: EXIT.ERROR,
  UNAUTHENTICATED: EXIT.AUTH,
  VALIDATION: EXIT.USAGE,
};

const CODED_HINT: Record<string, string> = {
  ALREADY_IN_TEAM: "Leave it first with `hackspain team leave`.",
  BAD_CODE: "Ask the team owner for the code shown by `hackspain team show`.",
  NO_TEAM:
    "Create one with `hackspain team create <name>` or join with `hackspain team join <code>`.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const UNCAUGHT_PATTERN = /Uncaught (?:Convex)?Error: ([^\n]*)/;
const REQUEST_ID_PREFIX = /^\[Request ID: [^\]]+\] Server Error:?\s*/;
const NETWORK_PATTERN =
  /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|fetch failed|Unable to connect|ConnectionRefused/i;

/**
 * Strip Convex's "[Request ID: …] Server Error\nUncaught Error: " wrapper.
 * Actions that call other functions nest the prefix, so peel until stable.
 */
export function serverMessage(raw: string): string {
  let message = raw.replace(REQUEST_ID_PREFIX, "").trim();
  for (;;) {
    const match = UNCAUGHT_PATTERN.exec(message);
    if (!match?.[1]) {
      return message;
    }
    message = match[1].trim();
  }
}

function isNetworkError(err: Error): boolean {
  const text = `${err.name} ${err.message} ${String((err as { code?: unknown }).code ?? "")}`;
  return NETWORK_PATTERN.test(text);
}

export function explainError(err: unknown): Explained {
  if (err instanceof CliError) {
    return {
      code: err.code,
      exitCode: err.exitCode,
      hint: err.hint,
      message: err.message,
    };
  }

  if (err instanceof RemoteError) {
    const data: unknown = err.data;
    if (isRecord(data) && typeof data.code === "string") {
      const message =
        typeof data.message === "string" ? data.message : String(data.code);
      return {
        code: data.code,
        exitCode: CODED_EXIT[data.code] ?? EXIT.ERROR,
        hint: CODED_HINT[data.code],
        message,
      };
    }
    return {
      code: "SERVER",
      exitCode: EXIT.ERROR,
      message: typeof data === "string" ? data : err.message,
    };
  }

  if (err instanceof Error) {
    for (const { needle, explained } of GATE_MESSAGES) {
      if (err.message.includes(needle)) {
        return explained;
      }
    }
    if (isNetworkError(err)) {
      return {
        code: "NETWORK",
        exitCode: EXIT.NETWORK,
        hint: "Check your connection, or pass --url if you are targeting a dev server.",
        message: "Could not reach the HackSpain server.",
      };
    }
    return {
      code: "SERVER",
      exitCode: EXIT.ERROR,
      message: serverMessage(err.message),
    };
  }

  return { code: "UNKNOWN", exitCode: EXIT.ERROR, message: String(err) };
}
