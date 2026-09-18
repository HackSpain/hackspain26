import { v } from "convex/values";
import type { Infer } from "convex/values";

export const screenPresetValidator = v.union(
  v.literal("entradas"), v.literal("avisos"), v.literal("actividad"),
  v.literal("patrocinadores"), v.literal("espera"),
);
export type ScreenPreset = Infer<typeof screenPresetValidator>;
export const SCREEN_PRESETS: { value: ScreenPreset; label: string; description: string }[] = [
  { value: "entradas", label: "Entradas", description: "Bienvenida al validar cada código" },
  { value: "avisos", label: "Avisos", description: "Un mensaje grande para esta pantalla" },
  { value: "actividad", label: "Actividad", description: "Feed de participantes y GitHub" },
  { value: "patrocinadores", label: "Patrocinadores", description: "Logos de los colaboradores" },
  { value: "espera", label: "Espera", description: "Franjas animadas de HackSpain" },
];
export const SCREEN_OFFLINE_MS = 45_000;
export const SCREEN_HEARTBEAT_MS = 15_000;
export const screenConfigValidator = v.object({
  preset: screenPresetValidator, message: v.string(), revision: v.number(), reloadVersion: v.number(),
});
export type ScreenConfig = Infer<typeof screenConfigValidator>;
export function screenKey(value: string): string {
  const key = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(key)) {
    throw new Error("Usa de 1 a 48 letras sin acentos, números, guiones o guiones bajos.");
  }
  return key;
}
export function screenPreset(value: string | null): ScreenPreset {
  return SCREEN_PRESETS.find((preset) => preset.value === value)?.value ?? "espera";
}
export function screenConfig(row: ScreenConfig): ScreenConfig {
  return { preset: row.preset, message: row.message, revision: row.revision, reloadVersion: row.reloadVersion };
}
