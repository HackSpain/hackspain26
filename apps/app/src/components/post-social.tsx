"use client";

import { useMutation, useQuery } from "convex/react";
import { MessageSquare, SmilePlus, Trash2 } from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MAX_COMMENT_TEXT, SUGGESTED_REACTIONS, normalizeEmoji } from "@convex/lib/feedSocial";
import type { Mention } from "@convex/lib/feedSocial";
import { Avatar } from "@/components/avatar";
import { MentionText, MentionTextarea } from "@/components/mention-textarea";
import { errorMessage } from "@/components/page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A wider pick below the suggested row. Anything else goes through the text field. */
const MORE_REACTIONS = [
  "😀", "😅", "🤣", "😍", "🤩", "😎", "🤔", "🫠", "😴", "😭", "😱", "🤯", "🥳", "🤝", "👏", "🙌",
  "🙏", "💪", "🧠", "👑", "💯", "✅", "❌", "⚡", "✨", "🌶️", "☕", "🍕", "🍺", "🏆", "🥇", "🎯",
  "🐛", "🤖", "💻", "🧪", "📈", "🛠️", "🧨", "🇪🇸",
];

const PILL = "inline-flex h-8 min-w-11 items-center justify-center gap-1.5 border-2 px-2 text-sm tabular-nums outline-none motion-safe:transition-[background-color,border-color,transform] motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] focus-visible:border-hs-navy active:scale-[0.96]";

function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  function pick(emoji: string) {
    setOpen(false);
    setCustom("");
    onPick(emoji);
  }

  function submitCustom(event: FormEvent) {
    event.preventDefault();
    const emoji = normalizeEmoji(custom);
    if (!emoji) {
      toast.error("Pega o escribe un solo emoji.", { id: "reaction-invalid" });
      return;
    }
    pick(emoji);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" aria-label="Añadir reacción"
          className={cn(PILL, "border-hs-ink/25 bg-hs-paper text-hs-brown [@media(hover:hover)_and_(pointer:fine)]:hover:border-hs-ink [@media(hover:hover)_and_(pointer:fine)]:hover:text-hs-ink")}>
          <SmilePlus className="size-4" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} collisionPadding={12}
          className="z-50 w-[19rem] max-w-[calc(100vw-1.5rem)] origin-[var(--radix-popover-content-transform-origin)] border-[3px] border-hs-ink bg-hs-paper p-3 shadow-[4px_4px_0_var(--color-hs-ink)] hs-enter">
          <div className="grid grid-cols-8 gap-1" role="group" aria-label="Reacciones sugeridas">
            {SUGGESTED_REACTIONS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => pick(emoji)} aria-label={`Reaccionar con ${emoji}`}
                className="flex aspect-square items-center justify-center bg-hs-gold/40 text-xl outline-none focus-visible:ring-2 focus-visible:ring-hs-navy active:scale-[0.92] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-hs-gold">
                {emoji}
              </button>
            ))}
          </div>
          <div className="mt-2 grid max-h-36 grid-cols-8 gap-1 overflow-y-auto border-t-2 border-hs-ink/15 pt-2" role="group" aria-label="Más reacciones">
            {MORE_REACTIONS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => pick(emoji)} aria-label={`Reaccionar con ${emoji}`}
                className="flex aspect-square items-center justify-center text-xl outline-none focus-visible:ring-2 focus-visible:ring-hs-navy active:scale-[0.92] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-hs-sand">
                {emoji}
              </button>
            ))}
          </div>
          <form onSubmit={submitCustom} className="mt-2 flex items-center gap-2 border-t-2 border-hs-ink/15 pt-2">
            <label className="min-w-0 flex-1 text-xs font-medium text-hs-brown">
              Cualquier otro emoji
              <input value={custom} onChange={(event) => setCustom(event.target.value)} inputMode="text" autoComplete="off" placeholder="Pega o escribe uno"
                className="mt-1 block h-9 w-full border-2 border-hs-ink/25 bg-hs-paper px-2 text-base text-hs-ink outline-none placeholder:text-hs-ink/40 focus-visible:border-hs-navy" />
            </label>
            <Button type="submit" size="sm" className="mt-5 h-9 shrink-0">Reaccionar</Button>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function timeOf(at: number): string {
  return new Date(at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function Comments({ postId, meId }: { postId: Id<"posts">; meId: Id<"users"> | undefined }) {
  const comments = useQuery(api.feedSocial.comments, { postId });
  const add = useMutation(api.feedSocial.addComment);
  const remove = useMutation(api.feedSocial.removeComment);
  const [draft, setDraft] = useState<{ text: string; mentions: Mention[] }>({ mentions: [], text: "" });
  const [sending, setSending] = useState(false);

  async function submit() {
    const text = draft.text.trim();
    if (!text || sending) { return; }
    setSending(true);
    try {
      await add({ mentions: draft.mentions, postId, text });
      setDraft({ mentions: [], text: "" });
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo comentar"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3 border-t-2 border-hs-ink/15 pt-3">
      {comments === undefined ? <p className="text-sm text-hs-brown">Cargando comentarios…</p> : null}
      {comments && comments.length > 0 ? (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment._id} className="group flex min-w-0 items-start gap-2">
              <Avatar name={comment.author.name} src={comment.author.avatarUrl} className="size-7 border-2 text-[10px]" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm leading-5">
                  <span className="font-semibold break-words">{comment.author.name ?? "Alguien"}</span>
                  <span className="text-xs text-hs-brown">{timeOf(comment.createdAt)}</span>
                </p>
                <MentionText text={comment.text} mentions={comment.mentions} meId={meId} className="text-pretty whitespace-pre-wrap break-words text-sm leading-relaxed" />
              </div>
              {comment.canRemove ? (
                <button type="button" aria-label="Borrar comentario"
                  onClick={() => { remove({ commentId: comment._id }).catch((error: unknown) => toast.error(errorMessage(error, "No se pudo borrar"))); }}
                  className="-m-1.5 flex size-9 shrink-0 items-center justify-center text-hs-brown outline-none focus-visible:ring-2 focus-visible:ring-hs-navy [@media(hover:hover)_and_(pointer:fine)]:hover:text-hs-red">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex min-w-0 items-end gap-2">
        <div className="min-w-0 flex-1">
          <MentionTextarea
            value={draft.text}
            mentions={draft.mentions}
            onChange={(text, mentions) => setDraft({ mentions, text })}
            maxLength={MAX_COMMENT_TEXT}
            rows={1}
            placeholder="Comenta, o menciona a alguien con @"
            aria-label="Nuevo comentario"
            className="min-h-10 resize-none py-1.5 [field-sizing:content]"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void submit();
              }
            }}
          />
        </div>
        <Button size="sm" className="h-10 shrink-0" onClick={() => void submit()} disabled={!draft.text.trim()}>Enviar</Button>
      </div>
    </div>
  );
}

/** Reactions, the comment toggle and the thread under one feed card. */
export function PostSocial({ postId, meId }: { postId: Id<"posts">; meId: Id<"users"> | undefined }) {
  const social = useQuery(api.feedSocial.forPost, { postId });
  const [threadOpen, setThreadOpen] = useState(false);
  const toggle = useMutation(api.feedSocial.toggleReaction).withOptimisticUpdate((localStore, args) => {
    const now = localStore.getQuery(api.feedSocial.forPost, { postId: args.postId });
    if (!now) { return; }
    const mine = now.reactions.find((reaction) => reaction.emoji === args.emoji);
    let reactions;
    if (mine?.mine) {
      reactions = now.reactions.map((reaction) => (reaction === mine ? { ...mine, count: mine.count - 1, mine: false } : reaction)).filter((reaction) => reaction.count > 0);
    } else if (mine) {
      reactions = now.reactions.map((reaction) => (reaction === mine ? { ...mine, count: mine.count + 1, mine: true } : reaction));
    } else {
      reactions = [...now.reactions, { count: 1, emoji: args.emoji, mine: true }];
    }
    localStore.setQuery(api.feedSocial.forPost, { postId: args.postId }, { ...now, reactions });
  });

  function react(emoji: string) {
    toggle({ emoji, postId }).catch((error: unknown) => toast.error(errorMessage(error, "No se pudo reaccionar"), { id: "reaction-failed" }));
  }

  const count = social?.commentCount ?? 0;
  return (
    <div className="space-y-3">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {social?.reactions.map((reaction) => (
          <button key={reaction.emoji} type="button" aria-pressed={reaction.mine} onClick={() => react(reaction.emoji)}
            aria-label={`${reaction.emoji}, ${reaction.count} ${reaction.count === 1 ? "reacción" : "reacciones"}${reaction.mine ? ", la tuya incluida" : ""}`}
            className={cn(PILL, reaction.mine
              ? "border-hs-navy bg-hs-slate/40 font-semibold text-hs-navy"
              : "border-hs-ink/25 bg-hs-paper text-hs-ink [@media(hover:hover)_and_(pointer:fine)]:hover:border-hs-ink")}>
            <span className="text-base leading-none">{reaction.emoji}</span>{reaction.count}
          </button>
        ))}
        <ReactionPicker onPick={react} />
        <button type="button" aria-expanded={threadOpen} onClick={() => setThreadOpen((value) => !value)}
          className={cn(PILL, "ml-auto border-transparent px-2 font-medium text-hs-navy [@media(hover:hover)_and_(pointer:fine)]:hover:underline")}>
          <MessageSquare className="size-4" aria-hidden />
          {count === 0 ? "Comentar" : `${count} ${count === 1 ? "comentario" : "comentarios"}`}
        </button>
      </div>
      {threadOpen ? <Comments postId={postId} meId={meId} /> : null}
    </div>
  );
}
