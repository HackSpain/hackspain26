import type { Ui } from "../src/lib/output";

/**
 * A `Ui` that keeps what a command would have printed, so renderer tests can
 * inspect the styled terminal text and the raw `--json` payload separately.
 */
export type RecordingUi = Ui & {
  /** Everything written for a person, in order, with HackSpain's own ANSI. */
  printed: string[];
  /** Every `ui.result()` payload, untouched. */
  results: unknown[];
};

export function recordingUi(json = false): RecordingUi {
  const printed: string[] = [];
  const results: unknown[] = [];
  const keep = (message: string) => {
    printed.push(message);
  };
  return {
    celebrate: keep,
    info: keep,
    intro: keep,
    json,
    kv: (rows) => keep(rows.map(([k, v]) => `${k}: ${v}`).join("\n")),
    line: keep,
    next: (steps) => keep(steps.map(([command]) => command).join("\n")),
    note: (body, title) => keep(title ? `${title}\n${body}` : body),
    outro: keep,
    printed,
    raw: keep,
    result: (data) => {
      results.push(data);
    },
    results,
    spin: (_label, fn) => fn(),
    step: keep,
    success: keep,
    table: (rows, header) =>
      keep(
        [...(header ? [header] : []), ...rows]
          .map((row) => row.join(" | "))
          .join("\n")
      ),
    warn: keep,
  };
}

const ESC = String.fromCodePoint(27);
/** The only escape sequences HackSpain writes itself: SGR colour and weight. */
const OWN_STYLING = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

/** HackSpain's own colours removed; any control that survives came from remote text. */
export function withoutStyling(text: string): string {
  return text.replaceAll(OWN_STYLING, "");
}

/** Everything a hostile remote string could smuggle past the colour codes. */
export const HOSTILE_CONTROL = /[\p{Cc}\p{Bidi_Control}]/u;

/** U+202E (8238) RIGHT-TO-LEFT OVERRIDE, built here so no invisible character sits in a fixture. */
export const RLO = String.fromCodePoint(8238);
