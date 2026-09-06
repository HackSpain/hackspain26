"use client";

import { ExternalLink } from "lucide-react";
import { Page } from "@/components/page";
import { TvEditor } from "@/components/tv/editor";

export default function AdminTvPage() {
  return (
    <Page
      title="Pantalla principal"
      description={
        <>
          Edita la pantalla del venue. Doble clic para escribir; guarda un
          estado y ponlo en vivo para{" "}
          <a
            href="/tv"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-hs-navy underline underline-offset-[3px]"
          >
            /tv
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
          .
        </>
      }
    >
      <TvEditor />
    </Page>
  );
}
