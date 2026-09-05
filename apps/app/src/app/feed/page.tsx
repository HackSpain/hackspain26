"use client";

import { useMutation, useQuery } from "convex/react";
import { GitBranch, ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { FormError, LoadingText, Page, errorMessage } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type Post = FunctionReturnType<typeof api.feed.list>[number];

const MAX_TEXT = 500;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function timeAgo(at: number, now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  const seconds = Math.round((at - now) / 1000);
  if (Math.abs(seconds) < 60) return "ahora mismo";
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return new Date(at).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Composer() {
  const post = useMutation(api.feed.post);
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
    try {
      let imageId: string | undefined;
      if (file) {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!response.ok) throw new Error("No se pudo subir la imagen");
        imageId = ((await response.json()) as { storageId: string }).storageId;
      }
      await post({
        text,
        imageId: imageId as Parameters<typeof post>[0]["imageId"],
      });
      setText("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (err) {
      setError(errorMessage(err, "No se pudo publicar"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT))}
          placeholder="¿En qué estáis? Un avance, una foto del equipo, una demo que funciona…"
          rows={3}
          aria-label="Nueva publicación"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-hs-navy hover:underline">
              <ImagePlus className="size-4" aria-hidden />
              {file ? file.name : "Añadir imagen"}
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
                className="text-xs text-hs-brown underline"
                onClick={() => {
                  setFile(null);
                  if (fileInput.current) fileInput.current.value = "";
                }}
              >
                quitar
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <span
              className={
                remaining < 40 ? "text-xs text-hs-red" : "text-xs text-hs-brown"
              }
            >
              {remaining}
            </span>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Publicando…" : "Publicar"}
            </Button>
          </div>
        </div>
        <FormError message={error} />
      </CardContent>
    </Card>
  );
}

function PostCard({ post }: { post: Post }) {
  const remove = useMutation(api.feed.remove);
  const [busy, setBusy] = useState(false);
  const isGithub = post.kind === "github";
  const who = isGithub
    ? (post.teamName ?? post.github?.repo ?? "GitHub")
    : (post.author?.name ?? post.author?.email ?? "Alguien");

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {isGithub ? (
              <Badge variant="gold" className="gap-1">
                <GitBranch className="size-3" aria-hidden /> GitHub
              </Badge>
            ) : null}
            <span className="font-semibold">{who}</span>
            {!isGithub && post.teamName ? (
              <span className="text-hs-brown">· {post.teamName}</span>
            ) : null}
            {isGithub && post.github ? (
              <span className="text-hs-brown">· {post.github.repo}</span>
            ) : null}
            <span className="text-hs-brown">· {timeAgo(post.createdAt)}</span>
          </div>
          {post.mine ? (
            <button
              type="button"
              aria-label="Borrar publicación"
              className="text-hs-brown hover:text-hs-red disabled:opacity-50"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await remove({ postId: post._id });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
        {post.text ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {post.text}
          </p>
        ) : null}
        {post.imagePath ? (
          <a href={post.imagePath} target="_blank" rel="noreferrer">
            {/* Served by /api/files on our own origin; plain img keeps it out of next/image's optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imagePath}
              alt=""
              className="max-h-96 w-auto rounded-md border-2 border-hs-ink object-contain"
            />
          </a>
        ) : null}
        {isGithub && post.github ? (
          <a
            href={post.github.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-hs-navy underline-offset-4 hover:underline"
          >
            Ver en GitHub
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function FeedPage() {
  const posts = useQuery(api.feed.list, { limit: 50 });
  return (
    <Page
      title="Feed"
      description="Lo que está pasando en la hackathon: avances, fotos y los pushes de cada equipo. También desde la CLI con hackspain feed y hackspain post."
    >
      <Composer />
      {posts === undefined ? (
        <LoadingText />
      ) : posts.length === 0 ? (
        <p className="text-sm text-hs-brown">
          Todavía no hay nada. Sé el primero en publicar.
        </p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post._id} post={post} />
          ))}
        </div>
      )}
    </Page>
  );
}
