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
import { firstName, formatWhen, uiFor } from "../lib/output";
import { textOrFlag } from "../lib/prompts";
import { c, highlight } from "../lib/style";
import { completeProfile } from "./profile";

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

        ui.intro("login");
        const existing = readCredentials();
        if (existing && existing.appUrl === url) {
          ui.info(
            `You are already signed in as ${existing.email}. Signing in again replaces that session.`
          );
        }

        const email = normalizeEmail(
          await textOrFlag(ctx, opts.email, {
            flag: "--email",
            message: "Email you applied with",
            placeholder: "you@example.com",
            validate: validateEmail,
          })
        );

        const started = await ui.spin(
          `Sending a code to ${email}…`,
          () => authStart(url, email),
          `Code sent to ${email}. Check your inbox (and spam, just in case).`
        );
        if (!started) {
          throw new CliError("The server did not start an email sign-in.", {
            code: "SIGNIN_FAILED",
          });
        }

        const code = (
          await textOrFlag(ctx, opts.code, {
            flag: "--code",
            message: "Paste the 8-digit code",
            placeholder: "12345678",
            validate: validateCode,
          })
        ).trim();

        const tokens = await ui.spin(
          "Signing you in…",
          () => authVerify(url, email, code),
          "Signed in"
        );
        if (!tokens) {
          throw new CliError("That code was not accepted.", {
            code: "BAD_OTP",
            hint: "Codes expire after 15 minutes. Run `hackspain auth login` to get a fresh one.",
          });
        }

        writeCredentials(credentialsFromTokens(tokens, url, email));
        const session = await openSession(ctx, { requireAuth: true });
        const me = await ui.spin(
          "Setting up your profile…",
          async () => {
            await session.client.mutation(api.users.attachAfterLogin, {});
            return await fetchMe(session);
          },
          "Profile ready"
        );
        const gate = me ? describeGate(me) : null;

        if (ctx.json) {
          ui.result({ email, url, gate });
          return;
        }
        ui.celebrate(`Welcome, ${highlight(firstName(me?.name, email))}!`);
        if (me) {
          await completeProfile(ctx, ui, session, me);
        }
        if (gate && gate.state !== "ready" && gate.state !== "admin") {
          ui.warn(gate.message);
          if (gate.hint) {
            ui.line(c.dim(gate.hint));
          }
          ui.outro("Everything else unlocks once that is sorted.");
          return;
        }
        ui.next([
          ["hackspain", "see where you stand and what to do next"],
          [
            "hackspain team create <name>",
            "start a team, or join one with a code",
          ],
          ["hackspain watch", "keep it running in a spare terminal"],
        ]);
        ui.outro("Have a great hackathon ⚡");
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
      ui.success(`Signed out ${creds.email}. See you soon.`);
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
        ui.warn(`Not signed in to ${url} (${source}).\n${hint}`);
        return;
      }

      const session = await openSession(ctx);
      const me = await ui.spin(
        "Checking your session…",
        async () => (session.authenticated ? await fetchMe(session) : null),
        "Session checked"
      );
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

      ui.kv([
        ["Signed in as", highlight(refreshed.email)],
        [
          "Status",
          gate ? gate.message : c.red("session rejected by the server"),
        ],
        ...(me?.githubUsername
          ? ([["GitHub", me.githubUsername]] as [string, string][])
          : []),
        ["Server", c.dim(`${url} (${source})`)],
        ["Session renews", c.dim(formatWhen(refreshed.tokenExpiresAt))],
      ]);
      if (gate?.hint) {
        ui.line(`\n${c.dim(gate.hint)}`);
      }
    });
}
