"use client";

import { useEffect, useRef } from "react";
import { TV_PALETTE, type TvWidgetKind } from "@/lib/tv";
import { cn } from "@/lib/utils";

const EDITABLE: readonly TvWidgetKind[] = ["banner", "ticker", "message"];

export function isEditableKind(
  kind: TvWidgetKind,
): kind is "banner" | "ticker" | "message" {
  return EDITABLE.includes(kind);
}

function editLabel(kind: TvWidgetKind) {
  const label = TV_PALETTE.find((item) => item.kind === kind)?.label ?? "caja";
  return `Editar ${label.toLowerCase()}`;
}

export function TvInlineEditor({
  kind,
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  kind: "banner" | "ticker" | "message";
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.select();
  }, []);

  function finish(save: boolean) {
    if (done.current) return;
    done.current = true;
    if (save) onCommit();
    else onCancel();
  }

  const multiline = kind === "message";

  return (
    <div
      className={cn(
        "flex h-full min-h-0",
        kind === "banner" && "items-center bg-hs-ink px-4",
        kind === "ticker" && "items-center bg-hs-gold px-4",
        kind === "message" &&
          "items-center border-[3px] border-hs-gold/40 bg-hs-paper/5 p-4",
      )}
    >
      <textarea
        ref={fieldRef}
        aria-label={editLabel(kind)}
        value={value}
        rows={multiline ? 4 : 1}
        spellCheck
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => finish(true)}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            finish(false);
            return;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            finish(true);
          }
        }}
        className={cn(
          "h-full w-full resize-none border-0 bg-transparent p-0 outline-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hs-ink",
          kind === "banner" &&
            "text-center font-bungee text-[clamp(1.1rem,4cqw,4.5rem)] leading-tight text-balance text-hs-gold uppercase",
          kind === "ticker" &&
            "font-bungee text-[clamp(0.9rem,2.6cqw,2rem)] text-hs-ink uppercase",
          kind === "message" &&
            "whitespace-pre-wrap break-words text-[clamp(0.85rem,2.2cqw,1.75rem)] leading-snug text-pretty text-hs-paper",
        )}
      />
    </div>
  );
}
