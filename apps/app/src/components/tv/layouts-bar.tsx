"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Id } from "@convex/_generated/dataModel";

export type TvLayoutRow = {
  _id: Id<"tvLayouts">;
  name: string;
  isLive: boolean;
  updatedAt: number;
};

export function TvLayoutsBar({
  layouts,
  currentName,
  liveName,
  dirty,
  onSave,
  onLoad,
  onSetLive,
  onRemove,
}: {
  layouts: TvLayoutRow[] | undefined;
  currentName: string | null;
  liveName: string | null;
  dirty: boolean;
  onSave: () => void;
  onLoad: (id: Id<"tvLayouts">) => void;
  onSetLive: (id: Id<"tvLayouts">) => void;
  onRemove: (id: Id<"tvLayouts">) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-[3px] border-hs-ink bg-hs-paper p-3">
      <p className="font-bungee text-sm">Estados</p>
      <span className="text-sm font-semibold">
        {currentName ?? "Sin nombre"}
        {dirty ? (
          <span className="ml-1 text-xs font-normal text-hs-brown">
            · sin guardar
          </span>
        ) : null}
      </span>
      <Badge variant={liveName ? "gold" : "default"}>
        {liveName ? `En vivo: ${liveName}` : "En vivo: lienzo de trabajo"}
      </Badge>
      <Button type="button" size="sm" onClick={onSave}>
        Guardar estado
      </Button>
      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
        {layouts === undefined ? (
          <p className="text-xs text-hs-brown">Cargando estados…</p>
        ) : layouts.length === 0 ? (
          <p className="text-xs text-hs-brown">
            Aún no hay estados. Guarda Bienvenida, Hackeando, Cena…
          </p>
        ) : (
          layouts.map((layout) => (
            <div
              key={layout._id}
              className="flex flex-wrap items-center gap-1 border-[3px] border-hs-ink/20 px-2 py-1"
            >
              <span className="text-sm font-semibold">{layout.name}</span>
              {layout.isLive ? (
                <span className="text-[10px] font-semibold text-hs-teal">
                  LIVE
                </span>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onLoad(layout._id)}
              >
                Cargar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onSetLive(layout._id)}
              >
                Poner en vivo
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-hs-red text-hs-red"
                onClick={() => onRemove(layout._id)}
              >
                Borrar
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
