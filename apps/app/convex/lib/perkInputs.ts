import type { Infer } from "convex/values";
import type { perkAnswerValidator, perkInputValidator } from "./validators";

export type PerkInput = Infer<typeof perkInputValidator>;
export type PerkInputType = PerkInput["type"];
export type PerkAnswer = Infer<typeof perkAnswerValidator>;

export const MAX_PERK_INPUTS = 10;
export const MAX_ANSWER_LENGTH = 500;

export const perkInputTypeLabels: Record<PerkInputType, string> = {
  text: "Texto",
  email: "Email",
  url: "URL",
  select: "Selector",
};

/** Turns a label into a stable machine key: "Tamaño de camiseta" → "tamano_de_camiseta". */
export function slugKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export type InputsResult =
  | { ok: true; inputs: PerkInput[] }
  | { ok: false; message: string };

/** Cleans an admin-authored input list. Returns a Spanish message on the first problem. */
export function normalizeInputs(raw: PerkInput[]): InputsResult {
  if (raw.length > MAX_PERK_INPUTS) {
    return { ok: false, message: `Máximo ${MAX_PERK_INPUTS} campos por perk` };
  }
  const seen = new Set<string>();
  const inputs: PerkInput[] = [];
  for (const input of raw) {
    const label = input.label.trim();
    if (!label) return { ok: false, message: "Cada campo necesita una etiqueta" };
    const key = slugKey(input.key.trim() || label);
    if (!key) {
      return { ok: false, message: `El campo "${label}" necesita una clave válida` };
    }
    if (seen.has(key)) {
      return { ok: false, message: `La clave "${key}" está repetida` };
    }
    seen.add(key);
    let options: string[] | undefined;
    if (input.type === "select") {
      options = Array.from(
        new Set((input.options ?? []).map((option) => option.trim()).filter(Boolean)),
      );
      if (options.length === 0) {
        return { ok: false, message: `El selector "${label}" necesita opciones` };
      }
    }
    inputs.push({ key, label, type: input.type, required: input.required, options });
  }
  return { ok: true, inputs };
}

export type AnswersResult =
  | { ok: true; answers: PerkAnswer[] }
  /** `message` names the field (for toasts); `fieldMessage` is short, for inline use under it. */
  | { ok: false; key: string; message: string; fieldMessage: string };

function answerProblem(input: PerkInput, value: string): string | null {
  if (!value) return input.required ? "Obligatorio" : null;
  if (value.length > MAX_ANSWER_LENGTH) return `Máximo ${MAX_ANSWER_LENGTH} caracteres`;
  if (input.type === "email" && !isEmail(value)) return "No es un email válido";
  if (input.type === "url" && !isHttpUrl(value)) return "Debe empezar por http:// o https://";
  if (input.type === "select" && !(input.options ?? []).includes(value)) {
    return "Elige una opción de la lista";
  }
  return null;
}

/** Checks a participant's answers against the perk definition and drops unknown keys. */
export function validateAnswers(
  inputs: PerkInput[],
  raw: PerkAnswer[] | undefined,
): AnswersResult {
  const given = new Map<string, string>();
  for (const answer of raw ?? []) given.set(answer.key, answer.value.trim());
  const answers: PerkAnswer[] = [];
  for (const input of inputs) {
    const value = given.get(input.key) ?? "";
    const problem = answerProblem(input, value);
    if (problem) {
      return {
        ok: false,
        key: input.key,
        message: `${input.label}: ${problem.toLowerCase()}`,
        fieldMessage: problem,
      };
    }
    if (value) answers.push({ key: input.key, value });
  }
  return { ok: true, answers };
}

export function answerFor(answers: PerkAnswer[] | undefined, key: string): string {
  return answers?.find((answer) => answer.key === key)?.value ?? "";
}
