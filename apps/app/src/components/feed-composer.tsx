"use client";

import { useMutation, useQuery } from "convex/react";
import type { OptimisticUpdate } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { api } from "@convex/_generated/api";
import type { FeedPost } from "@/components/feed-timeline";
import { FormError, errorMessage } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const MAX_TEXT = 500;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function storageIdFromUpload(value: unknown): Id<"_storage"> {
  if (
    typeof value === "object" &&
    value !== null &&
    "storageId" in value &&
    typeof value.storageId === "string"
  ) {
    return value.storageId as Id<"_storage">;
  }
  throw new Error("No se pudo subir la imagen");
}

type Me = FunctionReturnType<typeof api.users.me>;

/** Shows the new post in every open feed list before the server confirms it. */
function optimisticPost(me: Me | undefined): OptimisticUpdate<{
  imageId?: Id<"_storage">;
  text: string;
}> {
  return (localStore, args) => {
    const now = Date.now();
    const optimistic: FeedPost = {
      _id: `optimistic-${now}` as Id<"posts">,
      author: me
        ? {
            _id: me._id,
            name: me.name,
            email: me.email,
            avatarUrl: me.avatarUrl,
            userType: me.userType?.label,
          }
        : undefined,
      createdAt: now,
      github: undefined,
      imagePath: undefined,
      kind: "post",
      mine: true,
      pending: true,
      project: undefined,
      teamLogoUrl: undefined,
      teamName: undefined,
      text: args.text.trim(),
    };
    for (const { args: queryArgs, value } of localStore.getAllQueries(
      api.feed.list,
    )) {
      if (!value || queryArgs.before !== undefined) {
        continue;
      }
      localStore.setQuery(api.feed.list, queryArgs, [optimistic, ...value]);
    }
  };
}

export function FeedComposer({ framed = true }: { framed?: boolean }) {
  const me = useQuery(api.users.me);
  const post = useMutation(api.feed.post).withOptimisticUpdate(
    optimisticPost(me),
  );
  const generateUploadUrl = useMutation(api.feed.generateUploadUrl);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const remaining = MAX_TEXT - text.length;

  async function submit() {
    setError(null);
    if (!text.trim() && !file) {
      setError("Escribe algo o adjunta una imagen.");
      return;
    }
    if (file && file.size > MAX_IMAGE_BYTES) {
      setError("La imagen no puede superar 5 MB.");
      return;
    }
    setBusy(true);
    const draft = text;
    try {
      let imageId: Id<"_storage"> | undefined;
      if (file) {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!response.ok) throw new Error("No se pudo subir la imagen");
        imageId = storageIdFromUpload(await response.json());
      }
      setText("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      await post({ text: draft, imageId });
    } catch (err) {
      setText(draft);
      setError(errorMessage(err, "No se pudo publicar"));
    } finally {
      setBusy(false);
    }
  }

  const fields = (
    <div className="min-w-0 space-y-3">
      <div className="min-w-0 border-[3px] border-hs-ink bg-hs-paper motion-safe:transition-[border-color] motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] focus-within:border-hs-navy">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT))}
          placeholder="¿En qué estáis? Un avance, una foto del equipo, una demo que funciona…"
          rows={3}
          aria-label="Nueva publicación"
          className="min-h-24 resize-y border-0 focus-visible:border-transparent"
        />
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 pb-2">
          <div className="flex min-w-0 items-center gap-3">
            <label className="inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-2 text-sm font-medium text-hs-navy hover:underline">
              <ImagePlus className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">
                {file ? file.name : "Añadir imagen"}
              </span>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {file ? (
              <button
                type="button"
                className="shrink-0 text-xs text-hs-brown underline"
                onClick={() => {
                  setFile(null);
                  if (fileInput.current) fileInput.current.value = "";
                }}
              >
                quitar
              </button>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span
              className={
                remaining < 40
                  ? "text-xs tabular-nums text-hs-red"
                  : "text-xs tabular-nums text-hs-brown"
              }
            >
              {remaining}
            </span>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Publicando…" : "Publicar"}
            </Button>
          </div>
        </div>
      </div>
      <FormError message={error} />
    </div>
  );

  if (!framed) return fields;
  return (
    <Card>
      <CardContent className="pt-6">{fields}</CardContent>
    </Card>
  );
}
