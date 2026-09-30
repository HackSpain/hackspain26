import { expect, spyOn, test } from "bun:test";
import type { Session } from "../src/lib/api";
import type { CliContext } from "../src/lib/context";
import { detectAndConfirmStack } from "../src/lib/stack-flow";
import { recordingUi } from "./recording-ui";

test("clearing the detected stack succeeds and tells the interactive user", async () => {
  const prompts = await import("../src/lib/prompts");
  const confirm = spyOn(prompts, "confirmOrFlag").mockResolvedValue(false);
  const text = spyOn(prompts, "textOrFlag").mockResolvedValue(" , ");
  const mutations: unknown[] = [];
  const session = {
    client: {
      action: async () => ({ techStack: ["Astro"] }),
      mutation: async (_ref: unknown, args: unknown) => {
        mutations.push(args);
        return [];
      },
    },
  } as unknown as Session;
  const ctx = { interactive: true, json: false } satisfies CliContext;
  const ui = recordingUi();

  try {
    expect(await detectAndConfirmStack(ctx, ui, session, {})).toEqual([]);
    expect(mutations).toEqual([{ stack: [] }]);
    expect(ui.printed.at(-1)).toBe("Stack cleared.");
    expect(ui.results).toEqual([]);
  } finally {
    confirm.mockRestore();
    text.mockRestore();
  }
});
