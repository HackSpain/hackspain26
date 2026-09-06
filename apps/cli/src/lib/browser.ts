/**
 * Best-effort "open this URL in the default browser". Callers always print
 * the URL as well, so a headless box or a missing opener is never fatal.
 */
function openerFor(url: string): string[] {
  if (process.platform === "darwin") {
    return ["open", url];
  }
  if (process.platform === "win32") {
    return ["cmd", "/c", "start", "", url];
  }
  return ["xdg-open", url];
}

export function openInBrowser(url: string): boolean {
  const command = openerFor(url);
  try {
    const child = Bun.spawn(command, {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}
