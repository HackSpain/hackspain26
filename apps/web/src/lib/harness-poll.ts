export const HARNESS_OPTIONS = [
  {
    colorClass: "bg-hs-orange",
    id: "claude-code",
    mark: "CC",
    name: "Claude Code",
  },
  { colorClass: "bg-hs-teal", id: "codex", mark: ">_", name: "Codex" },
  { colorClass: "bg-hs-navy", id: "cursor", mark: "CU", name: "Cursor" },
  {
    colorClass: "bg-hs-gold",
    id: "copilot",
    mark: "GH",
    name: "GitHub Copilot",
  },
  {
    colorClass: "bg-hs-slate",
    id: "opencode",
    mark: "OC",
    name: "OpenCode",
  },
  { colorClass: "bg-hs-red", id: "cline", mark: "CL", name: "Cline" },
  {
    colorClass: "bg-hs-brown text-hs-paper",
    id: "gemini-cli",
    mark: "G",
    name: "Gemini CLI",
  },
  {
    colorClass: "bg-hs-sand",
    id: "windsurf",
    mark: "WS",
    name: "Windsurf",
  },
] as const;

export type HarnessId = (typeof HARNESS_OPTIONS)[number]["id"];

const HARNESS_IDS = new Set<string>(HARNESS_OPTIONS.map(({ id }) => id));

export function isHarnessId(value: unknown): value is HarnessId {
  return typeof value === "string" && HARNESS_IDS.has(value);
}
