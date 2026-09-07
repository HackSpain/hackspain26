import type { Command } from "commander";
import {
  api,
  authSignOut,
  authStart,
  authVerify,
  openSession,
} from "../lib/api";
import {
  clearCredentials,
  credentialsFromTokens,
  readCredentials,
  writeCredentials,
} from "../lib/auth-store";
import { resolveAppUrl } from "../lib/config";
import { contextFor } from "../lib/context";
import { CliError } from "../lib/errors";
import { describeGate, fetchMe } from "../lib/me";
import { formatWhen, uiFor } from "../lib/output";
import { textOrFlag } from "../lib/prompts";

const CODE_PATTERN = /^\d{8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function validateEmail(value: string): string | undefined {
  return EMAIL_PATTERN.test(value.trim())
    ? undefined
    : "Enter a valid email address";
}

function validateCode(value: string): string | undefined {
  return CODE_PATTERN.test(value.trim())
    ? undefined
    : "The code is the 8 digits from the email";
}

export function registerAuth(program: Command): void {
  const auth = program
    .command("auth")
    .description("Log in and out of your HackSpain account");

  auth
    .command("login")
    .description(
      "Sign in with the email you applied with (one-time code by email, same as the dashboard)"
    )
    .option("-e, --email <email>", "email to sign in with")
    .option("--code <code>", "8-digit code (skips the prompt; for scripts)")
    .action(
      async (opts: { email?: string; code?: string }, command: Command) => {
        const ctx = contextFor(command);
        const ui = uiFor(ctx);
        const { url } = resolveAppUrl(ctx.urlOverride);

        ui.intro("hackspain login");
        const existing = readCredentials();
        if (existing && existing.appUrl === url) {
          ui.info(`Replacing the current session for ${existing.email}.`);
        }

        const email = normalizeEmail(
          await textOrFlag(ctx, opts.email, {
            flag: "--email",
            message: "Email you applied with",
            placeholder: "you@example.com",
            validate: validateEmail,
          })
        );

        if (!(await authStart(url, email))) {
          throw new CliError("The server did not start an email sign-in.", {
            code: "SIGNIN_FAILED",
          });
        }
        ui.step(`Sent an 8-digit code to ${email}.`);

        const code = (
          await textOrFlag(ctx, opts.code, {
            flag: "--code",
            message: "Code from the email",
            placeholder: "12345678",
            validate: validateCode,
          })
        ).trim();

        const tokens = await authVerify(url, email, code);
        if (!tokens) {
          throw new CliError("That code was not accepted.", {
            code: "BAD_OTP",
            hint: "Codes expire after 15 minutes. Run `hackspain auth login` to get a new one.",
          });
        }

        writeCredentials(credentialsFromTokens(tokens, url, email));
        const session = await openSession(ctx, { requireAuth: true });
        await session.client.mutation(api.users.attachAfterLogin, {});
        const me = await fetchMe(session);
        const gate = me ? describeGate(me) : null;

        if (ctx.json) {
          ui.result({ email, url, gate });
          return;
        }
        ui.success(`Logged in as ${email}.`);
        if (gate) {
          (gate.state === "ready" || gate.state === "admin"
            ? ui.info
            : ui.warn)(
            gate.hint ? `${gate.message}\n${gate.hint}` : gate.message
          );
        }
        ui.outro("Try `hackspain team show` next.");
      }
    );

  auth
    .command("logout")
    .description("Forget the stored session")
    .action(async (_opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const creds = readCredentials();
      if (!creds) {
        ui.result({ loggedOut: false });
        ui.info("No stored session.");
        return;
      }
      try {
        const session = await openSession(ctx);
        const token = session.authenticated ? await session.token() : null;
        if (token) {
          await authSignOut(session.url, token);
        }
      } catch {
        // Server-side sign-out is best effort, like the web app.
      }
      clearCredentials();
      ui.result({ loggedOut: true, email: creds.email });
      ui.success(`Logged out ${creds.email}.`);
    });

  auth
    .command("status")
    .description("Show who you are logged in as and what you can do")
    .action(async (_opts: unknown, command: Command) => {
      const ctx = contextFor(command);
      const ui = uiFor(ctx);
      const { url, source } = resolveAppUrl(ctx.urlOverride);
      const creds = readCredentials();
      const forThisUrl = creds && creds.appUrl === url ? creds : null;

      if (!forThisUrl) {
        const hint = creds
          ? `Stored session is for ${creds.appUrl}; current server is ${url}.`
          : "Run `hackspain auth login`.";
        if (ctx.json) {
          ui.result({ loggedIn: false, url, urlSource: source, hint });
          return;
        }
        ui.warn(`Not logged in to ${url} (${source}).\n${hint}`);
        return;
      }

      const session = await openSession(ctx);
      const me = session.authenticated ? await fetchMe(session) : null;
      const gate = me ? describeGate(me) : null;
      const refreshed = readCredentials() ?? forThisUrl;

      if (ctx.json) {
        ui.result({
          loggedIn: Boolean(me),
          email: refreshed.email,
          url,
          urlSource: source,
          tokenExpiresAt: refreshed.tokenExpiresAt,
          gate,
          me: me && {
            name: me.name,
            role: me.role,
            githubUsername: me.githubUsername,
          },
        });
        return;
      }

      ui.table([
        ["Email", refreshed.email],
        ["Server", `${url} (${source})`],
        ["Token expires", formatWhen(refreshed.tokenExpiresAt)],
        ["Status", gate ? gate.message : "Session rejected by the server"],
        ...(me?.githubUsername ? [["GitHub", me.githubUsername]] : []),
      ]);
      if (gate?.hint) {
        ui.line(`\n${gate.hint}`);
      }
    });
}
