import { del, put } from "@vercel/blob";
import { api } from "@convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexError } from "convex/values";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import {
  isAvatarContentType,
  MAX_AVATAR_BYTES,
  MAX_THUMB_BYTES,
} from "@convex/lib/photo";
import { reportServerEvent } from "@/lib/server-observability";

const YEAR_SECONDS = 60 * 60 * 24 * 365;

function jsonError(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mutationMessage(error: unknown, fallback: string): string {
  if (error instanceof ConvexError && isRecord(error.data)) {
    const message = error.data.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
}

async function sessionToken(): Promise<string | null> {
  return (await convexAuthNextjsToken()) ?? null;
}

function asFile(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null;
}

function readImage(
  file: File | null,
  maxBytes: number
): File | { error: string; status: number } {
  if (!file) {
    return { error: "La imagen no se ha subido", status: 400 };
  }
  if (!isAvatarContentType(file.type)) {
    return { error: "Solo se admiten imágenes", status: 415 };
  }
  if (file.size > maxBytes) {
    return { error: "La foto no puede superar 2 MB", status: 413 };
  }
  return file;
}

async function putAvatar(
  pathname: string,
  file: File
): Promise<{ url: string }> {
  return await put(pathname, file, {
    access: "public",
    addRandomSuffix: true,
    cacheControlMaxAge: YEAR_SECONDS,
    contentType: file.type,
  });
}

async function discard(urls: string[]): Promise<void> {
  if (urls.length === 0) {
    return;
  }
  try {
    await del(urls);
  } catch (error) {
    await reportServerEvent("warn", "Could not delete previous avatar blobs", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const token = await sessionToken();
  if (!token) {
    return jsonError("No has iniciado sesión", 401);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("La imagen no se ha subido", 400);
  }

  const photo = readImage(asFile(form.get("file")), MAX_AVATAR_BYTES);
  if (!(photo instanceof File)) {
    return jsonError(photo.error, photo.status);
  }
  const thumbEntry = asFile(form.get("thumb"));
  const thumb =
    thumbEntry === null
      ? null
      : readImage(thumbEntry, MAX_THUMB_BYTES);
  if (thumb !== null && !(thumb instanceof File)) {
    return jsonError(thumb.error, thumb.status);
  }

  const me = await fetchQuery(api.users.me, {}, { token });
  if (!me) {
    return jsonError("No has iniciado sesión", 401);
  }

  const uploaded: string[] = [];
  try {
    const blob = await putAvatar(`avatars/${me._id}/photo`, photo);
    uploaded.push(blob.url);
    const thumbBlob = thumb
      ? await putAvatar(`avatars/${me._id}/thumb`, thumb)
      : null;
    if (thumbBlob) {
      uploaded.push(thumbBlob.url);
    }
    const result = await fetchMutation(
      api.users.setAvatar,
      {
        blobUrl: blob.url,
        thumbBlobUrl: thumbBlob?.url,
      },
      { token }
    );
    await discard(result.previousBlobUrls);
    return NextResponse.json({ ok: true, url: result.url });
  } catch (error) {
    await discard(uploaded);
    await reportServerEvent("warn", "Avatar upload failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return jsonError(
      mutationMessage(error, "No se pudo subir la foto"),
      400
    );
  }
}

export async function DELETE(): Promise<NextResponse> {
  const token = await sessionToken();
  if (!token) {
    return jsonError("No has iniciado sesión", 401);
  }
  try {
    const result = await fetchMutation(api.users.removeAvatar, {}, { token });
    await discard(result.previousBlobUrls);
    return NextResponse.json({ ok: true });
  } catch (error) {
    await reportServerEvent("warn", "Avatar remove failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return jsonError(
      mutationMessage(error, "No se pudo quitar la foto"),
      400
    );
  }
}
