"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CheckCircle2, ChevronRight, Loader2, Send } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { FormError, Page, errorMessage } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn, notificationStatusLabel } from "@/lib/utils";

type Audience = "all" | "accepted" | "attending" | "user";

const AUDIENCE_LABEL: Record<Audience, string> = {
  all: "Quien ha dado consentimiento",
  accepted: "Hackers aceptados",
  attending: "Hackers que asisten",
  user: "Un usuario",
};

const AUDIENCES: Audience[] = ["all", "accepted", "attending", "user"];

// Most mail clients truncate the subject line around here.
const SUBJECT_SOFT_LIMIT = 70;

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

function ComposeField({
  label,
  htmlFor,
  meta,
  children,
}: {
  label: string;
  htmlFor?: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-4 items-baseline justify-between gap-3">
        <Label
          htmlFor={htmlFor}
          className="text-xs tracking-[0.08em] text-hs-ink/70"
        >
          {label}
        </Label>
        {meta}
      </div>
      {children}
    </div>
  );
}

function RecipientCount({
  count,
  single,
  needsEmail,
}: {
  count: number | undefined;
  single: boolean;
  needsEmail: boolean;
}) {
  const counting = count === undefined;
  const empty = count === 0;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={counting}
      className={cn(
        "flex items-baseline gap-2 border-[3px] px-3 py-2.5 motion-safe:transition-[border-color,background-color] motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)]",
        empty && !needsEmail
          ? "border-hs-orange bg-hs-orange/10"
          : "border-hs-ink bg-hs-paper",
      )}
    >
      <span
        className={cn(
          "font-bungee text-2xl leading-none tabular-nums",
          (counting || needsEmail) && "text-hs-ink/40",
        )}
      >
        {counting || needsEmail ? "—" : count}
      </span>
      <span className="text-sm leading-snug text-pretty text-hs-brown">
        {counting
          ? "contando destinatarios…"
          : needsEmail && empty
            ? "escribe el email de un usuario del panel"
            : empty
              ? single
                ? "no está en el panel o no ha dado consentimiento"
                : "nadie con consentimiento en esta audiencia"
              : `${plural(count, "destinatario", "destinatarios")} con consentimiento`}
      </span>
    </div>
  );
}

type HistoryItem = FunctionReturnType<typeof api.notifications.list>[number];

const SHORT_DATE = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const SHORT_DATE_WITH_YEAR = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const FULL_DATE = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "full",
  timeStyle: "medium",
});

function formatSentAt(ms: number) {
  const date = new Date(ms);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return (sameYear ? SHORT_DATE : SHORT_DATE_WITH_YEAR).format(date);
}

function statusLabel(status: HistoryItem["status"]) {
  return status === "failed" ? "Fallido" : notificationStatusLabel(status);
}

function DeliveryBar({ item }: { item: HistoryItem }) {
  const total = item.recipientCount;
  const failed = item.failures.length;
  const sentPct = total > 0 ? (item.sentCount / total) * 100 : 0;
  const failedPct = total > 0 ? (failed / total) * 100 : 0;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div
        aria-hidden
        className="h-1.5 w-full max-w-48 flex-1 overflow-hidden bg-hs-sand"
      >
        <div className="flex h-full origin-left scale-x-100 motion-safe:transition-transform motion-safe:duration-[280ms] motion-safe:ease-[var(--ease-out)] starting:scale-x-0">
          <div className="h-full bg-hs-teal" style={{ width: `${sentPct}%` }} />
          <div className="h-full bg-hs-red" style={{ width: `${failedPct}%` }} />
        </div>
      </div>
      <p className="text-xs tabular-nums text-hs-ink/70">
        <span className="text-hs-ink">
          {item.sentCount}/{total}
        </span>{" "}
        {plural(total, "entregado", "entregados")}
        {failed > 0 ? (
          <>
            {" · "}
            <span className="font-medium text-hs-red">
              {failed} {plural(failed, "fallido", "fallidos")}
            </span>
          </>
        ) : item.status === "queued" ? (
          " · en cola"
        ) : null}
      </p>
    </div>
  );
}

function HistoryBody({ body }: { body: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, body]);

  return (
    <div className="max-w-[64ch]">
      <p
        ref={ref}
        className={cn(
          "whitespace-pre-wrap break-words text-sm leading-relaxed text-pretty",
          !expanded && "line-clamp-2",
        )}
      >
        {body}
      </p>
      {overflows || expanded ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="-my-1.5 -ml-1 mt-0.5 px-1 py-1.5 font-bungee text-xs text-hs-navy underline-offset-2 hover:underline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-hs-navy"
        >
          {expanded ? "Ver menos" : "Ver más"}
        </button>
      ) : null}
    </div>
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const sentAt = new Date(item.sentAt);
  const failed = item.failures.length;
  return (
    <li className="space-y-2.5 px-4 py-4 transition-colors duration-100 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-hs-sand/40">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <h3 className="min-w-0 font-bungee text-sm leading-snug text-balance">
          {item.subject}
        </h3>
        <Badge
          variant={item.status === "sent" ? "gold" : "default"}
          className={cn(
            "whitespace-nowrap",
            item.status === "failed" && "bg-hs-red text-hs-paper",
          )}
        >
          {statusLabel(item.status)}
        </Badge>
        <time
          dateTime={sentAt.toISOString()}
          title={FULL_DATE.format(sentAt)}
          className="ml-auto text-xs tabular-nums text-hs-ink/70"
        >
          {formatSentAt(item.sentAt)}
        </time>
      </div>
      <p className="break-words text-xs text-hs-brown">
        {AUDIENCE_LABEL[item.audience]}
        {item.recipientEmail ? ` · ${item.recipientEmail}` : ""}
        {item.sentByEmail ? ` · por ${item.sentByEmail}` : ""}
      </p>
      <HistoryBody body={item.body} />
      <DeliveryBar item={item} />
      {failed > 0 ? (
        <details className="group/failures text-xs">
          <summary className="-my-1.5 -ml-1 flex w-fit cursor-pointer select-none list-none items-center gap-1 px-1 py-1.5 font-bungee text-hs-red focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-hs-navy [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden
              className="size-3.5 shrink-0 motion-safe:transition-transform motion-safe:duration-[160ms] motion-safe:ease-out group-open/failures:rotate-90"
            />
            {failed} {plural(failed, "fallo", "fallos")}
          </summary>
          <ul className="mt-2 space-y-1.5 border-l-[3px] border-hs-red/40 pl-3 font-mono text-xs">
            {item.failures.map((failure) => (
              <li key={failure.email} className="break-words">
                <span className="text-hs-ink">{failure.email}</span>
                {failure.error ? (
                  <span className="text-hs-brown"> — {failure.error}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

export default function AdminNotificationsPage() {
  const ids = useId();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const count = useQuery(api.notifications.recipientCount, {
    audience,
    recipientEmail: audience === "user" ? recipientEmail : undefined,
  });
  const history = useQuery(api.notifications.list);
  const send = useMutation(api.notifications.send);

  const subjectLength = subject.trim().length;
  const bodyLength = body.trim().length;
  const ready =
    subjectLength > 0 && bodyLength > 0 && count !== undefined && count > 0;

  async function submit() {
    if (pending || !ready) return;
    setError(null);
    setNotice(null);
    const ok = window.confirm(
      `¿Enviar «${subject.trim()}» a ${count} ${plural(count, "destinatario", "destinatarios")}?`,
    );
    if (!ok) return;
    setPending(true);
    try {
      await send({
        subject,
        body,
        audience,
        recipientEmail: audience === "user" ? recipientEmail : undefined,
      });
      setNotice(
        `En cola para ${count} ${plural(count, "destinatario", "destinatarios")}.`,
      );
      setSubject("");
      setBody("");
    } catch (err) {
      setError(errorMessage(err, "No se ha podido enviar el aviso"));
    } finally {
      setPending(false);
    }
  }

  function edit(setter: (value: string) => void) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setter(event.target.value);
      if (notice) setNotice(null);
      if (error) setError(null);
    };
  }

  return (
    <Page
      title="Avisos"
      description="Email a quien ha dado consentimiento para avisos operativos."
    >
      <Card className="hs-enter">
        <CardHeader>
          <CardTitle>Redactar</CardTitle>
          <CardDescription className="max-w-[60ch] text-pretty">
            Email en texto plano desde la dirección de HackSpain. Solo llega a
            quien ha dado consentimiento.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)] lg:gap-6">
          <div className="min-w-0 max-w-[64ch] space-y-4">
            <ComposeField
              label="Asunto"
              htmlFor={`${ids}-subject`}
              meta={
                subjectLength > SUBJECT_SOFT_LIMIT - 10 ? (
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      subjectLength > SUBJECT_SOFT_LIMIT
                        ? "text-hs-orange"
                        : "text-hs-brown",
                    )}
                  >
                    {subjectLength} caracteres
                    {subjectLength > SUBJECT_SOFT_LIMIT
                      ? " · se cortará en el buzón"
                      : ""}
                  </span>
                ) : null
              }
            >
              <Input
                id={`${ids}-subject`}
                className="max-w-[48ch]"
                autoComplete="off"
                placeholder="Cambio de sala para la charla de las 10:00"
                value={subject}
                onChange={edit(setSubject)}
              />
            </ComposeField>
            <ComposeField
              label="Mensaje"
              htmlFor={`${ids}-body`}
              meta={
                bodyLength > 0 ? (
                  <span className="text-xs tabular-nums text-hs-brown">
                    {bodyLength} {plural(bodyLength, "carácter", "caracteres")}
                  </span>
                ) : null
              }
            >
              <Textarea
                id={`${ids}-body`}
                rows={8}
                className="min-h-48 max-h-[60vh] field-sizing-content leading-relaxed"
                placeholder="Texto plano. Los saltos de línea se respetan."
                value={body}
                onChange={edit(setBody)}
              />
            </ComposeField>
          </div>

          <aside className="min-w-0 space-y-4 bg-hs-sand p-4 lg:sticky lg:top-4">
            <ComposeField label="Destinatarios" htmlFor={`${ids}-audience`}>
              <Select
                value={audience}
                onValueChange={(next) => setAudience(next as Audience)}
              >
                <SelectTrigger id={`${ids}-audience`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {AUDIENCE_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ComposeField>
            {audience === "user" ? (
              <ComposeField label="Email del usuario" htmlFor={`${ids}-email`}>
                <Input
                  id={`${ids}-email`}
                  type="email"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="nombre@dominio.com"
                  value={recipientEmail}
                  onChange={edit(setRecipientEmail)}
                />
              </ComposeField>
            ) : null}

            <RecipientCount
              count={count}
              single={audience === "user"}
              needsEmail={audience === "user" && !recipientEmail.trim()}
            />

            <Button
              className="w-full focus-visible:ring-[3px] focus-visible:ring-hs-navy focus-visible:ring-offset-2 focus-visible:ring-offset-hs-sand aria-busy:cursor-progress"
              disabled={!ready}
              aria-busy={pending}
              onClick={() => void submit()}
            >
              {pending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Send aria-hidden />
              )}
              {pending ? "Enviando…" : "Enviar"}
            </Button>

            {notice ? (
              <p
                role="status"
                className="flex items-start gap-2 text-sm text-hs-teal"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                {notice}
              </p>
            ) : null}
            <FormError message={error} />
          </aside>
        </CardContent>
      </Card>

      <section aria-labelledby={`${ids}-history`} className="grid gap-3">
        <h2
          id={`${ids}-history`}
          className="flex items-baseline gap-2 font-bungee text-lg"
        >
          Envíos anteriores
          {history && history.length > 0 ? (
            <span className="text-sm tabular-nums text-hs-ink/50">
              {history.length}
            </span>
          ) : null}
        </h2>
        <div className="border-[3px] border-hs-ink bg-hs-paper">
          {history === undefined ? (
            <p className="px-4 py-8 text-center text-sm text-hs-brown">
              Cargando…
            </p>
          ) : history.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-pretty text-hs-brown">
              Todavía no has enviado ningún aviso.
            </p>
          ) : (
            <ol className="divide-y-2 divide-hs-ink/15">
              {history.map((item) => (
                <HistoryRow key={item._id} item={item} />
              ))}
            </ol>
          )}
        </div>
      </section>
    </Page>
  );
}
