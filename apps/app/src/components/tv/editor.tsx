"use client";

import { useMutation, useQuery } from "convex/react";
import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { errorMessage, FormError } from "@/components/page";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TV_FEED_KINDS,
  TV_PALETTE,
  TV_SPONSOR_KINDS,
  type TvWidget,
  type TvWidgetKind,
} from "@/lib/tv";
import { cn } from "@/lib/utils";
import { isEditableKind, TvInlineEditor } from "./inline-edit";
import { TvLayoutsBar } from "./layouts-bar";
import { FeedEditor } from "./feed-box";
import { SponsorEditor } from "./sponsor-editor";
import { TvStage } from "./stage";
import { TvWidgetView } from "./widgets";

type DragMode = "move" | "resize";

type DragState = {
  id: string;
  mode: DragMode;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  alreadySelected: boolean;
};

function PalettePreview({ kind }: { kind: TvWidgetKind }) {
  if (kind === "banner") {
    return (
      <div className="flex h-16 items-center justify-center bg-hs-ink px-2">
        <span className="font-bungee text-[10px] text-hs-gold uppercase">
          Titular
        </span>
      </div>
    );
  }
  if (kind === "ticker" || kind === "sponsorTicker") {
    return (
      <div className="flex h-16 items-end bg-hs-ink">
        <div className="w-full bg-hs-gold py-1 text-center font-bungee text-[9px] text-hs-ink uppercase">
          Cinta ✦
        </div>
      </div>
    );
  }
  if (kind === "clock") {
    return (
      <div className="flex h-16 items-center justify-center bg-hs-ink">
        <span className="font-bungee text-lg tabular-nums text-hs-paper">
          21:00
        </span>
      </div>
    );
  }
  if (kind === "liveCommits" || kind === "feed") {
    return (
      <div className="flex h-16 flex-col justify-center gap-1 bg-hs-paper px-2">
        <span className="h-2 w-full bg-hs-sand" />
        <span className="h-2 w-3/4 bg-hs-sand" />
      </div>
    );
  }
  return (
    <div className="flex h-16 flex-col justify-between border-[3px] border-hs-ink/15 bg-hs-sand/50 p-2">
      <span className="h-1.5 w-10 bg-hs-ink/30" />
      <span className="h-6 w-full bg-hs-navy/15" />
      <span className="h-1.5 w-16 bg-hs-ink/20" />
    </div>
  );
}

function fingerprint(widgets: TvWidget[]) {
  return JSON.stringify(
    widgets.map((widget) => ({
      kind: widget.kind,
      x: widget.x,
      y: widget.y,
      w: widget.w,
      h: widget.h,
      z: widget.z,
      text: widget.text,
      sponsors: widget.sponsors,
      tickerSpeed: widget.tickerSpeed,
      feedMode: widget.feedMode,
      feedSource: widget.feedSource,
    })),
  );
}

export function TvEditor() {
  const widgets = useQuery(api.tv.adminListWidgets);
  const layouts = useQuery(api.tv.adminListLayouts);
  const ensure = useMutation(api.tv.adminEnsureLayout);
  const create = useMutation(api.tv.adminCreateWidget);
  const update = useMutation(api.tv.adminUpdateWidget).withOptimisticUpdate(
    (localStore, args) => {
      const list = localStore.getQuery(api.tv.adminListWidgets, {});
      if (!list) return;
      localStore.setQuery(
        api.tv.adminListWidgets,
        {},
        list.map((widget) =>
          widget._id === args.widgetId
            ? {
                ...widget,
                x: args.x ?? widget.x,
                y: args.y ?? widget.y,
                w: args.w ?? widget.w,
                h: args.h ?? widget.h,
                z: args.z ?? widget.z,
                text: args.text ?? widget.text,
                sponsors: args.sponsors ?? widget.sponsors,
                tickerSpeed: args.tickerSpeed ?? widget.tickerSpeed,
                feedMode: args.feedMode ?? widget.feedMode,
                feedSource: args.feedSource ?? widget.feedSource,
              }
            : widget,
        ),
      );
    },
  );
  const remove = useMutation(api.tv.adminRemoveWidget);
  const saveLayout = useMutation(api.tv.adminSaveLayout);
  const loadLayout = useMutation(api.tv.adminLoadLayout);
  const setLive = useMutation(api.tv.adminSetLive);
  const removeLayout = useMutation(api.tv.adminRemoveLayout);

  const canvasRef = useRef<HTMLDivElement>(null);
  const boxRefs = useRef(new Map<string, HTMLDivElement>());
  const seeded = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const draftRef = useRef<Partial<TvWidget> | null>(null);
  const editingIdRef = useRef<string | null>(null);
  const [savedPrint, setSavedPrint] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<TvWidget> | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [liveText, setLiveText] = useState("");
  const [sponsorEditId, setSponsorEditId] = useState<string | null>(null);
  const [feedEditId, setFeedEditId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    editingIdRef.current = editingId;
  }, [editingId]);

  if (widgets && savedPrint === null && widgets.length > 0) {
    setSavedPrint(fingerprint(widgets));
  }

  useEffect(() => {
    if (widgets === undefined || seeded.current) return;
    seeded.current = true;
    if (widgets.length === 0) void ensure({});
  }, [ensure, widgets]);

  const displayed: TvWidget[] = (widgets ?? []).map((widget) => {
    const moved =
      draft && widget._id === draft._id ? { ...widget, ...draft } : widget;
    if (editingId === widget._id) return { ...moved, text: liveText };
    return moved;
  });

  const liveName = layouts?.find((layout) => layout.isLive)?.name ?? null;

  async function run(action: () => Promise<unknown>, fallback: string) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, fallback));
    }
  }

  function focusBox(id: string) {
    boxRefs.current.get(id)?.focus();
  }

  function beginTextEdit(widget: TvWidget) {
    if (!isEditableKind(widget.kind)) return;
    dragRef.current = null;
    setDrag(null);
    setSelectedId(widget._id);
    setEditingId(widget._id);
    setLiveText(widget.text);
  }

  function commitText() {
    const id = editingIdRef.current;
    const widget = widgets?.find((row) => row._id === id);
    const text = liveText.trim();
    setEditingId(null);
    if (!id || !widget) return;
    focusBox(id);
    if (!text || text === widget.text) return;
    void run(
      () => update({ widgetId: id as Id<"tvWidgets">, text }),
      "No se ha podido guardar el texto",
    );
  }

  function cancelText() {
    const id = editingIdRef.current;
    setEditingId(null);
    if (id) focusBox(id);
  }

  const deleteWidget = useCallback(async (id: string) => {
    await run(
      () => remove({ widgetId: id as Id<"tvWidgets"> }),
      "No se ha podido borrar",
    );
    setSelectedId(null);
    setEditingId(null);
    setSponsorEditId(null);
    setFeedEditId(null);
  }, [remove]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!selectedId || editingIdRef.current || sponsorEditId || feedEditId) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "Escape") {
        setSelectedId(null);
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        void deleteWidget(selectedId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, sponsorEditId, feedEditId, deleteWidget]);

  function startDrag(
    event: React.PointerEvent<HTMLElement>,
    widget: TvWidget,
    mode: DragMode,
  ) {
    if (
      editingId === widget._id ||
      sponsorEditId === widget._id ||
      feedEditId === widget._id
    )
      return;
    if (event.detail >= 2) return;
    event.preventDefault();
    event.stopPropagation();
    const nextDrag: DragState = {
      id: widget._id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origX: widget.x,
      origY: widget.y,
      origW: widget.w,
      origH: widget.h,
      alreadySelected: selectedId === widget._id,
    };
    dragRef.current = nextDrag;
    draftRef.current = widget;
    setSelectedId(widget._id);
    setDraft(widget);
    setDrag(nextDrag);
    if (selectedId !== widget._id) {
      void run(
        () =>
          update({
            widgetId: widget._id as Id<"tvWidgets">,
            z: displayed.reduce((max, row) => Math.max(max, row.z), 0) + 1,
          }),
        "No se ha podido seleccionar",
      );
    }

    function applyPointer(moveEvent: PointerEvent) {
      const current = dragRef.current;
      const canvas = canvasRef.current;
      if (!current || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dx = ((moveEvent.clientX - current.startX) / rect.width) * 100;
      const dy = ((moveEvent.clientY - current.startY) / rect.height) * 100;
      const next =
        current.mode === "move"
          ? {
              _id: current.id,
              x: current.origX + dx,
              y: current.origY + dy,
              w: current.origW,
              h: current.origH,
            }
          : {
              _id: current.id,
              x: current.origX,
              y: current.origY,
              w: current.origW + dx,
              h: current.origH + dy,
            };
      draftRef.current = next;
      setDraft(next);
    }

    function finish(upEvent: PointerEvent) {
      window.removeEventListener("pointermove", applyPointer);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      const current = dragRef.current;
      const next = draftRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!current || !next) return;
      const moved =
        Math.hypot(upEvent.clientX - current.startX, upEvent.clientY - current.startY) >
        5;
      if (
        !moved &&
        current.mode === "move" &&
        current.alreadySelected &&
        isEditableKind(widget.kind)
      ) {
        draftRef.current = null;
        setDraft(null);
        beginTextEdit(widget);
        return;
      }
      if (!moved && !current.alreadySelected) {
        draftRef.current = null;
        setDraft(null);
        return;
      }
      void run(
        () =>
          update({
            widgetId: current.id as Id<"tvWidgets">,
            x: next.x,
            y: next.y,
            w: next.w,
            h: next.h,
          }),
        "No se ha podido guardar la posición",
      ).then(() => {
        draftRef.current = null;
        setDraft(null);
      });
    }

    window.addEventListener("pointermove", applyPointer);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  async function addWidget(kind: TvWidgetKind) {
    setPending(true);
    await run(async () => {
      const id = await create({ kind });
      setSelectedId(id);
      setPaletteOpen(false);
    }, "No se ha podido añadir la caja");
    setPending(false);
  }

  async function handleSaveLayout() {
    const name = window.prompt("Nombre del estado", currentName ?? "Hackeando");
    if (!name) return;
    await run(async () => {
      await saveLayout({ name });
      if (widgets) setSavedPrint(fingerprint(widgets));
      setCurrentName(name.trim());
    }, "No se ha podido guardar el estado");
  }

  async function handleLoad(id: Id<"tvLayouts">) {
    if (
      widgets &&
      savedPrint &&
      fingerprint(widgets) !== savedPrint &&
      !window.confirm("Hay cambios sin guardar en el lienzo. ¿Cargar este estado?")
    ) {
      return;
    }
    const named = layouts?.find((layout) => layout._id === id)?.name ?? null;
    await run(async () => {
      const loaded = await loadLayout({ layoutId: id });
      setSavedPrint(fingerprint(loaded));
      setCurrentName(named);
    }, "No se ha podido cargar el estado");
  }

  return (
    <div className="space-y-4">
      <FormError message={error} />
      <TvLayoutsBar
        layouts={layouts}
        currentName={currentName}
        liveName={liveName}
        dirty={Boolean(widgets && savedPrint && fingerprint(widgets) !== savedPrint)}
        onSave={() => void handleSaveLayout()}
        onLoad={(id) => void handleLoad(id)}
        onSetLive={(id) =>
          void run(() => setLive({ layoutId: id }), "No se ha podido poner en vivo")
        }
        onRemove={(id) => {
          if (!window.confirm("¿Borrar este estado?")) return;
          void run(
            () => removeLayout({ layoutId: id }),
            "No se ha podido borrar el estado",
          );
        }}
      />
      <div
        ref={canvasRef}
        className="relative border-[3px] border-hs-ink bg-hs-ink select-none"
        onPointerDown={(event) => {
          if (!(event.target instanceof Element)) return;
          if (event.target.closest("[data-tv-widget]")) return;
          if (editingIdRef.current) commitText();
          setSelectedId(null);
          setSponsorEditId(null);
          setFeedEditId(null);
        }}
      >
        {widgets === undefined ? (
          <div className="aspect-video w-full bg-hs-ink" />
        ) : (
          <TvStage
            widgets={displayed}
            className="bg-[linear-gradient(to_right,oklch(0.85_0.12_95/0.06)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.85_0.12_95/0.06)_1px,transparent_1px)] bg-size-[5%_5%]"
            renderWidget={(widget) => {
              const isSelected = widget._id === selectedId;
              const isEditing = editingId === widget._id && isEditableKind(widget.kind);
              const label =
                TV_PALETTE.find((item) => item.kind === widget.kind)?.label ??
                widget.kind;
              return (
                <div
                  key={widget._id}
                  ref={(node) => {
                    if (node) boxRefs.current.set(widget._id, node);
                    else boxRefs.current.delete(widget._id);
                  }}
                  data-tv-widget={widget._id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${label} en la pantalla`}
                  className={cn(
                    "group absolute overflow-hidden outline-none",
                    isEditing ? "cursor-text" : "cursor-grab",
                    isSelected && "z-20 ring-[3px] ring-hs-gold",
                    drag?.id === widget._id && "cursor-grabbing",
                  )}
                  style={{
                    left: `${widget.x}%`,
                    top: `${widget.y}%`,
                    width: `${widget.w}%`,
                    height: `${widget.h}%`,
                    zIndex: isSelected ? 40 : widget.z,
                    touchAction: isEditing ? "auto" : "none",
                  }}
                  onPointerDown={(event) => startDrag(event, widget, "move")}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (isEditableKind(widget.kind)) beginTextEdit(widget);
                    if (TV_SPONSOR_KINDS.has(widget.kind)) {
                      setSelectedId(widget._id);
                      setSponsorEditId(widget._id);
                    }
                    if (TV_FEED_KINDS.has(widget.kind)) {
                      setSelectedId(widget._id);
                      setFeedEditId(widget._id);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(widget._id);
                      if (isEditableKind(widget.kind)) beginTextEdit(widget);
                    }
                  }}
                >
                  {isEditing && isEditableKind(widget.kind) ? (
                    <TvInlineEditor
                      kind={widget.kind}
                      value={liveText}
                      onChange={setLiveText}
                      onCommit={commitText}
                      onCancel={cancelText}
                    />
                  ) : (
                    <div className="pointer-events-none h-full">
                      <TvWidgetView widget={widget} editor />
                    </div>
                  )}
                  {sponsorEditId === widget._id ? (
                    <SponsorEditor
                      sponsors={widget.sponsors ?? []}
                      tickerSpeed={widget.tickerSpeed}
                      showSpeed={widget.kind === "sponsorTicker"}
                      onClose={() => setSponsorEditId(null)}
                      onSave={(next) => {
                        void run(
                          () =>
                            update({
                              widgetId: widget._id as Id<"tvWidgets">,
                              sponsors: next.sponsors,
                              tickerSpeed: next.tickerSpeed,
                            }),
                          "No se han podido guardar los sponsors",
                        );
                        setSponsorEditId(null);
                      }}
                    />
                  ) : null}
                  {feedEditId === widget._id ? (
                    <FeedEditor
                      mode={widget.feedMode}
                      source={widget.feedSource}
                      onClose={() => setFeedEditId(null)}
                      onSave={(next) => {
                        void run(
                          () =>
                            update({
                              widgetId: widget._id as Id<"tvWidgets">,
                              feedMode: next.feedMode,
                              feedSource: next.feedSource,
                            }),
                          "No se ha podido guardar el feed",
                        );
                        setFeedEditId(null);
                      }}
                    />
                  ) : null}
                  <button
                    type="button"
                    aria-label="Borrar caja"
                    className={cn(
                      "absolute top-0 left-0 z-20 flex size-8 items-center justify-center bg-hs-red text-hs-paper outline-none after:absolute after:top-0 after:left-0 after:size-10 after:content-[''] motion-safe:transition-opacity motion-safe:duration-150",
                      isSelected
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                    )}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => {
                      if (!window.confirm("¿Borrar esta caja de la pantalla?")) {
                        return;
                      }
                      void deleteWidget(widget._id);
                    }}
                  >
                    <X className="size-4" strokeWidth={2.5} aria-hidden />
                  </button>
                  {isSelected && !isEditing ? (
                    <button
                      type="button"
                      aria-label="Redimensionar"
                      className="absolute right-0 bottom-0 size-4 cursor-nwse-resize bg-hs-gold after:absolute after:right-0 after:bottom-0 after:size-10 after:content-['']"
                      onPointerDown={(event) =>
                        startDrag(event, widget, "resize")
                      }
                    />
                  ) : null}
                </div>
              );
            }}
          />
        )}
        <button
          type="button"
          aria-label="Añadir caja"
          onClick={() => setPaletteOpen(true)}
          className="absolute right-3 bottom-3 z-50 flex size-12 items-center justify-center border-[3px] border-hs-ink bg-hs-gold text-hs-ink outline-none motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hs-gold"
        >
          <Plus className="size-6" strokeWidth={2.5} aria-hidden />
        </button>
      </div>
      <p className="text-sm text-hs-brown">
        Doble clic para editar · Arrastra para mover · Esquina para tamaño
      </p>

      <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Añadir a la pantalla</DialogTitle>
            <DialogDescription>
              Cajas listas para el proyector. Insights y En vivo usan datos
              simulados salvo los commits de GitHub.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {(
              [
                ["tv", "Pantalla"],
                ["live", "En vivo"],
                ["sponsors", "Sponsors"],
                ["insights", "Insights"],
              ] as const
            ).map(([group, label]) => (
              <div key={group}>
                <p className="mb-2 font-bungee text-xs">{label}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {TV_PALETTE.filter((item) => item.group === group).map(
                    (item) => (
                      <button
                        key={item.kind}
                        type="button"
                        disabled={pending}
                        onClick={() => void addWidget(item.kind)}
                        className="border-[3px] border-hs-ink bg-hs-paper text-left outline-none motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.96] hover:bg-hs-sand/60 focus-visible:border-hs-navy disabled:opacity-50"
                      >
                        <PalettePreview kind={item.kind} />
                        <span className="block px-2.5 py-2">
                          <span className="block text-sm font-semibold">
                            {item.label}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-hs-brown">
                            {item.hint}
                          </span>
                        </span>
                      </button>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
