export const HARNESS_OPTIONS = [
  {
    id: "claude-code",
    logoSrc: "/harnesses/claude.svg",
    name: "Claude Code",
  },
  { id: "codex", logoSrc: "/harnesses/openai.svg", name: "Codex" },
  { id: "cursor", logoSrc: "/harnesses/cursor.svg", name: "Cursor" },
  {
    id: "copilot",
    logoSrc: "/harnesses/github-copilot.svg",
    name: "GitHub Copilot",
  },
  {
    id: "opencode",
    logoSrc: "/harnesses/opencode.svg",
    name: "OpenCode",
  },
  { id: "cline", logoSrc: "/harnesses/cline.svg", name: "Cline" },
  {
    id: "gemini-cli",
    logoSrc: "/harnesses/google-gemini.svg",
    name: "Gemini CLI",
  },
  {
    id: "windsurf",
    logoSrc: "/harnesses/windsurf.svg",
    name: "Windsurf",
  },
] as const;

export type HarnessId = (typeof HARNESS_OPTIONS)[number]["id"];

const HARNESS_IDS = new Set<string>(HARNESS_OPTIONS.map(({ id }) => id));

export function isHarnessId(value: unknown): value is HarnessId {
  return typeof value === "string" && HARNESS_IDS.has(value);
}
