import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function ScoreSlider({
  value,
  disabled,
  onCommit,
}: {
  value: number | null;
  disabled?: boolean;
  onCommit: (score: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }
  const groupId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const pick = (score: number) => {
    if (disabled) {
      return;
    }
    setDraft(score);
    if (score !== value) {
      onCommit(score);
    }
    rootRef.current
      ?.querySelector<HTMLElement>(`[data-score="${score}"]`)
      ?.focus();
  };

  return (
    <div>
      <div className="flex h-8 items-end justify-between gap-3">
        <p className="font-bungee text-xs uppercase" id={groupId}>
          Tu nota
        </p>
        <p className="font-bungee text-2xl leading-none tabular-nums">
          <span className="inline-block min-w-[2ch] text-right">
            {draft ?? "—"}
          </span>
          <span className="text-hs-brown">/10</span>
        </p>
      </div>
      <div
        ref={rootRef}
        role="radiogroup"
        tabIndex={-1}
        aria-labelledby={groupId}
        className="mt-2 grid grid-cols-5 gap-1 sm:grid-cols-10"
        onKeyDown={(event) => {
          if (disabled) {
            return;
          }
          const from = draft ?? 0;
          if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            pick(Math.min(10, from === 0 ? 1 : from + 1));
            return;
          }
          if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            pick(Math.max(1, from === 0 ? 10 : from - 1));
            return;
          }
          if (event.key === "Home") {
            event.preventDefault();
            pick(1);
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            pick(10);
          }
        }}
      >
        {SCORES.map((score) => {
          const selected = draft === score;
          return (
            <button
              key={score}
              type="button"
              role="radio"
              data-score={score}
              tabIndex={selected || (draft === null && score === 1) ? 0 : -1}
              aria-checked={selected}
              aria-label={`${score} de 10`}
              disabled={disabled}
              className={cn(
                "min-h-11 border-[3px] border-hs-ink font-bungee text-sm tabular-nums outline-none select-none",
                "motion-safe:transition-[transform,background-color] motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:not-disabled:scale-[0.96]",
                "focus-visible:border-hs-navy disabled:cursor-not-allowed disabled:opacity-50",
                selected
                  ? "bg-hs-gold text-hs-ink"
                  : "bg-hs-paper text-hs-ink [@media(hover:hover)_and_(pointer:fine)]:hover:bg-hs-sand",
              )}
              onClick={() => pick(score)}
            >
              {score}
            </button>
          );
        })}
      </div>
    </div>
  );
}
