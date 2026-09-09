"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { FormError, FormNotice, errorMessage } from "@/components/page";

export function TvReloadControl() {
  const reload = useMutation(api.tvPlayback.reload);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  async function submit() {
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      await reload({});
      setNotice(
        "Orden enviada. Las TVs conectadas recargarán; las demás, al reconectar.",
      );
      setConfirming(false);
    } catch (error) {
      setFailure(errorMessage(error, "No se ha podido enviar la recarga."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 border-t border-hs-ink/15 pt-5">
      <h2 className="text-base">Recarga remota</h2>
      <p className="max-w-2xl text-sm text-hs-brown">
        Para cargar una nueva versión de la web. «Poner en vivo» ya cambia el
        contenido sin recargar. No recupera ordenadores suspendidos ni
        navegadores cerrados.
      </p>
      <FormError message={failure} />
      <FormNotice message={notice} />
      {confirming ? (
        <div className="space-y-3">
          <p className="text-sm">
            Todas las TVs tendrán una breve interrupción. ¿Recargar?
          </p>
          <div className="flex gap-3">
            <Button disabled={busy} onClick={() => void submit()}>
              Confirmar recarga
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setConfirming(true)}>
          Recargar todas las TVs
        </Button>
      )}
    </section>
  );
}
