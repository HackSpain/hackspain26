"use client";

import { useMutation, useQuery } from "convex/react";
import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { errorMessage, FormError } from "@/components/page";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { layoutTvBox, snapTv } from '@/lib/tv';
import type { TvWidget, TvWidgetKind } from '@/lib/tv';
import { cn } from "@/lib/utils";
import { isEditableKind, TvInlineEditor } from "./inline-edit";
import { TvInspector } from "./inspector";
import { TvLayoutsBar } from "./layouts-bar";
import { TvWidgetPreview, widgetLabel } from "./preview";
import { TvStage } from "./stage";

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
      fontSize: widget.fontSize,
      fontWeight: widget.fontWeight,
      background: widget.background,
    })),
  );
}

function applyBox(
  el: HTMLElement | undefined,
  box: { x: number; y: number; w: number; h: number },
) {
  if (!el) {return;}
  el.style.left = `${box.x}%`;
  el.style.top = `${box.y}%`;
  el.style.width = `${box.w}%`;
  el.style.height = `${box.h}%`;
}

export function TvEditor() {
  const widgets = useQuery(api.tv.adminListWidgets);
  const layouts = useQuery(api.tv.adminListLayouts);
  const ensure = useMutation(api.tv.adminEnsureLayout);
  const create = useMutation(api.tv.adminCreateWidget);
  const update = useMutation(api.tv.adminUpdateWidget).withOptimisticUpdate(
    (localStore, args) => {
      const list = localStore.getQuery(api.tv.adminListWidgets, {});
      if (!list) {return;}
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
                fontSize: args.fontSize ?? widget.fontSize,
                fontWeight: args.fontWeight ?? widget.fontWeight,
                background: args.background ?? widget.background,
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
  const [currentLayoutId, setCurrentLayoutId] = useState<Id<"tvLayouts"> | null>(
    null,
  );
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<TvWidget> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [liveText, setLiveText] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: () => void;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    editingIdRef.current = editingId;
  }, [editingId]);

  if (widgets && savedPrint === null && widgets.length > 0) {
    setSavedPrint(fingerprint(widgets));
  }

  useEffect(() => {
    if (widgets === undefined || seeded.current) {return;}
    seeded.current = true;
    if (widgets.length === 0) {void ensure({});}
  }, [ensure, widgets]);

  const displayed: TvWidget[] = useMemo(
    () =>
      (widgets ?? []).map((widget) => {
        const moved =
          draft && widget._id === draft._id ? { ...widget, ...draft } : widget;
        if (editingId === widget._id) {return { ...moved, text: liveText };}
        return moved;
      }),
    [draft, editingId, liveText, widgets],
  );

  const print = useMemo(
    () => (widgets ? fingerprint(widgets) : null),
    [widgets],
  );
  const dirty = Boolean(print && savedPrint && print !== savedPrint);
  const currentLayout =
    layouts?.find((layout) => layout._id === currentLayoutId) ?? null;
  const editingName = currentLayout?.name ?? currentName;
  const liveName = layouts?.find((layout) => layout.isLive)?.name ?? null;
  const selected = displayed.find((widget) => widget._id === selectedId) ?? null;
  const inspectorMode = adding ? "add" : selected ? "edit" : "empty";

  const run = useCallback(async (action: () => Promise<unknown>, fallback: string) => {
    setFormError(null);
    try {
      await action();
    } catch (error) {
      setFormError(errorMessage(error, fallback));
    }
  }, []);

  function focusBox(id: string) {
    boxRefs.current.get(id)?.focus();
  }

  function beginTextEdit(widget: TvWidget) {
    if (!isEditableKind(widget.kind)) {return;}
    dragRef.current = null;
    setAdding(false);
    setSelectedId(widget._id);
    setEditingId(widget._id);
    setLiveText(widget.text);
  }

  function commitText() {
    const id = editingIdRef.current;
    const widget = widgets?.find((row) => row._id === id);
    const text = liveText.trim();
    setEditingId(null);
    if (!id || !widget) {return;}
    focusBox(id);
    if (!text || text === widget.text) {return;}
    void run(
      () => update({ widgetId: id as Id<"tvWidgets">, text }),
      "No se ha podido guardar el texto",
    );
  }

  function cancelText() {
    const id = editingIdRef.current;
    setEditingId(null);
    if (id) {focusBox(id);}
  }

  const patchWidget = useCallback(
    (id: string, patch: Partial<TvWidget>) => {
      void run(
        () =>
          update({
            widgetId: id as Id<"tvWidgets">,
            x: patch.x,
            y: patch.y,
            w: patch.w,
            h: patch.h,
            text: patch.text,
            sponsors: patch.sponsors,
            tickerSpeed: patch.tickerSpeed,
            feedMode: patch.feedMode,
            feedSource: patch.feedSource,
            fontSize: patch.fontSize,
            fontWeight: patch.fontWeight,
            background: patch.background,
          }),
        "No se ha podido guardar",
      );
    },
    [run, update],
  );

  const deleteWidget = useCallback(
    async (id: string) => {
      await run(
        () => remove({ widgetId: id as Id<"tvWidgets"> }),
        "No se ha podido borrar",
      );
      setSelectedId((current) => (current === id ? null : current));
      setEditingId((current) => (current === id ? null : current));
    },
    [remove, run],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (editingIdRef.current) {return;}
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "Escape") {
        setAdding(false);
        setSelectedId(null);
        return;
      }
      if (!selectedId) {return;}
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        void deleteWidget(selectedId);
        return;
      }
      const widget = widgets?.find((row) => row._id === selectedId);
      if (!widget) {return;}
      const step = event.shiftKey ? 5 : 1;
      let dx = 0;
      let dy = 0;
      if (event.key === "ArrowLeft") {dx = -step;}
      if (event.key === "ArrowRight") {dx = step;}
      if (event.key === "ArrowUp") {dy = -step;}
      if (event.key === "ArrowDown") {dy = step;}
      if (dx === 0 && dy === 0) {return;}
      event.preventDefault();
      const next = layoutTvBox({
        x: widget.x + dx,
        y: widget.y + dy,
        w: widget.w,
        h: widget.h,
      });
      applyBox(boxRefs.current.get(widget._id), next);
      patchWidget(widget._id, next);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteWidget, patchWidget, selectedId, widgets]);

  function startDrag(
    event: React.PointerEvent<HTMLElement>,
    widget: TvWidget,
    mode: DragMode,
  ) {
    if (editingId === widget._id) {return;}
    if (event.detail >= 2) {return;}
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
    setAdding(false);
    setSelectedId(widget._id);

    let frame = 0;
    let latest: PointerEvent | null = null;

    function paint() {
      frame = 0;
      const moveEvent = latest;
      const current = dragRef.current;
      const canvas = canvasRef.current;
      if (!moveEvent || !current || !canvas) {return;}
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {return;}
      const dx = ((moveEvent.clientX - current.startX) / rect.width) * 100;
      const dy = ((moveEvent.clientY - current.startY) / rect.height) * 100;
      const raw =
        current.mode === "move"
          ? {
              x: current.origX + dx,
              y: current.origY + dy,
              w: current.origW,
              h: current.origH,
            }
          : {
              x: current.origX,
              y: current.origY,
              w: current.origW + dx,
              h: current.origH + dy,
            };
      const next = layoutTvBox({
        x: snapTv(raw.x),
        y: snapTv(raw.y),
        w: snapTv(raw.w),
        h: snapTv(raw.h),
      });
      draftRef.current = { _id: current.id, ...next };
      applyBox(boxRefs.current.get(current.id), next);
    }

    function applyPointer(moveEvent: PointerEvent) {
      latest = moveEvent;
      if (frame) {return;}
      frame = window.requestAnimationFrame(paint);
    }

    function finish(upEvent: PointerEvent) {
      window.removeEventListener("pointermove", applyPointer);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      if (frame) {window.cancelAnimationFrame(frame);}
      const current = dragRef.current;
      const next = draftRef.current;
      dragRef.current = null;
      if (!current || !next) {return;}
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
        beginTextEdit(widget);
        return;
      }
      if (!moved) {
        draftRef.current = null;
        return;
      }
      const box = layoutTvBox({
        x: next.x ?? current.origX,
        y: next.y ?? current.origY,
        w: next.w ?? current.origW,
        h: next.h ?? current.origH,
      });
      setDraft({ _id: current.id, ...box });
      void run(
        () =>
          update({
            widgetId: current.id as Id<"tvWidgets">,
            ...box,
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
      setAdding(false);
      setSelectedId(id);
    }, "No se ha podido añadir la caja");
    setPending(false);
  }

  async function handleSaveLayout(rawName: string) {
    const name = rawName.trim() || "Sin nombre";
    await run(async () => {
      const id = await saveLayout({
        name,
        layoutId: currentLayoutId ?? undefined,
      });
      if (widgets) {setSavedPrint(fingerprint(widgets));}
      setCurrentLayoutId(id);
      setCurrentName(name);
    }, "No se ha podido guardar el estado");
  }

  async function applyLoad(id?: Id<"tvLayouts">) {
    const named = id ? layouts?.find((layout) => layout._id === id)?.name ?? null : "Insights · Panorama";
    await run(async () => {
      const loaded = await loadLayout({ layoutId: id });
      setSavedPrint(fingerprint(loaded));
      setCurrentLayoutId(id ?? null);
      setCurrentName(named);
      setAdding(false);
      setSelectedId(null);
      setDraft(null);
      setEditingId(null);
    }, "No se ha podido cargar el estado");
  }

  function handleLoad(id: Id<"tvLayouts">) {
    if (widgets && savedPrint && fingerprint(widgets) !== savedPrint) {
      setConfirm({
        title: "Cambios sin guardar",
        description: "Hay cambios sin guardar en el lienzo. ¿Cargar este estado?",
        action: () => void applyLoad(id),
      });
      return;
    }
    void applyLoad(id);
  }

  return (
    <div className="space-y-4">
      <FormError message={formError} />
      <div className="grid items-start gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="min-w-0 md:sticky md:top-6" aria-label="Biblioteca de pantallas">
      <TvLayoutsBar
        layouts={layouts}
        currentId={currentLayoutId}
        currentName={editingName}
        liveName={liveName}
        dirty={dirty}
        onSave={(name) => void handleSaveLayout(name)}
        onLoad={handleLoad}
        onSetLive={(id) =>
          void run(() => setLive({ layoutId: id }), "No se ha podido poner en vivo")
        }
        onRemove={(id) => {
          setConfirm({
            title: "Borrar estado",
            description: "¿Borrar este estado?",
            action: () =>
              void run(async () => {
                await removeLayout({ layoutId: id });
                if (id === currentLayoutId) {
                  setCurrentLayoutId(null);
                  setCurrentName(null);
                }
              }, "No se ha podido borrar el estado"),
          });
        }}
      />
      </aside>
      <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button variant="outline" disabled={pending || !widgets} onClick={() => setConfirm({
          title: "¿Restaurar el layout por defecto?",
          description: "Guardaremos una copia del lienzo actual en tus estados. Se restaurará Insights · Panorama; los estados guardados y la emisión en vivo no cambian. Guarda y pon en vivo el resultado cuando esté listo.",
          action: () => {
            setPending(true);
            void applyLoad().finally(() => setPending(false));
          },
        })}>Restaurar por defecto</Button>
      </div>
      <div className="relative w-full">
        <div
          ref={canvasRef}
          className="relative mr-0 aspect-video h-auto w-auto min-h-0 overflow-hidden border-[3px] border-hs-ink bg-hs-ink select-none xl:mr-[18rem]"
          onPointerDown={(event) => {
            if (!(event.target instanceof Element)) {return;}
            if (event.target.closest("[data-tv-widget]")) {return;}
            if (event.target.closest("[data-tv-add]")) {return;}
            if (editingIdRef.current) {commitText();}
            setAdding(false);
            setSelectedId(null);
          }}
        >
          {widgets === undefined ? (
            <div className="absolute inset-0 bg-hs-ink" />
          ) : (
            <TvStage
              widgets={displayed}
              fill
              className="absolute inset-0 bg-[linear-gradient(to_right,oklch(0.85_0.12_95/0.06)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.85_0.12_95/0.06)_1px,transparent_1px)] bg-size-[5%_5%]"
              renderWidget={(widget) => {
                const isSelected = widget._id === selectedId;
                const isEditing =
                  editingId === widget._id && isEditableKind(widget.kind);
                const label = widgetLabel(widget.kind);
                return (
                  <div
                    key={widget._id}
                    ref={(node) => {
                      if (node) {boxRefs.current.set(widget._id, node);}
                      else {boxRefs.current.delete(widget._id);}
                    }}
                    data-tv-widget={widget._id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${label} en la pantalla`}
                    className={cn(
                      "group absolute overflow-hidden outline-none",
                      isEditing ? "cursor-text" : "cursor-grab",
                      isSelected && "ring-[3px] ring-hs-gold",
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
                      setAdding(false);
                      setSelectedId(widget._id);
                      if (isEditableKind(widget.kind)) {beginTextEdit(widget);}
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setAdding(false);
                        setSelectedId(widget._id);
                        if (isEditableKind(widget.kind)) {beginTextEdit(widget);}
                      }
                    }}
                  >
                    {isEditing && isEditableKind(widget.kind) ? (
                      <TvInlineEditor
                        kind={widget.kind}
                        value={liveText}
                        fontSize={widget.fontSize}
                        fontWeight={widget.fontWeight}
                        background={widget.background}
                        onChange={setLiveText}
                        onCommit={commitText}
                        onCancel={cancelText}
                      />
                    ) : (
                      <div className="pointer-events-none h-full">
                        <TvWidgetPreview widget={widget} />
                      </div>
                    )}
                    <button
                      type="button"
                      aria-label="Borrar caja"
                      className={cn(
                        "absolute top-0 left-0 z-20 flex size-8 items-center justify-center bg-hs-red text-hs-paper outline-none after:absolute after:top-0 after:left-0 after:size-10 after:content-[''] motion-safe:transition-opacity motion-safe:duration-150",
                        isSelected
                          ? "opacity-100"
                          : "opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 group-focus-visible:opacity-100",
                      )}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => {
                        setConfirm({
                          title: "Borrar caja",
                          description: "¿Borrar esta caja de la pantalla?",
                          action: () => void deleteWidget(widget._id),
                        });
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
            data-tv-add=""
            aria-label="Añadir caja"
            aria-pressed={adding}
            onClick={() => {
              if (editingIdRef.current) {commitText();}
              setSelectedId(null);
              setAdding(true);
            }}
            className={cn(
              "absolute right-3 bottom-3 z-50 flex size-12 items-center justify-center border-[3px] border-hs-ink bg-hs-gold text-hs-ink outline-none motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hs-gold",
              adding && "ring-[3px] ring-hs-paper",
            )}
          >
            <Plus className="size-6" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
        <div className="max-xl:mt-4 xl:absolute xl:top-0 xl:right-0 xl:flex xl:h-full xl:w-68 xl:flex-col xl:overflow-hidden">
          <TvInspector
            widget={selected}
            mode={inspectorMode}
            pending={pending}
            onAdd={(kind) => void addWidget(kind)}
            onPatch={patchWidget}
            onDelete={(id) => {
              setConfirm({
                title: "Borrar caja",
                description: "¿Borrar esta caja de la pantalla?",
                action: () => void deleteWidget(id),
              });
            }}
          />
        </div>
      </div>
      <p className="text-sm font-medium text-hs-brown">
        Arrastra para mover · Esquina para tamaño · Flechas para ajustar · Doble
        clic para escribir
      </p>
      </div>
      </div>

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                const action = confirm?.action;
                setConfirm(null);
                action?.();
              }}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
