/**
 * Loads the GitHub avatar through our own proxy. It has to be same-origin:
 * github.com/<handle>.png answers with a redirect that carries no CORS headers,
 * so a direct cross-origin load fails outright and the canvas never gets it.
 */
export function loadAvatarImage(
  handle: string
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => resolve(null), { once: true });
    image.src = `/api/github-avatar?user=${encodeURIComponent(handle)}`;
  });
}
