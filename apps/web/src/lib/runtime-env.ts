export function envFromRuntime(name: string): string | undefined {
  const proc = globalThis.process;
  const processValue = proc?.env?.[name];
  if (typeof processValue === "string" && processValue.trim()) {
    return processValue.trim();
  }

  const importMetaEnv = import.meta.env;
  const importMetaValue = importMetaEnv?.[name];
  return typeof importMetaValue === "string" && importMetaValue.trim()
    ? importMetaValue.trim()
    : undefined;
}

export function siteOriginFromRuntime(): string {
  const configured = envFromRuntime("SITE_URL") ?? "https://hackspain.com";
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "https://hackspain.com";
    }
    return url.origin;
  } catch {
    return "https://hackspain.com";
  }
}

/**
 * Origin for links handed to someone else to open, like a post drafted on X.
 * Nothing serves the public origin from a development machine, so there the link
 * points back at the dev server and stays clickable while building the flow.
 */
export function sharedLinkOriginFromRuntime(requestOrigin: string): string {
  return import.meta.env.DEV ? requestOrigin : siteOriginFromRuntime();
}
