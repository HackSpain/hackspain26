"use client";

import { useMutation } from "convex/react";
import { Github } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import { errorMessage } from "@/components/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const RESULT_MESSAGES: Record<
  string,
  { text: string; variant: "success" | "error" }
> = {
  cancelled: {
    text: "Has cancelado la vinculación con GitHub.",
    variant: "error",
  },
  error: {
    text: "No hemos podido vincular tu GitHub. Inténtalo otra vez.",
    variant: "error",
  },
  expired: {
    text: "El enlace ha caducado. Vuelve a intentarlo.",
    variant: "error",
  },
  linked: { text: "GitHub vinculado.", variant: "success" },
  taken: {
    text: "Esa cuenta de GitHub ya está vinculada a otro usuario.",
    variant: "error",
  },
};

export function useGithubLink() {
  const startLink = useMutation(api.github.startLink);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function link() {
    setError(null);
    setPending(true);
    try {
      const { url } = await startLink({});
      window.location.assign(url);
    } catch (caughtError: unknown) {
      setError(
        errorMessage(caughtError, "No hemos podido empezar la vinculación")
      );
      setPending(false);
    }
  }

  return { error, link, pending };
}

export function GithubLinkResult() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = params.get("github");
  const [shown, setShown] = useState<{
    status: string;
    pathname: string;
  } | null>(null);

  if (status && shown?.status !== status) {
    setShown({ pathname, status });
  } else if (!status && shown && shown.pathname !== pathname) {
    setShown(null);
  }

  useEffect(() => {
    if (!status) {
      return;
    }
    const next = new URLSearchParams(params);
    next.delete("github");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [params, pathname, router, status]);

  const result = shown ? RESULT_MESSAGES[shown.status] : undefined;
  if (!result) {
    return null;
  }
  return (
    <Alert variant={result.variant} className="mb-6">
      <AlertDescription className="text-hs-ink">{result.text}</AlertDescription>
    </Alert>
  );
}

export function GithubLinkBanner() {
  const { link, pending, error } = useGithubLink();

  return (
    <div className="border-b-[3px] border-hs-ink bg-hs-gold text-hs-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Github className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="font-bungee text-sm leading-tight">
              Por favor, vincula tu GitHub
            </p>
            <p className="text-sm">
              Lo usamos para encontrarte en tu equipo y ligar tu proyecto.
              {error ? <span className="text-hs-red"> {error}</span> : null}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full bg-hs-paper sm:w-auto"
          disabled={pending}
          onClick={() => void link()}
        >
          {pending ? "Abriendo GitHub…" : "Vincular GitHub"}
        </Button>
      </div>
    </div>
  );
}
