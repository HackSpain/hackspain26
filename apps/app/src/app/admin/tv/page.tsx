"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ExternalLink, Monitor, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { SCREEN_LIMIT, SCREEN_OFFLINE_MS, SCREEN_PRESETS, screenKey, screenPreset } from "@convex/lib/tvScreens";
import type { ScreenPreset } from "@convex/lib/tvScreens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError, FormNotice, LoadingText, Page, errorMessage } from "@/components/page";
import { useClock } from "@/components/tv/motion";

type Screen = FunctionReturnType<typeof api.tvPlayback.screens>["screens"][number];
const fieldClass = "min-h-11 w-full border-2 border-hs-ink/25 bg-hs-paper px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-hs-navy";

function ScreenCard({ screen, now }: { screen: Screen; now: number }) {
  const save = useMutation(api.tvPlayback.setScreen);
  const reload = useMutation(api.tvPlayback.reloadScreen);
  const remove = useMutation(api.tvPlayback.removeScreen);
  const [preset, setPreset] = useState<ScreenPreset>(screen.preset);
  const [message, setMessage] = useState(screen.message);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const online = screen.connections.filter((connection) => now - connection.lastSeenAt < SCREEN_OFFLINE_MS);
  const path = `/tv?screen=${encodeURIComponent(screen.key)}`;
  const pending = online.some((connection) => connection.receivedRevision < screen.revision || connection.receivedReloadVersion < screen.reloadVersion);
  async function update(action: "save" | "reload" | "remove") {
    setBusy(true); setFailure(null); setNotice(null);
    try {
      if (action === "remove") { await remove({ key: screen.key }); }
      else if (action === "reload") { await reload({ key: screen.key }); setNotice("Recarga enviada a esta pantalla."); }
      else { await save({ key: screen.key, preset, message }); setNotice("Contenido guardado. Se enviará a esta pantalla."); }
    } catch (error) { setFailure(errorMessage(error, "No se ha podido actualizar la pantalla")); }
    finally { setBusy(false); }
  }
  return (
    <section className="space-y-5 border-2 border-hs-ink/20 bg-hs-paper p-5 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
          <Monitor className="size-6 shrink-0 text-hs-teal" aria-hidden />
          <h2 className="font-bungee text-xl">{screen.key}</h2>
          <a href={path} target="_blank" rel="noreferrer" className="min-w-0 break-all text-sm text-hs-navy underline underline-offset-4">{path} <ExternalLink className="inline size-3" aria-hidden /></a>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="outline" size="icon" aria-label={`Recargar ${screen.key}`} title="Recargar pantalla" disabled={busy} onClick={() => void update("reload")}><RotateCcw aria-hidden /></Button>
          {!online.length ? <Button variant="outline" size="icon" className="text-hs-red" aria-label={`Borrar ${screen.key}`} title="Borrar pantalla" disabled={busy} onClick={() => void update("remove")}><Trash2 aria-hidden /></Button> : null}
        </div>
      </header>
        <p className={`text-sm font-medium ${online.length ? "text-hs-teal" : "text-hs-brown"}`}>{online.length ? "Conectada" : "Sin conexión"}{pending ? " · orden pendiente" : online.length ? " · al día" : ""}</p>

      {online.length > 1 ? <p className="border-l-4 border-hs-gold pl-3 text-sm">{online.length} conexiones comparten este identificador. Recibirán los mismos cambios. Usa otro nombre para controlarlas por separado.</p> : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="space-y-2 text-sm font-medium">Contenido
          <select className={fieldClass} value={preset} onChange={(event) => setPreset(screenPreset(event.target.value))}>
            {SCREEN_PRESETS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <Button disabled={busy || (preset === screen.preset && message === screen.message)} onClick={() => void update("save")}>Aplicar a esta pantalla</Button>
      </div>
      <p className="text-sm text-hs-brown">{SCREEN_PRESETS.find((option) => option.value === preset)?.description}</p>
      {preset === "avisos" ? <label className="block space-y-2 text-sm font-medium">Mensaje
        <textarea className={`${fieldClass} min-h-28 resize-y`} maxLength={500} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="La siguiente charla comienza a las 17:00" />
        <span className="text-xs text-hs-brown">{message.length}/500 · Sólo se muestra en esta pantalla.</span>
      </label> : null}
      <details className="text-sm text-hs-brown">
        <summary className="cursor-pointer py-2">Conexiones y última respuesta ({screen.connections.length})</summary>
        <ul className="space-y-3 pt-2">
          {screen.connections.map((connection) => (
            <li key={connection._id} className="border-t border-hs-ink/10 pt-3">
              <p>{now - connection.lastSeenAt < SCREEN_OFFLINE_MS ? "Activa" : "Sin respuesta"} · {connection.width} × {connection.height} · {new Date(connection.lastSeenAt).toLocaleTimeString("es-ES")}</p>
              <p className="mt-1 break-all text-xs">{connection.url}</p>
            </li>
          ))}
          {!screen.connections.length ? <li>Abre la URL en el navegador de la pantalla para conectarla.</li> : null}
        </ul>
      </details>
      <FormError message={failure} /><FormNotice message={notice} />
    </section>
  );
}

export default function AdminTvPage() {
  const data = useQuery(api.tvPlayback.screens);
  const create = useMutation(api.tvPlayback.setScreen);
  const now = useClock();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  async function add() {
    setBusy(true); setFailure(null);
    try {
      const key = screenKey(name);
      if (data?.screens.some((screen) => screen.key === key)) { throw new Error("Ya existe una pantalla con ese nombre"); }
      await create({ key, preset: "espera", message: "" }); setName("");
    } catch (error) { setFailure(errorMessage(error, "No se ha podido crear la pantalla")); }
    finally { setBusy(false); }
  }
  return (
    <Page title="Pantallas" description="Asigna una vista a cada pantalla y contrólala desde aquí. Los cambios llegan en tiempo real.">
      <section className="space-y-4 border-2 border-hs-ink bg-hs-gold/15 p-5">
        <h2 className="font-bungee">Conectar una pantalla</h2>
        <p className="max-w-3xl text-sm">Abre <code>/tv?screen=entrada</code> en su navegador. Cambia «entrada» por «auditorio», «hall» o un nombre único. Aparecerá aquí automáticamente. También puedes prepararla antes de conectarla. Las pantallas se registran solas hasta {SCREEN_LIMIT}; a partir de ahí, borra las que sobren o prepara aquí las nuevas.</p>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void add(); }}>
          <label htmlFor="screen-name" className="min-w-48 flex-1 space-y-2 text-sm font-medium">Nombre de pantalla<Input id="screen-name" value={name} maxLength={48} onChange={(event) => setName(event.target.value)} placeholder="auditorio" required /></label>
          <Button type="submit" disabled={busy || !data || !name.trim()}>Preparar pantalla</Button>
        </form>
        <FormError message={failure} />
      </section>
      {!data ? <LoadingText /> : data.screens.length ? (
        <div className="grid gap-5 lg:grid-cols-2">{data.screens.map((screen) => <ScreenCard key={`${screen._id}:${screen.revision}`} screen={screen} now={now?.getTime() ?? data.serverTime} />)}</div>
      ) : <p className="py-10 text-center text-hs-brown">Todavía no hay pantallas. Abre su URL o prepara la primera arriba.</p>}
      <p className="text-sm text-hs-brown">Una pantalla sin respuesta durante 45 segundos aparece desconectada. Las órdenes se conservan hasta que vuelva a conectarse. Recargar no enciende un ordenador apagado o suspendido.</p>
    </Page>
  );
}
