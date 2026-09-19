"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useId, useRef, useState } from "react";
import type { OptionGroup } from "@convex/lib/directoryOptions";
import { fold } from "@convex/lib/directoryOptions";
import { cn } from "@/lib/utils";

type Row = { group: string; value: string };

/** Options matching `query` (value or alias), kept in their groups. */
function filterRows(groups: readonly OptionGroup[], query: string): Row[] {
  const rows: Row[] = [];
  for (const group of groups) {
    for (const option of group.options) {
      const names = [option.value, ...(option.aliases ?? [])].map(fold);
      if (!query || names.some((name) => name.includes(query))) {
        rows.push({ group: group.label, value: option.value });
      }
    }
  }
  return rows;
}

/**
 * A multi-select over a curated vocabulary: the chosen values sit as chips in
 * the box, typing filters the grouped list below and Enter, click or Space
 * toggles an entry without closing. No free text: what is not in the list is
 * not a data point, so two people who mean the same thing pick the same value
 * and the graph can connect them.
 */
export function TagPicker({
  id,
  groups,
  value,
  onChange,
  max,
  disabled = false,
  searchPlaceholder = "Buscar…",
}: {
  id: string;
  groups: readonly OptionGroup[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  max: number;
  disabled?: boolean;
  searchPlaceholder?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const full = value.length >= max;
  const rows = filterRows(groups, fold(query));
  const activeIndex = Math.min(active, Math.max(rows.length - 1, 0));
  const showGroups = groups.length > 1;

  useEffect(() => {
    if (open) {
      document
        .querySelector(`[id="${listId}-${activeIndex}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeIndex, listId]);

  function close() {
    setOpen(false);
    setQuery("");
    setActive(0);
  }

  function toggle(tag: string) {
    if (value.includes(tag)) {
      onChange(value.filter((item) => item !== tag));
    } else if (!full) {
      onChange([...value, tag]);
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <Popover.Anchor asChild>
        <div
          className={cn(
            "relative flex min-h-11 w-full cursor-text flex-wrap items-center gap-1.5 border-2 border-hs-ink/25 bg-hs-paper py-1.5 pr-10 pl-2 text-base text-hs-ink",
            "motion-safe:transition-[border-color,box-shadow] motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)]",
            "has-[input:focus-visible]:border-hs-navy has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-hs-navy/25",
            disabled && "cursor-not-allowed opacity-50",
          )}
          onMouseDown={(event) => {
            // Clicking the box (not a chip button) puts the caret in the input.
            if (event.target === event.currentTarget) {
              event.preventDefault();
              inputRef.current?.focus();
              setOpen(true);
            }
          }}
        >
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex h-7 items-center gap-1 border-2 border-hs-ink bg-hs-gold pl-2 text-[13px] leading-none font-semibold select-none"
            >
              {tag}
              <button
                type="button"
                tabIndex={-1}
                aria-label={`Quitar ${tag}`}
                disabled={disabled}
                className="flex h-full w-6 items-center justify-center text-hs-ink/70 hover:text-hs-ink disabled:pointer-events-none"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggle(tag)}
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && rows[activeIndex] ? `${listId}-${activeIndex}` : undefined
            }
            autoComplete="off"
            spellCheck={false}
            placeholder={value.length === 0 ? searchPlaceholder : "Añadir…"}
            value={query}
            disabled={disabled}
            className="h-7 min-w-24 flex-1 bg-transparent outline-none placeholder:text-hs-ink/40"
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              setOpen(true);
            }}
            onBlur={close}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                if (!open) {
                  setOpen(true);
                  return;
                }
                const step = event.key === "ArrowDown" ? 1 : -1;
                setActive((index) =>
                  rows.length === 0 ? 0 : (index + step + rows.length) % rows.length,
                );
              } else if (event.key === "Enter") {
                event.preventDefault();
                const row = rows[activeIndex];
                if (open && row) {
                  toggle(row.value);
                  setQuery("");
                } else {
                  setOpen(true);
                }
              } else if (event.key === "Backspace" && query === "" && value.length > 0) {
                event.preventDefault();
                onChange(value.slice(0, -1));
              } else if (event.key === "Escape" && open) {
                event.preventDefault();
                event.stopPropagation();
                close();
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
          aria-multiselectable
          align="start"
          sideOffset={4}
          collisionPadding={8}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="z-50 max-h-72 w-(--radix-popover-trigger-width) origin-(--radix-popover-content-transform-origin) overflow-y-auto border border-hs-ink/20 bg-hs-paper p-1 text-hs-ink motion-safe:duration-150 motion-safe:ease-[var(--ease-out)] data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95"
        >
          {rows.length === 0 ? (
            <p className="px-2 py-2 text-sm text-hs-brown">Nada con “{query.trim()}”.</p>
          ) : (
            rows.map((row, index) => {
              const selected = value.includes(row.value);
              const blocked = full && !selected;
              const header = showGroups && rows[index - 1]?.group !== row.group;
              return (
                <div key={`${row.group}:${row.value}`}>
                  {header ? (
                    <p
                      className={cn(
                        "px-2 pt-2 pb-1 font-bungee text-[10px] tracking-wide text-hs-brown",
                        index > 0 && "mt-1 border-t border-hs-ink/10",
                      )}
                    >
                      {row.group}
                    </p>
                  ) : null}
                  <div
                    id={`${listId}-${index}`}
                    role="option"
                    tabIndex={-1}
                    aria-selected={selected}
                    aria-disabled={blocked || undefined}
                    data-active={index === activeIndex ? "" : undefined}
                    className={cn(
                      "flex min-h-9 cursor-default items-center gap-2.5 px-2 py-1.5 text-sm select-none data-active:bg-hs-sand",
                      blocked && "opacity-40",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseMove={() => setActive(index)}
                    onClick={() => toggle(row.value)}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center border-2 border-hs-ink/40 bg-hs-paper",
                        selected && "border-hs-ink bg-hs-gold",
                      )}
                    >
                      {selected ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                    <span className={cn(selected && "font-semibold")}>{row.value}</span>
                  </div>
                </div>
              );
            })
          )}
          {full ? (
            <p className="sticky bottom-0 border-t border-hs-ink/10 bg-hs-paper px-2 py-1.5 text-xs text-hs-brown">
              Máximo {max}. Quita una para añadir otra.
            </p>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
