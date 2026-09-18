async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const value: unknown = await response.json();
    if (
      typeof value === "object" &&
      value !== null &&
      "error" in value &&
      typeof value.error === "string" &&
      value.error.trim()
    ) {
      return value.error;
    }
  } catch {
    // The body is not JSON; keep the fallback.
  }
  return fallback;
}

async function avatarRequest(
  init: RequestInit,
  fallback: string
): Promise<void> {
  const response = await fetch("/api/avatar", init);
  if (response.ok) {
    return;
  }
  throw new Error(await readError(response, fallback));
}

export async function uploadAvatar(file: File, thumb?: File): Promise<void> {
  const body = new FormData();
  body.append("file", file);
  if (thumb) {
    body.append("thumb", thumb);
  }
  await avatarRequest({ body, method: "POST" }, "No se pudo subir la foto");
}

export async function removeUploadedAvatar(): Promise<void> {
  await avatarRequest({ method: "DELETE" }, "No se pudo quitar la foto");
}
