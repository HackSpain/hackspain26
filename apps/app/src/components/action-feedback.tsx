"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { errorMessage, FormError } from "@/components/page";

/**
 * One in-flight action at a time with its success or error copy, for cards
 * that save a single thing (name, photo, handle). The action returns the
 * success message; an empty string shows nothing.
 */
export function useActionFeedback() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<string>) {
    if (pending) {
      return;
    }
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      setMessage(await action());
    } catch (caughtError: unknown) {
      setError(
        errorMessage(
          caughtError,
          "No hemos podido guardar el cambio. Inténtalo de nuevo."
        )
      );
    } finally {
      setPending(false);
    }
  }

  function clearFeedback() {
    setMessage(null);
    setError(null);
  }

  return { clearFeedback, error, message, pending, run };
}

export type ActionFeedback = ReturnType<typeof useActionFeedback>;

export function Feedback({
  action,
  hideMessage = false,
}: {
  action: ActionFeedback;
  hideMessage?: boolean;
}) {
  return (
    <>
      <FormError message={action.error} />
      <div role="status" aria-live="polite" aria-atomic="true">
        {action.message && !hideMessage ? (
          <p className="flex items-start gap-2 text-sm text-hs-navy">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            {action.message}
          </p>
        ) : null}
      </div>
    </>
  );
}
