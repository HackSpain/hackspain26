"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TV_FONT_SIZE_OPTIONS,
  TV_FONT_WEIGHT_OPTIONS,
  TV_PALETTE,
  defaultTvFontSize,
  defaultTvFontWeight,
  isTvFontSize,
  isTvFontWeight,
  layoutTvBox,
  tvHasBackground,
} from "@/lib/tv";
import type { TvWidget, TvWidgetKind } from "@/lib/tv";
import { FeedEditor } from "./feed-box";
import { isEditableKind } from "./inline-edit";
import { widgetLabel } from "./preview";
import { SponsorEditor } from "./sponsor-editor";

export type TvInspectorMode = "add" | "edit" | "empty";

const PALETTE_GROUPS = [
  ["tv", "Pantalla"],
  ["live", "En vivo"],
  ["sponsors", "Sponsors"],
  ["insights", "Insights"],
] as const;

export function TvInspector({
  widget,
  mode,
  pending = false,
  onAdd,
  onPatch,
  onDelete,
}: {
  widget: TvWidget | null;
  mode: TvInspectorMode;
  pending?: boolean;
  onAdd: (kind: TvWidgetKind) => void;
  onPatch: (id: string, patch: Partial<TvWidget>) => void;
  onDelete: (id: string) => void;
}) {
  if (mode === "add") {
    return (
      <aside className="flex h-full max-h-80 min-h-0 flex-col overflow-hidden border-[3px] border-hs-ink bg-hs-paper lg:max-h-none">
        <div className="shrink-0 border-b-[3px] border-hs-ink bg-hs-sand px-4 py-3">
          <p className="font-bungee text-sm">Añadir caja</p>
          <p className="mt-1 text-xs text-hs-brown">
            Elige un tipo para la pantalla.
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4">
          {PALETTE_GROUPS.map(([group, label]) => (
            <div key={group}>
              <p className="mb-2 font-bungee text-xs">{label}</p>
              <div className="grid grid-cols-2 gap-2">
                {TV_PALETTE.filter((item) => item.group === group).map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    disabled={pending}
                    onClick={() => onAdd(item.kind)}
                    className="border-[3px] border-hs-ink bg-hs-paper px-2.5 py-2 text-left outline-none motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.96] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-hs-sand/60 focus-visible:border-hs-navy disabled:opacity-50"
                  >
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="mt-0.5 block text-[11px] text-hs-brown">
                      {item.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    );
  }

  if (mode === "empty" || !widget) {
    return (
      <aside className="flex h-full max-h-80 min-h-0 flex-col overflow-hidden border-[3px] border-hs-ink bg-hs-paper p-4 lg:max-h-none">
        <p className="font-bungee text-sm">Inspector</p>
        <p className="mt-2 text-sm text-hs-brown">
          Selecciona una caja para moverla, escribir o cambiar su contenido.
          Pulsa + para añadir una.
        </p>
      </aside>
    );
  }

  return (
    <aside className="flex h-full max-h-80 min-h-0 flex-col overflow-hidden border-[3px] border-hs-ink bg-hs-paper lg:max-h-none">
      <div className="shrink-0 border-b-[3px] border-hs-ink bg-hs-sand px-4 py-3">
        <p className="font-bungee text-sm">{widgetLabel(widget.kind)}</p>
        <p className="mt-1 text-xs text-hs-brown tabular-nums">
          {Math.round(widget.x)}×{Math.round(widget.y)} · {Math.round(widget.w)}×
          {Math.round(widget.h)}
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
        {isEditableKind(widget.kind) ? (
          <TextFields
            key={widget._id}
            widget={widget}
            onPatch={onPatch}
          />
        ) : null}
        {widget.kind === "clock" ? (
          <FontSizeField
            key={`${widget._id}-size`}
            widget={widget}
            onPatch={onPatch}
          />
        ) : null}
        {widget.kind === "feed" ? (
          <FeedEditor
            key={widget._id}
            mode={widget.feedMode}
            source={widget.feedSource}
            onSave={(next) =>
              onPatch(widget._id, {
                feedMode: next.feedMode,
                feedSource: next.feedSource,
              })
            }
          />
        ) : null}
        {widget.kind === "sponsorGrid" || widget.kind === "sponsorTicker" ? (
          <SponsorEditor
            key={widget._id}
            sponsors={widget.sponsors ?? []}
            tickerSpeed={widget.tickerSpeed}
            showSpeed={widget.kind === "sponsorTicker"}
            onSave={(next) =>
              onPatch(widget._id, {
                sponsors: next.sponsors,
                tickerSpeed: next.tickerSpeed,
              })
            }
          />
        ) : null}
        <GeometryFields
          key={`${widget._id}-box`}
          widget={widget}
          onPatch={onPatch}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full border-hs-red text-hs-red"
          onClick={() => onDelete(widget._id)}
        >
          Borrar caja
        </Button>
      </div>
    </aside>
  );
}

function TextFields({
  widget,
  onPatch,
}: {
  widget: TvWidget;
  onPatch: (id: string, patch: Partial<TvWidget>) => void;
}) {
  const [text, setText] = useState(widget.text);
  const [seen, setSeen] = useState(widget.text);
  if (widget.text !== seen) {
    setSeen(widget.text);
    setText(widget.text);
  }

  return (
    <>
      <label className="block text-xs text-hs-brown">
        Texto
        <textarea
          value={text}
          rows={widget.kind === "message" ? 5 : 2}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => {
            const next = text.trim();
            if (!next || next === widget.text) {return;}
            onPatch(widget._id, { text: next });
          }}
          className="mt-1 min-h-11 w-full resize-y border-[3px] border-hs-ink bg-hs-paper px-3 py-2 text-sm text-hs-ink outline-none focus-visible:border-hs-navy"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <FontSizeField widget={widget} onPatch={onPatch} />
        <label className="block text-xs text-hs-brown">
          Peso
          <select
            value={widget.fontWeight ?? defaultTvFontWeight()}
            onChange={(event) => {
              const next = event.target.value;
              if (!isTvFontWeight(next) || next === widget.fontWeight) {
                return;
              }
              onPatch(widget._id, { fontWeight: next });
            }}
            className="mt-1 min-h-11 w-full border-[3px] border-hs-ink bg-hs-paper px-2 text-sm text-hs-ink outline-none focus-visible:border-hs-navy"
          >
            {TV_FONT_WEIGHT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs text-hs-brown">
        Fondo
        <select
          value={tvHasBackground(widget.background) ? "yes" : "no"}
          onChange={(event) => {
            const next = event.target.value === "yes";
            if (next === tvHasBackground(widget.background)) {
              return;
            }
            onPatch(widget._id, { background: next });
          }}
          className="mt-1 min-h-11 w-full border-[3px] border-hs-ink bg-hs-paper px-2 text-sm text-hs-ink outline-none focus-visible:border-hs-navy"
        >
          <option value="yes">Sí</option>
          <option value="no">No</option>
        </select>
      </label>
    </>
  );
}

function FontSizeField({
  widget,
  onPatch,
}: {
  widget: TvWidget;
  onPatch: (id: string, patch: Partial<TvWidget>) => void;
}) {
  return (
    <label className="block text-xs text-hs-brown">
      Tamaño
      <select
        value={
          widget.fontSize !== undefined && isTvFontSize(widget.fontSize)
            ? widget.fontSize
            : defaultTvFontSize(widget.kind)
        }
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!isTvFontSize(next) || next === widget.fontSize) {
            return;
          }
          onPatch(widget._id, { fontSize: next });
        }}
        className="mt-1 min-h-11 w-full border-[3px] border-hs-ink bg-hs-paper px-2 text-sm text-hs-ink outline-none focus-visible:border-hs-navy"
      >
        {TV_FONT_SIZE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function GeometryFields({
  widget,
  onPatch,
}: {
  widget: TvWidget;
  onPatch: (id: string, patch: Partial<TvWidget>) => void;
}) {
  const rounded = {
    x: Math.round(widget.x),
    y: Math.round(widget.y),
    w: Math.round(widget.w),
    h: Math.round(widget.h),
  };
  const [box, setBox] = useState(rounded);
  const [seen, setSeen] = useState(rounded);
  if (
    rounded.x !== seen.x ||
    rounded.y !== seen.y ||
    rounded.w !== seen.w ||
    rounded.h !== seen.h
  ) {
    setSeen(rounded);
    setBox(rounded);
  }

  function commit() {
    const next = layoutTvBox(box);
    if (
      next.x === widget.x &&
      next.y === widget.y &&
      next.w === widget.w &&
      next.h === widget.h
    ) {
      return;
    }
    onPatch(widget._id, next);
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {(
        [
          ["x", "X"],
          ["y", "Y"],
          ["w", "Ancho"],
          ["h", "Alto"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="block text-xs text-hs-brown">
          {label}
          <Input
            type="number"
            min={0}
            max={100}
            value={box[key]}
            onChange={(event) =>
              setBox((current) => ({
                ...current,
                [key]: Number(event.target.value),
              }))
            }
            onBlur={commit}
            className="mt-1 tabular-nums"
          />
        </label>
      ))}
    </div>
  );
}
