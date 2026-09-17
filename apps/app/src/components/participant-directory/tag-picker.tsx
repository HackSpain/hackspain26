"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import type { OptionGroup } from "@convex/lib/directoryOptions";
import { fold } from "@convex/lib/directoryOptions";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Chips from a curated vocabulary, so two people who mean the same thing
 * pick the same value and the graph can connect them. No free text: what is
 * not in the list is not a data point. A filter box appears past ~20 chips.
 */
export function TagPicker({
  id,
  groups,
  value,
  onChange,
  max,
  disabled = false,
}: {
  id: string;
  groups: readonly OptionGroup[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  max: number;
  disabled?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const total = groups.reduce((n, group) => n + group.options.length, 0);
  const query = fold(filter);
  const full = value.length >= max;

  function toggle(tag: string) {
    if (value.includes(tag)) {
      onChange(value.filter((item) => item !== tag));
    } else if (!full) {
      onChange([...value, tag]);
    }
  }

  return (
    <div className="space-y-3" id={id}>
      {total > 20 ? (
        <Input
          aria-label="Filtrar"
          placeholder="Filtrar…"
          value={filter}
          disabled={disabled}
          onChange={(event) => setFilter(event.target.value)}
        />
      ) : null}
      {groups.map((group) => {
        const options = group.options.filter(
          (option) =>
            !query ||
            fold(option.value).includes(query) ||
            option.aliases?.some((alias) => fold(alias).includes(query)) ||
            value.includes(option.value)
        );
        if (options.length === 0) {
          return null;
        }
        return (
          <div key={group.label} className="space-y-1.5">
            {groups.length > 1 ? (
              <p className="text-xs font-semibold text-hs-brown">{group.label}</p>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              {options.map((option) => {
                const selected = value.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    disabled={disabled || (full && !selected)}
                    onClick={() => toggle(option.value)}
                    className={cn(
                      "inline-flex min-h-9 items-center gap-1 border-2 px-2.5 text-sm motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      selected
                        ? "border-hs-ink bg-hs-gold text-hs-ink"
                        : "border-hs-ink/25 bg-hs-paper text-hs-ink hover:border-hs-ink"
                    )}
                  >
                    {selected ? <Check className="size-3.5" aria-hidden /> : null}
                    {option.value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-hs-brown">
        {value.length} de {max}
        {full ? " · has llegado al máximo" : ""}
      </p>
    </div>
  );
}
