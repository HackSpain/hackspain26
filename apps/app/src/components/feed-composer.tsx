"use client";

import { useMutation, useQuery } from "convex/react";
import type { OptimisticUpdate } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@convex/_generated/dataModel";
import { api } from "@convex/_generated/api";
import type { FeedPost } from "@/components/feed-timeline";
import { errorMessage } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { uploadToConvex } from "@/lib/upload";

const MAX_TEXT = 500;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Me = FunctionReturnType<typeof api.users.me>;

type PostArgs = {
  clientId?: string;
  imageId?: Id<"_storage">;
  text: string;
};

/**
 * Shows the new post in every open feed list before the server confirms it.
 * The row carries the same `clientId` the server will echo back, so the
 * timeline keeps one card (and one DOM node) across the optimistic → real swap.
 * `preview` is a local object URL for the attached image, so the card already
 * has its final height while the upload is in flight.
 */
function optimisticPost(
  me: Me | undefined,
  preview: string | undefined,
): OptimisticUpdate<PostArgs> {
  return (localStore, args) => {
    const now = Date.now();
    const optimistic: FeedPost = {
      _id: `optimistic-${now}` as Id<"posts">,
      clientId: args.clientId,
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
      imagePath: preview,
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

export function FeedComposer() {
  const me = useQuery(api.users.me);
  const post = useMutation(api.feed.post);
  const generateUploadUrl = useMutation(api.feed.generateUploadUrl);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  // Only the image upload is slow enough to deserve visible progress. The
  // mutation itself resolves in ~100 ms and is already shown optimistically in
  // the timeline, so the button does not dim or relabel for it: a state that
  // lasts one or two frames reads as a flicker, not as feedback.
  const [uploading, setUploading] = useState(false);
  const inFlight = useRef(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const remaining = MAX_TEXT - text.length;

  async function submit() {
    if (inFlight.current) {
      return;
    }
    if (!text.trim() && !file) {
      // One stable id per validation message so repeated clicks refresh the
      // same toast instead of stacking copies.
      toast.error("Escribe algo o adjunta una imagen.", { id: "feed-empty" });
      return;
    }
    if (file && file.size > MAX_IMAGE_BYTES) {
      toast.error("La imagen no puede superar 5 MB.", { id: "feed-image-size" });
      return;
    }
    inFlight.current = true;
    const draft = text;
    const attached = file;
    const clientId = crypto.randomUUID();
    let preview: string | undefined;
    try {
      let imageId: Id<"_storage"> | undefined;
      if (attached) {
        setUploading(true);
        const uploadUrl = await generateUploadUrl();
        imageId = await uploadToConvex(
          uploadUrl,
          attached,
          "No se pudo subir la imagen",
        );
        setUploading(false);
      }
      setText("");
      setFile(null);
      if (fileInput.current) {
        fileInput.current.value = "";
      }
      preview = attached ? URL.createObjectURL(attached) : undefined;
      // `withOptimisticUpdate` is not a hook: composing it here lets the
      // optimistic row carry this submission's local image preview.
      await post.withOptimisticUpdate(optimisticPost(me, preview))({
        clientId,
        imageId,
        text: draft,
      });
    } catch (error) {
      setText(draft);
      setFile(attached);
      toast.error(errorMessage(error, "No se pudo publicar"));
    } finally {
      if (preview) {
        // The real row now points at /api/files/<id>; the blob is no longer referenced.
        URL.revokeObjectURL(preview);
      }
      setUploading(false);
      inFlight.current = false;
    }
  }

  return (
    <div className="min-w-0 border-[3px] border-hs-ink bg-hs-paper motion-safe:transition-[border-color] motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] focus-within:border-hs-navy">
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT))}
        placeholder="¿En qué estáis? Un avance, una foto del equipo, una demo que funciona…"
        rows={3}
        aria-label="Nueva publicación"
        className="min-h-24 resize-y border-0 focus-visible:border-transparent"
      />
      {/* Toolbar: one 36 px row, same 12 px inset as the textarea text so the
          image icon lines up with the first character and the button with
          the text's right edge. */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t-2 border-hs-ink/15 px-3 py-2">
        <div className="flex min-h-9 min-w-0 items-center gap-3">
          <label className="inline-flex min-w-0 cursor-pointer items-center gap-2 text-sm font-medium text-hs-navy hover:underline">
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
                if (fileInput.current) {
                  fileInput.current.value = "";
                }
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
          <Button
            size="sm"
            onClick={submit}
            disabled={uploading}
            aria-busy={uploading || undefined}
            className="min-h-9 min-w-[6.5rem] px-4"
          >
            {uploading ? "Subiendo…" : "Publicar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
