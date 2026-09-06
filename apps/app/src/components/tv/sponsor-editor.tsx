"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TvSponsor, TvSponsorTier, TvTickerSpeed } from "@/lib/tv";

const TIERS: TvSponsorTier[] = ["gold", "silver", "community"];
const SPEEDS: TvTickerSpeed[] = ["slow", "normal", "fast"];

export function SponsorEditor({
  sponsors,
  tickerSpeed,
  showSpeed,
  onSave,
  onClose,
}: {
  sponsors: TvSponsor[];
  tickerSpeed?: TvTickerSpeed;
  showSpeed?: boolean;
  onSave: (next: { sponsors: TvSponsor[]; tickerSpeed?: TvTickerSpeed }) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<TvSponsor[]>(
    sponsors.length > 0
      ? sponsors
      : [{ name: "", logoUrl: "", href: "", tier: "gold" }],
  );
  const [speed, setSpeed] = useState<TvTickerSpeed>(tickerSpeed ?? "normal");

  function update(index: number, patch: Partial<TvSponsor>) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  return (
    <div
      className="absolute inset-2 z-30 overflow-auto border-[3px] border-hs-ink bg-hs-paper p-3 text-hs-ink"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <p className="font-bungee text-sm">Sponsors</p>
      <div className="mt-2 space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="grid gap-2 border-b border-hs-ink/15 pb-2">
            <Input
              aria-label="Nombre del sponsor"
              placeholder="Nombre"
              value={row.name}
              onChange={(event) => update(index, { name: event.target.value })}
            />
            <Input
              aria-label="URL del logo"
              placeholder="https://…/logo.svg"
              value={row.logoUrl}
              onChange={(event) => update(index, { logoUrl: event.target.value })}
            />
            <Input
              aria-label="Enlace del sponsor"
              placeholder="https://…"
              value={row.href}
              onChange={(event) => update(index, { href: event.target.value })}
            />
            <div className="flex gap-2">
              <select
                aria-label="Nivel"
                value={row.tier}
                onChange={(event) =>
                  update(index, { tier: event.target.value as TvSponsorTier })
                }
                className="min-h-11 flex-1 border-[3px] border-hs-ink bg-hs-paper px-2 text-sm"
              >
                {TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-hs-red text-hs-red"
                onClick={() =>
                  setRows((current) => current.filter((_, i) => i !== index))
                }
              >
                Quitar
              </Button>
            </div>
          </div>
        ))}
      </div>
      {showSpeed ? (
        <label className="mt-3 block text-xs text-hs-brown">
          Velocidad
          <select
            value={speed}
            onChange={(event) =>
              setSpeed(event.target.value as TvTickerSpeed)
            }
            className="mt-1 min-h-11 w-full border-[3px] border-hs-ink bg-hs-paper px-2 text-sm text-hs-ink"
          >
            {SPEEDS.map((item) => (
              <option key={item} value={item}>
                {item === "slow" ? "Lenta" : item === "fast" ? "Rápida" : "Normal"}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setRows((current) => [
              ...current,
              { name: "", logoUrl: "", href: "", tier: "community" },
            ])
          }
        >
          Añadir
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() =>
            onSave({
              sponsors: rows.filter((row) => row.name.trim()),
              tickerSpeed: showSpeed ? speed : undefined,
            })
          }
        >
          Guardar
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
