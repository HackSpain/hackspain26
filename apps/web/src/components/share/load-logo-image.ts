import { logoWordmarkDataUri } from "./logo-wordmark";

export function loadLogoImage(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => resolve(null), { once: true });
    image.src = logoWordmarkDataUri();
  });
}
