/** Sunday 20 Sep 2026, 11:05 Europe/Madrid (CEST). */
export const SUBMIT_CLOSES_AT_MS = Date.parse("2026-09-20T11:05:00+02:00");

export function isSubmissionsAccepting(
  submissionsOpen: boolean,
  now: number
): boolean {
  return submissionsOpen && now < SUBMIT_CLOSES_AT_MS;
}

export function submissionsClosedMessage(now: number): string {
  if (now >= SUBMIT_CLOSES_AT_MS) {
    return "El plazo de envío cerró a las 11:05.";
  }
  return "El envío de proyectos aún no está abierto";
}
