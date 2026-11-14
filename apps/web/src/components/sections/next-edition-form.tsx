import type { FormEvent } from "react";
import { useId, useState } from "react";
import { Input } from "../form/input";
import { Button } from "../ui/button";

const ERROR_MESSAGES = {
  disposable_email: "Usa un email permanente; no aceptamos emails temporales.",
  error: "No se pudo guardar. Inténtalo de nuevo.",
  invalid_email: "Revisa el email: no parece válido.",
} as const;

type ErrorStatus = keyof typeof ERROR_MESSAGES;
type Status = "idle" | "submitting" | "success" | ErrorStatus;

function isErrorStatus(status: Status): status is ErrorStatus {
  return status in ERROR_MESSAGES;
}

function errorStatus(code: unknown): ErrorStatus {
  return code === "disposable_email" || code === "invalid_email"
    ? code
    : "error";
}

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
      if (response.ok) {
        setStatus("success");
        return;
      }
      const body: unknown = await response.json().catch(() => null);
      setStatus(
        errorStatus(
          body && typeof body === "object" && "error" in body
            ? body.error
            : undefined
        )
      );
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
      {isErrorStatus(status) && (
        <p className="mt-2 text-center font-bold text-xs">
          {ERROR_MESSAGES[status]}
        </p>
      )}
    </div>
  );
}
