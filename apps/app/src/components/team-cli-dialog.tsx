"use client";

import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type CommandLine = {
  command: string;
  comment: string | null;
};

function commandLines(source: string): CommandLine[] {
  return source.split("\n").flatMap((raw) => {
    const line = raw.trim();
    if (!line) return [];
    const hash = line.indexOf(" #");
    if (hash === -1) return [{ command: line, comment: null }];
    return [
      {
        command: line.slice(0, hash).trimEnd(),
        comment: line.slice(hash + 2).trim() || null,
      },
    ];
  });
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {}

  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  try {
    field.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

function LineCopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  return (
    <button
      type="button"
      aria-live="polite"
      aria-label={copied ? `Copiado: ${value}` : `Copiar: ${value}`}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center gap-1.5 px-1.5 font-bungee text-[11px] uppercase tracking-wide outline-none",
        "text-hs-paper/70 hover:text-hs-paper focus-visible:text-hs-paper focus-visible:ring-2 focus-visible:ring-hs-gold",
        "motion-safe:transition-[color,transform] motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.96]",
        copied && "text-hs-gold hover:text-hs-gold",
      )}
      onClick={() => {
        void copyText(value).then((ok) => {
          if (ok) setCopied(true);
        });
      }}
    >
      <span className="relative size-3.5 shrink-0">
        <AnimatePresence initial={false}>
          <motion.span
            key={copied ? "copied" : "idle"}
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { type: "spring", duration: 0.3, bounce: 0 }
            }
          >
            {copied ? (
              <Check className="size-3.5" strokeWidth={2} aria-hidden />
            ) : (
              <Copy className="size-3.5" strokeWidth={2} aria-hidden />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="w-[4.75rem] text-left">{copied ? "Copiado" : "Copiar"}</span>
    </button>
  );
}

export function CodeBlock({ children }: { children: string }) {
  const lines = commandLines(children);

  return (
    <div className="border-[3px] border-hs-ink bg-hs-ink">
      <ul className="m-0 flex list-none flex-col p-0">
        {lines.map((line, index) => (
          <li
            key={`${index}-${line.command}`}
            className="flex items-center gap-2 px-3"
          >
            <pre className="min-w-0 flex-1 overflow-x-auto py-2 font-mono text-xs leading-relaxed text-hs-paper">
              <code>{line.command}</code>
              {line.comment ? (
                <span className="text-hs-paper/45">{`  # ${line.comment}`}</span>
              ) : null}
            </pre>
            <LineCopyButton value={line.command} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TeamCliDialog({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tu equipo desde la CLI</DialogTitle>
          <DialogDescription>
            Los equipos se crean y se gestionan con la CLI de hackspain, con la
            misma cuenta que este dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="font-bungee text-xs">1 · Instala e inicia sesión</p>
          <CodeBlock>
            {"curl -fsSL https://hackspain.com/install.sh | sh\nhackspain auth login"}
          </CodeBlock>
        </div>

        <div className="space-y-2">
          <p className="font-bungee text-xs">2 · Crea o únete</p>
          <CodeBlock>
            {"hackspain team create <nombre>\nhackspain team join <código>"}
          </CodeBlock>
          <p className="text-sm text-hs-brown">
            El código de invitación tiene 8 caracteres y lo comparte el dueño
            del equipo: lo ve (o lo regenera) con{" "}
            <code className="font-mono text-xs">hackspain team code</code>.
          </p>
        </div>

        <div className="space-y-2">
          <p className="font-bungee text-xs">3 · Gestiona el equipo</p>
          <CodeBlock>
            {
              "hackspain team repo <url>      # vincula el repo de GitHub\nhackspain team transfer [member]\nhackspain team dissolve\nhackspain stack set nextjs convex claude-code"
            }
          </CodeBlock>
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
