import { initBotId } from "botid/client/core";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { HarnessId } from "../../lib/harness-poll";
import { HARNESS_OPTIONS } from "../../lib/harness-poll";

const STORAGE_KEY = "hackspain-harness-poll-v1";
const OTHER_ID = "other";

type Status = "idle" | "submitting" | "success";

function CheckIcon({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m5 12 4.5 4.5L19 7"
        stroke="currentColor"
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeWidth="3"
      />
    </svg>
  );
}

function storedAsSubmitted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "submitted";
  } catch {
    return false;
  }
}

function subscribeToStoredSubmission(): () => void {
  return () => null;
}

export function HarnessPollPage() {
  const [selected, setSelected] = useState<Set<HarnessId>>(new Set());
  const [otherSelected, setOtherSelected] = useState(false);
  const [other, setOther] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const alreadySubmitted = useSyncExternalStore(
    subscribeToStoredSubmission,
    storedAsSubmitted,
    () => false
  );

  useEffect(() => {
    if (!import.meta.env.DEV) {
      initBotId({
        protect: [{ method: "POST", path: "/api/poll-harness" }],
      });
    }
  }, []);

  function toggleHarness(id: HarnessId) {
    setError("");
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    setError("");

    if (selected.size === 0 && !otherSelected) {
      setError("Selecciona al menos una opción.");
      return;
    }
    if (otherSelected && !other.trim()) {
      setError("Cuéntanos qué otro harness crees que usarás.");
      return;
    }

    setStatus("submitting");
    try {
      const response = await fetch("/api/poll-harness", {
        body: JSON.stringify({
          harnesses: [...selected],
          other: otherSelected ? other.trim() : undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("request_failed");
      }
      try {
        localStorage.setItem(STORAGE_KEY, "submitted");
      } catch {
        // A private browser may block storage; the response is still recorded.
      }
      setStatus("success");
    } catch {
      setStatus("idle");
      setError("No hemos podido guardar tu respuesta. Inténtalo de nuevo.");
    }
  }

  if (status === "success" || alreadySubmitted) {
    return (
      <section className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-2xl items-center px-4 py-10 sm:px-6">
        <div className="w-full border-[3px] border-hs-ink bg-hs-gold p-6 shadow-[8px_8px_0_var(--color-hs-ink)] sm:p-10">
          <span className="mb-6 grid size-14 place-items-center border-[3px] border-hs-ink bg-hs-paper text-hs-ink">
            <CheckIcon className="size-7" />
          </span>
          <h1 className="text-balance font-bungee text-3xl text-hs-ink leading-tight sm:text-5xl">
            ¡Gracias!
          </h1>
          <p className="mt-4 max-w-lg text-pretty font-bold text-hs-brown text-lg">
            Ya tenemos tu respuesta. Nos ayuda a preparar mejor el evento.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <h1 className="text-balance font-bungee text-3xl text-hs-ink leading-[1.08] sm:text-5xl">
          ¿Qué harnesses piensas utilizar?
        </h1>
        <p className="mt-5 max-w-2xl text-pretty font-bold text-base text-hs-brown leading-relaxed sm:text-lg">
          No tienen por qué ser los que finalmente uses en el evento: marca los
          que ahora mismo crees que utilizarás. No hay ninguna limitación sobre
          qué herramienta puedes usar.
        </p>
      </header>

      <form noValidate onSubmit={submit}>
        <fieldset disabled={status === "submitting"}>
          <legend className="sr-only">
            Harnesses que crees que utilizarás
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {HARNESS_OPTIONS.map((option) => {
              const checked = selected.has(option.id);
              return (
                <label
                  className="group flex min-h-16 cursor-pointer items-center gap-4 border-[3px] border-hs-ink bg-hs-paper p-3 outline-none transition-[transform,background-color] duration-150 ease-out has-focus-visible:border-hs-navy has-focus-visible:ring-2 has-focus-visible:ring-hs-navy/30 motion-safe:active:scale-[0.96]"
                  key={option.id}
                >
                  <input
                    checked={checked}
                    className="sr-only"
                    onChange={() => toggleHarness(option.id)}
                    type="checkbox"
                  />
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center border-[3px] border-hs-ink bg-white/45"
                  >
                    <img
                      alt=""
                      className={`object-contain ${option.id === "devin-desktop" ? "size-7" : "size-6"}`}
                      height="24"
                      src={option.logoSrc}
                      width="24"
                    />
                  </span>
                  <span className="min-w-0 flex-1 font-black font-sans text-base text-hs-ink">
                    {option.name}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`grid size-6 shrink-0 place-items-center border-[3px] border-hs-ink transition-colors duration-150 ${checked ? "bg-hs-gold" : "bg-hs-paper"}`}
                  >
                    {checked ? <CheckIcon className="size-4" /> : null}
                  </span>
                </label>
              );
            })}

            <label className="group flex min-h-16 cursor-pointer items-center gap-4 border-[3px] border-hs-ink bg-hs-paper p-3 outline-none transition-[transform,background-color] duration-150 ease-out has-focus-visible:border-hs-navy has-focus-visible:ring-2 has-focus-visible:ring-hs-navy/30 motion-safe:active:scale-[0.96] sm:col-span-2">
              <input
                checked={otherSelected}
                className="sr-only"
                onChange={(event) => {
                  setError("");
                  setOtherSelected(event.target.checked);
                }}
                type="checkbox"
              />
              <span className="grid size-10 shrink-0 place-items-center border-[3px] border-hs-ink bg-hs-paper font-black font-mono text-hs-ink text-sm">
                +
              </span>
              <span className="min-w-0 flex-1 font-black font-sans text-base text-hs-ink">
                Otro
              </span>
              <span
                aria-hidden="true"
                className={`grid size-6 shrink-0 place-items-center border-[3px] border-hs-ink transition-colors duration-150 ${otherSelected ? "bg-hs-gold" : "bg-hs-paper"}`}
              >
                {otherSelected ? <CheckIcon className="size-4" /> : null}
              </span>
            </label>
          </div>
        </fieldset>

        {otherSelected ? (
          <div className="mt-3">
            <label className="sr-only" htmlFor={OTHER_ID}>
              Otro harness
            </label>
            <input
              autoComplete="off"
              className="h-12 w-full border-[3px] border-hs-ink bg-hs-paper px-4 font-bold font-sans text-base text-hs-ink outline-none placeholder:text-hs-brown/55 focus-visible:border-hs-navy focus-visible:ring-2 focus-visible:ring-hs-navy/30"
              id={OTHER_ID}
              maxLength={80}
              onChange={(event) => {
                setError("");
                setOther(event.target.value);
              }}
              placeholder="¿Cuál?"
              value={other}
            />
          </div>
        ) : null}

        <div aria-live="polite" className="min-h-12 pt-3">
          {error ? (
            <p className="border-hs-red border-l-[5px] pl-3 font-bold text-hs-red text-sm">
              {error}
            </p>
          ) : null}
        </div>

        <button
          className="flex min-h-14 w-full items-center justify-center gap-2 border-[3px] border-hs-ink bg-hs-gold px-6 font-bungee text-base text-hs-ink shadow-[5px_5px_0_var(--color-hs-ink)] outline-none transition-[transform,filter,box-shadow] duration-150 ease-out hover:brightness-95 focus-visible:ring-2 focus-visible:ring-hs-navy focus-visible:ring-offset-2 focus-visible:ring-offset-hs-paper active:translate-x-1 active:translate-y-1 active:shadow-[1px_1px_0_var(--color-hs-ink)] disabled:cursor-wait disabled:opacity-70 sm:w-auto sm:min-w-56"
          disabled={status === "submitting"}
          type="submit"
        >
          {status === "submitting" ? (
            <>
              <span
                aria-hidden="true"
                className="size-5 animate-spin border-[3px] border-hs-ink border-r-transparent"
              />
              Guardando…
            </>
          ) : (
            "Enviar respuesta"
          )}
        </button>
      </form>
    </section>
  );
}
