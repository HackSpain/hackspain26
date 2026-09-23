import type { Session } from "./api";
import { api } from "./api";
import type { CliContext } from "./context";
import { CliError } from "./errors";
import type { Ui } from "./output";
import { confirmOrFlag, textOrFlag } from "./prompts";
import { c, highlight, terminalText } from "./style";

const TAG_SPLIT = /[,\s]+/;

function parseTags(raw: string): string[] {
  return raw
    .split(TAG_SPLIT)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function detectAndConfirmStack(
  ctx: CliContext,
  ui: Ui,
  session: Session,
  opts: { yes?: boolean }
): Promise<string[]> {
  const detected = await ui.spin(
    "Reading the repo…",
    () => session.client.action(api.stackDetect.mine, { force: true }),
    "Stack detected"
  );
  let techStack = detected.techStack;
  if (techStack.length === 0) {
    ui.warn(
      "We could not detect a stack. Make sure the repository exists and is public."
    );
    return [];
  }
  ui.line(
    techStack.map((tag) => highlight(terminalText(tag))).join(c.dim(" · "))
  );
  if (!ctx.interactive || opts.yes) {
    return techStack;
  }
  const ok = await confirmOrFlag(ctx, undefined, {
    flag: "--yes",
    initialValue: true,
    message: "Looks right?",
  });
  if (ok) {
    return techStack;
  }
  const edited = parseTags(
    await textOrFlag(ctx, undefined, {
      flag: "--stack",
      initialValue: terminalText(techStack.join(", ")),
      message: "Stack, comma-separated",
    })
  );
  techStack = await session.client.mutation(api.teams.setTechStack, {
    stack: edited,
  });
  if (techStack.length === 0) {
    throw new CliError("Stack cleared.");
  }
  ui.line(
    techStack.map((tag) => highlight(terminalText(tag))).join(c.dim(" · "))
  );
  return techStack;
}
