"use client";

import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useId, useRef, useState } from "react";
import type { ComponentProps, KeyboardEvent } from "react";
import { api } from "@convex/_generated/api";
import { mentionQueryAt, mentionSegments, mentionsInText } from "@convex/lib/feedSocial";
import type { Mention } from "@convex/lib/feedSocial";
import { Avatar } from "@/components/avatar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Person = FunctionReturnType<typeof api.feedSocial.mentionable>[number];

const SHOWN = 6;

function fold(value: string): string {
  return value.normalize("NFD").replaceAll(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Names that start with the query first, then names where any word does. */
function matchPeople(people: Person[], query: string): Person[] {
  const needle = fold(query.trim());
  if (!needle) { return people.slice(0, SHOWN); }
  const starts = [];
  const words = [];
  for (const person of people) {
    const name = fold(person.name);
    if (name.startsWith(needle)) { starts.push(person); }
    else if (name.split(/\s+/).some((word) => word.startsWith(needle))) { words.push(person); }
  }
  return [...starts, ...words].slice(0, SHOWN);
}

/** Text with each `@name` it carries set apart; `meId` marks the ones that tag the viewer. */
export function MentionText({ text, mentions, meId, className }: { text: string; mentions: Mention[] | undefined; meId?: string; className?: string }) {
  return (
    <p className={className}>
      {mentionSegments(text, mentions ?? []).map((segment, index) =>
        segment.mention ? (
          // eslint-disable-next-line react/no-array-index-key -- segments have no identity beyond their place in the text
          <span key={index} className={cn("font-semibold text-hs-navy", segment.mention.userId === meId && "bg-hs-gold px-0.5 text-hs-ink")}>{segment.text}</span>
        ) : segment.text,
      )}
    </p>
  );
}

/**
 * A textarea that offers people after an `@`. The text stays plain (`@Name`);
 * who each name is travels next to it in `mentions`, already pruned to the
 * names still written.
 */
export function MentionTextarea({
  value,
  mentions,
  onChange,
  maxLength,
  onKeyDown,
  className,
  ...props
}: Omit<ComponentProps<typeof Textarea>, "value" | "onChange"> & {
  value: string;
  mentions: Mention[];
  onChange: (value: string, mentions: Mention[]) => void;
}) {
  const convex = useConvex();
  const listId = useId();
  const field = useRef<HTMLTextAreaElement | null>(null);
  const [people, setPeople] = useState<Person[]>();
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<number>();
  const requested = useRef(false);

  const typing = mentionQueryAt(value, caret);
  // A name already picked, with its trailing space, is a finished mention and not a search.
  const finished = typing !== null && mentions.some((mention) => typing.query.startsWith(`${mention.name} `));
  const open = typing !== null && !finished && typing.start !== dismissed;
  const options = open && people ? matchPeople(people, typing.query) : [];
  const current = Math.min(active, Math.max(0, options.length - 1));

  function loadPeople() {
    if (requested.current) { return; }
    requested.current = true;
    // One fetch per mounted field: the list is long-lived and any profile edit would rerun a subscription.
    convex.query(api.feedSocial.mentionable, {}).then(setPeople).catch(() => { requested.current = false; });
  }

  function change(next: string, nextCaret: number) {
    const clipped = maxLength === undefined ? next : next.slice(0, maxLength);
    setCaret(Math.min(nextCaret, clipped.length));
    setActive(0);
    if (mentionQueryAt(clipped, nextCaret)) { loadPeople(); }
    onChange(clipped, mentionsInText(clipped, mentions));
  }

  function pick(person: Person) {
    if (!typing) { return; }
    const inserted = `@${person.name} `;
    const next = value.slice(0, typing.start) + inserted + value.slice(caret);
    const clipped = maxLength === undefined ? next : next.slice(0, maxLength);
    const nextCaret = Math.min(typing.start + inserted.length, clipped.length);
    setCaret(nextCaret);
    onChange(clipped, mentionsInText(clipped, [...mentions, { name: person.name, userId: person._id }]));
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (open && options.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setActive((current + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        pick(options[current]);
        return;
      }
    }
    if (open && event.key === "Escape") {
      event.preventDefault();
      setDismissed(typing.start);
      return;
    }
    onKeyDown?.(event);
  }

  return (
    <div className="relative min-w-0">
      <Textarea
        {...props}
        ref={field}
        value={value}
        className={className}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-activedescendant={open && options.length > 0 ? `${listId}-${current}` : undefined}
        onChange={(event) => change(event.target.value, event.target.selectionStart)}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onKeyDown={keyDown}
        onBlur={() => setDismissed(typing?.start)}
      />
      {open && (options.length > 0 || !people) ? (
        <ul id={listId} role="listbox" aria-label="Mencionar a alguien"
          className="absolute top-full left-0 z-30 mt-1 max-h-64 w-72 max-w-full overflow-y-auto border-[3px] border-hs-ink bg-hs-paper shadow-[4px_4px_0_var(--color-hs-ink)]">
          {people ? options.map((person, index) => (
            <li key={person._id} id={`${listId}-${index}`} role="option" aria-selected={index === current}
              // Mouse down, not click: the field must not blur before the pick lands.
              onMouseDown={(event) => { event.preventDefault(); pick(person); }}
              onMouseEnter={() => setActive(index)}
              className={cn("flex min-h-10 cursor-pointer items-center gap-2 px-2 py-1.5 text-sm", index === current && "bg-hs-gold")}>
              <Avatar name={person.name} src={person.avatarUrl} className="size-7 border-2 text-[10px]" />
              <span className="min-w-0 truncate font-medium">{person.name}</span>
            </li>
          )) : <li className="px-3 py-2 text-sm text-hs-brown">Buscando gente…</li>}
        </ul>
      ) : null}
    </div>
  );
}
