import type { FormEvent } from "react";
import { useId, useState } from "react";
import { Input } from "../form/input";
import { Button } from "../ui/button";

type Status = "idle" | "submitting" | "success" | "error";

export function NextEditionForm({ className }: { className?: string }) {
  const inputId = useId();
  const [status, setStatus] = useState<Status>("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    try {
      const response = await fetch("/api/subscribe", {
        body: JSON.stringify({
          email: new FormData(event.currentTarget).get("email"),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setStatus(response.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div aria-live="polite" className={className}>
      {status === "success" ? (
        <p className="text-center font-bungee text-sm leading-snug">
          ¡APUNTADO! TE AVISAREMOS DE HACKSPAIN '27.
        </p>
      ) : (
        <form
          className="flex w-full @2xs:flex-row flex-col gap-2"
          onSubmit={submit}
        >
          <label className="sr-only" htmlFor={inputId}>
            Tu email
          </label>
          <Input
            autoComplete="email"
            className="!py-1.5"
            id={inputId}
            name="email"
            placeholder="tu@email.com"
            required
            type="email"
          />
          <Button
            className="shrink-0"
            disabled={status === "submitting"}
            size="micro"
            type="submit"
          >
            {status === "submitting" ? "ENVIANDO…" : "AVÍSAME"}
          </Button>
        </form>
      )}
      {status === "error" && (
        <p className="mt-2 text-center font-bold text-xs">
          No se pudo guardar. Inténtalo de nuevo.
        </p>
      )}
    </div>
  );
}
