import { useEffect, useRef, useState } from "react";

export function ScoreSlider({
  value,
  disabled,
  onCommit,
}: {
  value: number | null;
  disabled?: boolean;
  onCommit: (score: number) => void;
}) {
  const [draft, setDraft] = useState(value ?? 5);
  const dragging = useRef(false);

  useEffect(() => {
    if (!dragging.current && value !== null) {
      setDraft(value);
    }
  }, [value]);

  const commit = () => {
    dragging.current = false;
    if (disabled) {
      return;
    }
    if (draft !== value) {
      onCommit(draft);
    }
  };

  return (
    <div className="h-[5.25rem]">
      <div className="flex h-8 items-end justify-between gap-3">
        <label htmlFor="judge-score" className="font-bungee text-xs uppercase">
          Tu nota
        </label>
        <p className="font-bungee text-2xl leading-none tabular-nums">
          <span className="inline-block min-w-[2ch] text-right">{draft}</span>
          <span className="text-hs-brown">/10</span>
        </p>
      </div>
      <input
        id="judge-score"
        type="range"
        min={1}
        max={10}
        step={1}
        value={draft}
        disabled={disabled}
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={draft}
        aria-label="Puntuación del 1 al 10"
        className="mt-2 h-11 w-full cursor-pointer accent-hs-gold disabled:cursor-not-allowed disabled:opacity-50"
        onPointerDown={() => {
          dragging.current = true;
        }}
        onInput={(event) => {
          setDraft(Number(event.currentTarget.value));
        }}
        onPointerUp={commit}
        onBlur={commit}
        onKeyUp={(event) => {
          if (
            event.key === "ArrowLeft" ||
            event.key === "ArrowRight" ||
            event.key === "ArrowUp" ||
            event.key === "ArrowDown" ||
            event.key === "Home" ||
            event.key === "End"
          ) {
            commit();
          }
        }}
      />
    </div>
  );
}
