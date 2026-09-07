"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import {
  Field,
  FormError,
  FormNotice,
  Page,
  errorMessage,
} from "@/components/page";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { notificationStatusLabel } from "@/lib/utils";

type Audience = "all" | "accepted" | "attending" | "user";

const AUDIENCE_LABEL: Record<Audience, string> = {
  accepted: "Hackers aceptados",
  all: "Quien ha dado consentimiento",
  attending: "Hackers que asisten",
  user: "Un usuario",
};

export default function AdminNotificationsPage() {
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

  async function submit() {
    setError(null);
    setNotice(null);
    if (count === undefined || count === 0) {
      return;
    }
    // oxlint-disable-next-line no-alert -- bulk sends require an explicit confirmation.
    const ok = window.confirm(
      `¿Enviar «${subject.trim()}» a ${count} destinatario${count === 1 ? "" : "s"}?`
    );
    if (!ok) {
      return;
    }
    setPending(true);
    try {
      await send({
        audience,
        body,
        recipientEmail: audience === "user" ? recipientEmail : undefined,
        subject,
      });
      setNotice(`En cola para ${count} destinatario${count === 1 ? "" : "s"}.`);
      setSubject("");
      setBody("");
    } catch (caughtError) {
      setError(errorMessage(caughtError, "No se ha podido enviar el aviso"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Page
      title="Avisos"
      description="Email a quien ha dado consentimiento para avisos operativos."
    >
      <Card className="hs-enter">
        <CardHeader>
          <CardTitle>Redactar</CardTitle>
          <CardDescription>
            Email en texto plano desde la dirección de HackSpain. Solo llega a
            quien ha dado consentimiento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormError message={error} />
          <FormNotice message={notice} />
          <Field label="Asunto" htmlFor="notif-subject">
            <Input
              id="notif-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </Field>
          <Field label="Mensaje" htmlFor="notif-body">
            <Textarea
              id="notif-body"
              rows={6}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Destinatarios">
              <Select
                value={audience}
                onValueChange={(next) => setAudience(next as Audience)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{AUDIENCE_LABEL.all}</SelectItem>
                  <SelectItem value="accepted">
                    {AUDIENCE_LABEL.accepted}
                  </SelectItem>
                  <SelectItem value="attending">
                    {AUDIENCE_LABEL.attending}
                  </SelectItem>
                  <SelectItem value="user">{AUDIENCE_LABEL.user}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {audience === "user" ? (
              <Field label="Email del usuario" htmlFor="notif-email">
                <Input
                  id="notif-email"
                  type="email"
                  value={recipientEmail}
                  onChange={(event) => setRecipientEmail(event.target.value)}
                />
              </Field>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              className="w-full sm:w-auto"
              disabled={
                pending ||
                count === undefined ||
                count === 0 ||
                !subject.trim() ||
                !body.trim()
              }
              onClick={() => void submit()}
            >
              {pending ? "Enviando…" : "Enviar"}
            </Button>
            <p className="text-sm text-hs-brown">
              {count === undefined
                ? "Contando destinatarios…"
                : `Llegará a ${count} destinatario${count === 1 ? "" : "s"}.`}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <h2 className="font-bungee text-lg">Envíos anteriores</h2>
        {history === undefined ? (
          <p className="text-sm text-hs-brown">Cargando…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-hs-brown">Aún no hay envíos.</p>
        ) : (
          history.map((item) => (
            <Card key={item._id} className="gap-3">
              <CardHeader>
                <CardTitle className="text-base">{item.subject}</CardTitle>
                <CardDescription>
                  {new Date(item.sentAt).toLocaleString()}
                  {item.sentByEmail ? ` · por ${item.sentByEmail}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="whitespace-pre-wrap break-words">{item.body}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={item.status === "sent" ? "gold" : "default"}>
                    {notificationStatusLabel(item.status)}
                  </Badge>
                  <Badge>
                    {AUDIENCE_LABEL[item.audience]}
                    {item.recipientEmail ? ` · ${item.recipientEmail}` : ""}
                  </Badge>
                  <span>
                    {item.sentCount}/{item.recipientCount} entregados
                    {item.failures.length > 0
                      ? ` · ${item.failures.length} fallidos`
                      : ""}
                  </span>
                </div>
                {item.failures.length > 0 ? (
                  <details className="text-xs text-hs-brown">
                    <summary className="cursor-pointer font-bungee">
                      Fallos
                    </summary>
                    <ul className="mt-1 space-y-1">
                      {item.failures.map((failure) => (
                        <li key={failure.email} className="break-words">
                          {failure.email}: {failure.error}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </Page>
  );
}
