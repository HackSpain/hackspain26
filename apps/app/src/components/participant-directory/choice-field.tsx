"use client";

import { ChevronDown } from "lucide-react";
import { Popover } from "radix-ui";
import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import type { Option } from "@convex/lib/directoryOptions";
import { canonical, canonicalOrText, fold } from "@convex/lib/directoryOptions";
import { Field } from "@/components/page";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 40;

type Item = { kind: "option"; value: string } | { kind: "custom"; text: string };

/** Prefix matches first, then anything containing the query (value or alias). */
function filterOptions(options: readonly Option[], query: string): Option[] {
  if (!query) {
    return [...options];
  }
  const starts: Option[] = [];
  const contains: Option[] = [];
  for (const option of options) {
    const names = [option.value, ...(option.aliases ?? [])].map(fold);
    if (names.some((name) => name.startsWith(query))) {
      starts.push(option);
    } else if (names.some((name) => name.includes(query))) {
      contains.push(option);
    }
  }
  return [...starts, ...contains];
}

/**
 * A combobox over a curated list: type to filter, pick with the keyboard or
 * the mouse. With `allowOther`, text that matches nothing is kept as-is (the
 * old "Otra…" path), so a city we do not list is still a valid answer. The
 * value is always the plain string the card stores; typed aliases ("UPM")
 * fold onto the curated spelling on commit.
 */
export function ChoiceField({
  id,
  label,
  hint,
  meta,
  options,
  value,
  onChange,
  placeholder,
  allowOther = true,
  disabled = false,
}: {
  id: string;
  label: string;
  hint?: string;
  meta?: ReactNode;
  options: readonly Option[];
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** False for closed lists (the role): typed text must match an entry. */
  allowOther?: boolean;
  disabled?: boolean;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  // null while not editing: the input shows `value`.
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const text = query ?? value;
  // Before any typing the whole list shows, with the current value marked.
  const folded = fold(query ?? "");
  const matches = filterOptions(options, folded).slice(0, MAX_VISIBLE);
  const custom =
    allowOther && folded !== "" && canonical(options, text) === undefined
      ? text.trim().replaceAll(/\s+/g, " ")
      : null;
  const items: Item[] = [
    ...(custom ? [{ kind: "custom", text: custom } as const] : []),
    ...matches.map((option) => ({ kind: "option", value: option.value }) as const),
  ];
  const activeIndex = Math.min(active, Math.max(items.length - 1, 0));

  // Keep the highlighted row in view while the list is open.
  useEffect(() => {
    if (open) {
      document
        .querySelector(`[id="${listId}-${activeIndex}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeIndex, listId]);

  /** Start the highlight on the current value, or at the top. */
  function openList() {
    setOpen(true);
    const current =
      value === "" ? -1 : options.findIndex((option) => option.value === value);
    setActive(Math.max(current, 0));
  }

  function close() {
    setOpen(false);
    setQuery(null);
    setActive(0);
  }

  /** Turn whatever is typed into a stored value, or fall back to the last one. */
  function commit(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      onChange("");
    } else {
      const curated = canonical(options, trimmed);
      if (curated !== undefined) {
        onChange(curated);
      } else if (allowOther) {
        onChange(canonicalOrText(options, trimmed) ?? "");
      }
    }
    close();
  }

  function pick(item: Item) {
    onChange(item.kind === "option" ? item.value : item.text);
    close();
  }

  return (
    <Field label={label} htmlFor={id} hint={hint} meta={meta}>
      <Popover.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <Popover.Anchor asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              id={id}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                open && items[activeIndex] ? `${listId}-${activeIndex}` : undefined
              }
              autoComplete="off"
              spellCheck={false}
              maxLength={80}
              placeholder={placeholder}
              value={text}
              disabled={disabled}
              className="pr-10"
              onFocus={(event) => {
                openList();
                event.currentTarget.select();
              }}
              onClick={() => {
                if (!open) {
                  openList();
                }
              }}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
                setOpen(true);
              }}
              onBlur={() => {
                if (query !== null) {
                  commit(query);
                } else {
                  close();
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  if (!open) {
                    openList();
                    return;
                  }
                  const step = event.key === "ArrowDown" ? 1 : -1;
                  setActive((index) =>
                    items.length === 0 ? 0 : (index + step + items.length) % items.length,
                  );
                } else if (event.key === "Enter") {
                  if (!open) {
                    return;
                  }
                  event.preventDefault();
                  const item = items[activeIndex];
                  if (item) {
                    pick(item);
                  } else {
                    commit(text);
                  }
                } else if (event.key === "Escape" && open) {
                  event.preventDefault();
                  event.stopPropagation();
                  close();
                } else if (event.key === "Tab" && query !== null) {
                  commit(query);
                }
              }}
            />
            <button
              type="button"
              tabIndex={-1}
              aria-label={open ? "Cerrar la lista" : "Abrir la lista"}
              disabled={disabled}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-hs-brown disabled:opacity-50"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (open) {
                  close();
                } else {
                  inputRef.current?.focus();
                }
              }}
            >
              <ChevronDown
                className={cn(
                  "size-4 motion-safe:transition-transform motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)]",
                  open && "rotate-180",
                )}
                aria-hidden
              />
            </button>
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            id={listId}
            role="listbox"
            align="start"
            sideOffset={4}
            collisionPadding={8}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            className="z-50 max-h-64 w-(--radix-popover-trigger-width) origin-(--radix-popover-content-transform-origin) overflow-y-auto border border-hs-ink/20 bg-hs-paper p-1 text-hs-ink motion-safe:duration-150 motion-safe:ease-[var(--ease-out)] data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95"
          >
            {items.length === 0 ? (
              <p className="px-2 py-2 text-sm text-hs-brown">
                {allowOther ? "Escribe para añadirla." : "Nada con ese nombre."}
              </p>
            ) : (
              items.map((item, index) => {
                const key = item.kind === "option" ? item.value : `custom:${item.text}`;
                const selected = item.kind === "option" && item.value === value;
                return (
                  <div
                    key={key}
                    id={`${listId}-${index}`}
                    role="option"
                    tabIndex={-1}
                    aria-selected={selected}
                    data-active={index === activeIndex ? "" : undefined}
                    className={cn(
                      "flex min-h-10 cursor-default items-center gap-1.5 px-2 py-2 text-sm select-none data-active:bg-hs-sand",
                      selected && "font-semibold",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseMove={() => setActive(index)}
                    onClick={() => pick(item)}
                  >
                    {item.kind === "option" ? (
                      item.value
                    ) : (
                      <>
                        <span className="text-hs-brown">Usar</span>
                        <span className="font-semibold">«{item.text}»</span>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </Field>
  );
}
