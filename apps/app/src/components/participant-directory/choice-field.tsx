"use client";

import { useState } from "react";
import type { Option } from "@convex/lib/directoryOptions";
import { isOption, OTHER } from "@convex/lib/directoryOptions";
import { Field } from "@/components/page";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

/**
 * A dropdown over a curated list with an "Otra…" escape hatch that reveals a
 * text box. The value is always the plain string the card stores; the server
 * folds free text onto the list when it recognises it.
 */
export function ChoiceField({
  id,
  label,
  hint,
  options,
  value,
  onChange,
  placeholder,
  otherLabel,
  otherPlaceholder,
  noneLabel,
  allowOther = true,
  disabled = false,
}: {
  id: string;
  label: string;
  hint?: string;
  options: readonly Option[];
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  otherLabel?: string;
  otherPlaceholder?: string;
  /** When set, an entry that clears the field (optional fields). */
  noneLabel?: string;
  /** False for closed lists (the role): no "Otra…" entry, no text box. */
  allowOther?: boolean;
  disabled?: boolean;
}) {
  const [other, setOther] = useState(
    () => value !== "" && !isOption(options, value)
  );
  const selected = other ? OTHER : value;

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Select
        value={selected}
        disabled={disabled}
        onValueChange={(next) => {
          if (next === OTHER) {
            setOther(true);
            onChange("");
            return;
          }
          setOther(false);
          onChange(next === NONE ? "" : next);
        }}
      >
        <SelectTrigger id={id} aria-label={label}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {noneLabel ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.value}
            </SelectItem>
          ))}
          {allowOther ? <SelectItem value={OTHER}>{otherLabel}</SelectItem> : null}
        </SelectContent>
      </Select>
      {other && allowOther ? (
        <Input
          id={`${id}-other`}
          aria-label={otherLabel}
          autoFocus
          maxLength={80}
          placeholder={otherPlaceholder}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
    </Field>
  );
}
