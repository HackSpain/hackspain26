import logoSvgRaw from "../../assets/logo.svg?raw";

/** Height-to-width ratio of the wordmark. */
export const LOGO_WORDMARK_ASPECT = 306 / 928;

/**
 * The wordmark inline, so it needs no network request.
 * Shared by the badge canvas in the browser and the social image on the server.
 */
export function logoWordmarkDataUri(): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvgRaw)}`;
}
