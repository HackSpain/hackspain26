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
    <div className="flex flex-col gap-3 border-[3px] border-hs-ink bg-hs-paper px-3 py-2.5 md:grid md:grid-cols-[auto_minmax(0,1fr)] md:items-stretch md:gap-0">
      <form
        className="flex h-full min-h-11 shrink-0 items-center gap-2.5 md:pr-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draftName);
        }}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Sin nombre"
          aria-label="Nombre del estado"
          autoComplete="off"
          className="h-11 w-44 text-sm font-medium"
        />
        <Button type="submit" size="sm" disabled={!(dirty || nameDirty)}>
          Guardar
        </Button>
      </form>

      <div className="flex min-h-11 min-w-0 flex-wrap items-center gap-1.5 md:border-l-[3px] md:border-hs-ink md:pl-4">
        {layouts === undefined ? (
          <p className="text-sm font-medium text-hs-brown">Cargando…</p>
        ) : layouts.length === 0 ? (
          <p className="text-sm font-medium text-hs-brown">
            Guarda Bienvenida, Hackeando, Cena…
          </p>
        ) : (
          layouts.map((layout) => {
            const current = currentId === layout._id;
            return (
              <div
                key={layout._id}
                className={cn(
                  "flex items-center border-[3px]",
                  current
                    ? "border-hs-ink bg-hs-gold"
                    : "border-hs-ink/20 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-hs-sand/60",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSetLive(layout._id)}
                  aria-label={
                    layout.isLive
                      ? `${layout.name}, en vivo`
                      : `Poner ${layout.name} en vivo`
                  }
                  className="inline-flex min-h-11 items-center px-2.5 text-sm font-medium outline-none motion-safe:transition-transform motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.97] focus-visible:border-hs-navy"
                >
                  {layout.name}
                  {layout.isLive ? (
                    <span className="ml-1.5 text-[10px] font-medium tracking-wide text-hs-teal uppercase">
                      Live
                    </span>
                  ) : null}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-11 border-0 border-l-[3px] border-hs-ink/20"
                      aria-label={`Opciones de ${layout.name}`}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => onLoad(layout._id)}>
                      Cargar
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onSetLive(layout._id)}>
                      Poner en vivo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-hs-red"
                      onSelect={() => onRemove(layout._id)}
                    >
                      Borrar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
