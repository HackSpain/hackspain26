/**
 * Desktop toasts without node-notifier: its vendored binaries resolve via
 * __dirname, which does not exist inside a compiled Bun binary. Each platform
 * gets the same command node-notifier would run, spawned without a shell.
 */
export type Toaster = (subject: string, body: string) => Promise<boolean>;

const APP = "HackSpain";

async function run(cmd: string[]): Promise<boolean> {
  try {
    const proc = Bun.spawn(cmd, {
      env: process.env,
      stdout: "ignore",
      stderr: "ignore",
      stdin: "ignore",
    });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

function appleScriptString(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function powerShellString(text: string): string {
  return text.replace(/'/g, "''");
}

export async function toastLinux(
  subject: string,
  body: string
): Promise<boolean> {
  return await run([
    "notify-send",
    `--app-name=${APP}`,
    "--icon=dialog-information",
    subject,
    body,
  ]);
}

export async function toastMac(
  subject: string,
  body: string
): Promise<boolean> {
  const script = `display notification "${appleScriptString(body)}" with title "${APP}" subtitle "${appleScriptString(subject)}"`;
  return await run(["osascript", "-e", script]);
}

export async function toastWindows(
  subject: string,
  body: string
): Promise<boolean> {
  const script = [
    "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null",
    "$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)",
    `$t.GetElementsByTagName('text')[0].AppendChild($t.CreateTextNode('${powerShellString(subject)}')) > $null`,
    `$t.GetElementsByTagName('text')[1].AppendChild($t.CreateTextNode('${powerShellString(body)}')) > $null`,
    `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${APP}').Show([Windows.UI.Notifications.ToastNotification]::new($t))`,
  ].join("; ");
  return await run([
    "powershell",
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    script,
  ]);
}

export function platformToaster(platform = process.platform): Toaster {
  switch (platform) {
    case "darwin":
      return toastMac;
    case "win32":
      return toastWindows;
    default:
      return toastLinux;
  }
}
