"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CodeBlock } from "@/components/team-cli-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Same shape as TeamCliDialog: tracks are entered and projects submitted from the CLI. */
export function ProjectCliDialog({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retos desde la CLI</DialogTitle>
          <DialogDescription>
            El equipo se apunta a un reto con la CLI de hackspain, con la
            misma cuenta que este dashboard. La entrega es en Submit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="font-bungee text-xs">1 · Instala e inicia sesión</p>
          <CodeBlock>
            {"curl -fsSL https://hackspain.com/install.sh | sh\nhackspain auth login"}
          </CodeBlock>
        </div>

        <div className="space-y-2">
          <p className="font-bungee text-xs">2 · Entra en un reto</p>
          <CodeBlock>
            {
              "hackspain track list                # los retos y en cuáles estás\nhackspain track register maisa      # entra en un reto\nhackspain track register theker     # THEKER puede sumarse como segundo\nhackspain track unregister theker   # sal de un reto"
            }
          </CodeBlock>
          <p className="text-sm text-hs-brown">
            Un equipo entra en un reto, o en dos si uno es THEKER. El slug es el de{" "}
            <code className="font-mono text-xs">hackspain track list</code>.
          </p>
        </div>

        <div className="space-y-2">
          <p className="font-bungee text-xs">3 · Entrega en el dashboard</p>
          <p className="text-sm text-hs-brown">
            El vídeo de YouTube, el repo público y el enlace al producto se
            envían en{" "}
            <Link
              href="/submit"
              className="text-hs-navy underline decoration-hs-navy/40 underline-offset-[3px]"
            >
              /submit
            </Link>
            . Un proyecto enviado queda bloqueado.
          </p>
        </div>

        <p className="text-sm text-hs-brown">
          Todos los comandos, en la{" "}
          <Link
            href="/cli"
            className="text-hs-navy underline decoration-hs-navy/40 underline-offset-[3px]"
          >
            guía completa de la CLI
          </Link>
          .
        </p>
      </DialogContent>
    </Dialog>
  );
}
