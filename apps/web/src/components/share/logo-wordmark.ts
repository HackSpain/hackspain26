import logoSvgRaw from "../../assets/logo.svg?raw";

/**
 * The wordmark inline, so it needs no network request.
 * Shared by the badge canvas in the browser and the social image on the server.
 */
export function logoWordmarkDataUri(): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvgRaw)}`;
}
