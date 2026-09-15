"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { Id } from "@convex/_generated/dataModel";
import { cn } from "@/lib/utils";

export type TvLayoutRow = {
  _id: Id<"tvLayouts">;
  name: string;
  isLive: boolean;
  updatedAt: number;
};

export function TvLayoutsBar({
  layouts,
  currentId,
  currentName,
  liveName,
  dirty,
  onSave,
  onLoad,
  onSetLive,
  onRemove,
}: {
  layouts: TvLayoutRow[] | undefined;
  currentId: Id<"tvLayouts"> | null;
  currentName: string | null;
  liveName: string | null;
  dirty: boolean;
  onSave: (name: string) => void;
  onLoad: (id: Id<"tvLayouts">) => void;
  onSetLive: (id: Id<"tvLayouts">) => void;
  onRemove: (id: Id<"tvLayouts">) => void;
}) {
  const [name, setName] = useState(currentName ?? "");

  useEffect(() => {
    setName(currentName ?? "");
  }, [currentId, currentName]);

  const draftName = name.trim() || "Sin nombre";
  const nameDirty = name.trim() !== (currentName ?? "").trim();

  return (
    <section
      aria-label="Pantallas guardadas"
      className="space-y-5 border-r border-hs-ink/15 pr-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base">Pantallas guardadas</h2>
          <p className="mt-1 text-sm text-hs-brown">
            {liveName
              ? `En vivo: ${liveName}`
              : "Todavía no hay una pantalla publicada."}
          </p>
        </div>
        <form
          className="w-full space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(draftName);
          }}
        >
          <label
            htmlFor="tv-layout-name"
            className="block text-xs text-hs-brown"
          >
            {currentId
              ? "Guardar cambios en esta pantalla"
              : "Guardar el lienzo como nueva pantalla"}
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="tv-layout-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Sin nombre"
              aria-label="Nombre del estado"
              autoComplete="off"
              className="h-11 min-w-0 flex-1 text-sm font-medium"
            />
            <Button
              type="submit"
              size="sm"
              className="h-11 shrink-0 px-2 text-xs"
              disabled={currentId !== null && !(dirty || nameDirty)}
            >
              Guardar
            </Button>
          </div>
          {dirty && (
            <p className="text-xs text-hs-brown">
              Cambios sin guardar
              {currentId &&
              layouts?.some(
                (layout) => layout._id === currentId && layout.isLive,
              )
                ? " · Guardar actualizará la TV en vivo."
                : "."}
            </p>
          )}
        </form>
      </div>

      <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto border-t border-hs-ink/15 pt-4">
        {layouts === undefined ? (
          <p className="text-sm font-medium text-hs-brown">Cargando…</p>
        ) : layouts.length === 0 ? (
          <p className="text-sm font-medium text-hs-brown">
            Guarda tu primera pantalla para recuperarla o emitirla cuando
            quieras.
          </p>
        ) : (
          layouts.map((layout) => {
            const current = currentId === layout._id;
            return (
              <div
                key={layout._id}
                className={cn(
                  "flex min-w-0 flex-col border p-4",
                  current
                    ? "border-hs-navy/40 bg-hs-sand/60"
                    : "border-hs-ink/15",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="break-words font-sans text-base font-semibold">
                      {layout.name}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                      {layout.isLive && (
                        <span className="text-hs-teal">● En vivo</span>
                      )}
                      {current && (
                        <span className="text-hs-navy">En el editor</span>
                      )}
                      {!layout.isLive && !current && (
                        <span className="text-hs-brown">Guardada</span>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-10 shrink-0 border-0"
                        aria-label={`Opciones de ${layout.name}`}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        className="text-hs-red"
                        onSelect={() => onRemove(layout._id)}
                      >
                        Borrar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-hs-ink/15 pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Editar ${layout.name}`}
                    className="min-h-10 shrink-0 px-2 text-xs"
                    onClick={() => onLoad(layout._id)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={layout.isLive}
                    aria-label={`Poner ${layout.name} en vivo`}
                    className="min-h-10 min-w-0 flex-1 px-2 text-xs"
                    onClick={() => onSetLive(layout._id)}
                  >
                    {layout.isLive ? "En emisión" : "Poner en vivo"}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
