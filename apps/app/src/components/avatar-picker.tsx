"use client";

import { useMutation } from "convex/react";
import { ImagePlus, Trash2 } from "lucide-react";
import { useRef } from "react";
import type { ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { ActionFeedback } from "@/components/action-feedback";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function storageIdFromUpload(value: unknown): Id<"_storage"> {
  if (
    typeof value === "object" &&
    value !== null &&
    "storageId" in value &&
    typeof value.storageId === "string"
  ) {
    return value.storageId as Id<"_storage">;
  }
  throw new Error("No se pudo subir la foto");
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
    const uploadUrl = await generateUploadUrl();
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!response.ok) {
      throw new Error("No se pudo subir la foto");
    }
    await setAvatar({ imageId: storageIdFromUpload(await response.json()) });
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
    <>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          name={name}
          src={avatarUrl}
          className="size-20 text-2xl shadow-[4px_4px_0_var(--color-hs-ink)]"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 border-[3px] border-hs-ink bg-hs-gold px-5 font-bungee text-sm text-hs-ink hs-hover-bright">
            <ImagePlus className="size-4" aria-hidden />
            {action.pending
              ? "Subiendo…"
              : avatarUrl
                ? "Cambiar foto"
                : "Subir foto"}
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
          {avatarUrl && canRemove ? (
            <Button
              type="button"
              variant="outline"
              disabled={action.pending}
              onClick={() =>
                void action.run(async () => {
                  await removeAvatar({});
                  return "Foto eliminada. Vuelves a usar tu avatar de GitHub.";
                })
              }
            >
              <Trash2 aria-hidden /> Quitar foto
            </Button>
          ) : null}
          {children}
        </div>
      </div>
      <p className="text-xs text-hs-brown">JPG, PNG, WebP o GIF de hasta 2 MB.</p>
    </>
  );
}
