"use client";

import { useMutation } from "convex/react";
import { ImagePlus, Trash2 } from "lucide-react";
import { useRef } from "react";
import type { ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { PHOTO_WIDTH } from "@convex/lib/photo";
import type { ActionFeedback } from "@/components/action-feedback";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { uploadToConvex } from "@/lib/upload";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * A square, centred copy at the width the participants map draws, made here
 * so the server never has to resize the full upload. Undefined when the
 * browser cannot decode the file; the map then falls back to resizing on
 * demand (convex/lib/photo.ts).
 */
async function thumbnailOf(file: File): Promise<File | undefined> {
  if (typeof createImageBitmap !== "function") {
    return undefined;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return undefined;
  }
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_WIDTH;
  canvas.height = PHOTO_WIDTH;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return undefined;
  }
  const side = Math.min(bitmap.width, bitmap.height);
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    PHOTO_WIDTH,
    PHOTO_WIDTH
  );
  bitmap.close();
  // Browsers without WebP encoding hand back a PNG; the type comes from the blob.
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.85);
  });
  return blob ? new File([blob], "avatar-thumb", { type: blob.type }) : undefined;
}

/** Uploads a picture to Convex storage and makes it the profile photo. */
export function useAvatarUpload(): (file: File) => Promise<void> {
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const setAvatar = useMutation(api.users.setAvatar);

  return async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Solo se admiten imágenes");
    }
    if (file.size > MAX_AVATAR_BYTES) {
      throw new Error("La foto no puede superar 2 MB.");
    }
    const error = "No se pudo subir la foto";
    const [imageId, thumbnail] = await Promise.all([
      generateUploadUrl().then((url) => uploadToConvex(url, file, error)),
      thumbnailOf(file),
    ]);
    const thumbId = thumbnail
      ? await uploadToConvex(await generateUploadUrl(), thumbnail, error)
      : undefined;
    await setAvatar({ imageId, thumbId });
  };
}

/**
 * The profile picture with its upload and remove controls, shared by the
 * profile page and the onboarding wizard. `action` owns pending state and
 * feedback; `children` adds extra controls (the GitHub avatar button).
 * "Quitar foto" only shows with `canRemove`: a photo is required, so the
 * server refuses to remove the last one (`users.removeAvatar`).
 */
export function AvatarPicker({
  name,
  avatarUrl,
  action,
  canRemove = false,
  children,
}: {
  name?: string;
  avatarUrl?: string;
  action: ActionFeedback;
  canRemove?: boolean;
  children?: ReactNode;
}) {
  const upload = useAvatarUpload();
  const removeAvatar = useMutation(api.users.removeAvatar);
  const fileInput = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex items-center gap-4">
      <Avatar
        name={name}
        src={avatarUrl}
        className="size-20 shrink-0 text-xl shadow-[4px_4px_0_var(--color-hs-ink)]"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="min-h-8 cursor-pointer px-3 text-xs">
            <label>
              <ImagePlus className="size-3.5" aria-hidden />
              {action.pending ? "Subiendo…" : avatarUrl ? "Cambiar foto" : "Subir foto"}
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                disabled={action.pending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }
                  void action.run(async () => {
                    try {
                      await upload(file);
                    } finally {
                      if (fileInput.current) {
                        fileInput.current.value = "";
                      }
                    }
                    return "Foto actualizada.";
                  });
                }}
              />
            </label>
          </Button>
          {avatarUrl && canRemove ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-8 px-3 text-xs"
              disabled={action.pending}
              onClick={() =>
                void action.run(async () => {
                  await removeAvatar({});
                  return "Foto eliminada. Vuelves a usar tu avatar de GitHub.";
                })
              }
            >
              <Trash2 className="size-3.5" aria-hidden /> Quitar foto
            </Button>
          ) : null}
          {children}
        </div>
        <p className="text-xs text-hs-brown">JPG, PNG, WebP o GIF de hasta 2 MB.</p>
      </div>
    </div>
  );
}
