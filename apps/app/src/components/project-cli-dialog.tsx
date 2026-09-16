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
          <DialogTitle>Retos y envío desde la CLI</DialogTitle>
          <DialogDescription>
            El proyecto se apunta a los retos y se envía con la CLI de
            hackspain, con la misma cuenta que este dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="font-bungee text-xs">1 · Instala e inicia sesión</p>
          <CodeBlock>
            {"curl -fsSL https://hackspain.com/install.sh | sh\nhackspain auth login"}
          </CodeBlock>
        </div>

        <div className="space-y-2">
          <p className="font-bungee text-xs">2 · Entra en los retos</p>
          <CodeBlock>
            {
              "hackspain track list                 # los retos y en cuáles estás\nhackspain track register maisa embat  # entra en uno o varios\nhackspain track unregister embat      # sal de uno\nhackspain track move embat theker     # cambia uno por otro"
            }
          </CodeBlock>
          <p className="text-sm text-hs-brown">
            Un proyecto puede entrar en tantos retos como quieras. Los slugs
            son los de <code className="font-mono text-xs">hackspain track list</code>.
          </p>
        </div>

        <div className="space-y-2">
          <p className="font-bungee text-xs">3 · Guarda y envía el proyecto</p>
          <CodeBlock>
            {
              "hackspain submit --draft            # guarda sin enviar, se puede editar\nhackspain submit                    # envía; pregunta lo que falte\nhackspain submit --name \"Ledgerito\" --repo https://github.com/org/repo --demo https://… --video https://…\nhackspain project show              # cómo está tu proyecto"
            }
          </CodeBlock>
          <p className="text-sm text-hs-brown">
            Un proyecto enviado queda bloqueado. El envío solo funciona mientras
            la ventana esté abierta.
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
