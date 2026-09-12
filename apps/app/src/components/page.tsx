import type { ReactNode } from "react";
import type { UrlEntry } from "@/lib/urls";
import { urlDisplay, urlLabel, urlOf } from "@/lib/urls";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Page({
  title,
  description,
  children,
  className,
  compact = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn(compact ? "space-y-4" : "space-y-6", className)}>
      {title ? (
        <div className={cn("hs-enter min-w-0", compact && "shrink-0")}>
          {typeof title === "string" ? (
            <h1 className="font-bungee text-2xl leading-tight sm:text-3xl">
              {title}
            </h1>
          ) : (
            title
          )}
          {description ? (
            <p className="mt-1 text-sm font-medium text-hs-brown">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      {children}
    </div>
  );
}

export function LoadingText() {
  return (
    <p className="font-bungee text-hs-brown" role="status">
      Cargando…
    </p>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("bg-hs-sand motion-safe:animate-pulse", className)}
    />
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {children ? <CardDescription>{children}</CardDescription> : null}
      </CardHeader>
    </Card>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <Alert variant="error">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function FormNotice({
  message,
  variant = "success",
}: {
  message: string | null;
  variant?: "success" | "default";
}) {
  if (!message) {
    return null;
  }
  return (
    <Alert variant={variant}>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {hint ? <p className="text-sm text-hs-brown">{hint}</p> : null}
      {children}
    </div>
  );
}

export function RecordList({
  desktop,
  children,
}: {
  desktop: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="grid gap-3 md:hidden">{children}</div>
      <div className="hidden md:block">{desktop}</div>
    </>
  );
}

export function RecordCard({
  title,
  subtitle,
  badges,
  children,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card className="gap-3">
      <CardHeader>
        {badges ? (
          <CardTitle className="flex flex-wrap items-center gap-2 text-base [&_[data-slot=badge]]:whitespace-nowrap">
            <span>{title}</span>
            {badges}
          </CardTitle>
        ) : (
          <CardTitle className="text-base">{title}</CardTitle>
        )}
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </CardHeader>
      {children || actions ? (
        <CardContent className="space-y-3">
          {children}
          {actions ? (
            <div className="flex flex-col gap-2 sm:flex-row">{actions}</div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

export function MetaRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <p className="min-w-0 text-sm font-medium">
      <span className="font-bungee text-xs">{label}</span>
      <br />
      <span className="break-words">{children}</span>
    </p>
  );
}

export function MetaLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-hs-navy underline decoration-hs-navy/40 underline-offset-[3px]"
    >
      {children}
    </a>
  );
}

export function SocialMeta({
  email,
  urls,
}: {
  email?: string | null;
  urls?: UrlEntry[];
}) {
  return (
    <>
      <MetaRow label="Email">
        {email ? <MetaLink href={`mailto:${email}`}>{email}</MetaLink> : "—"}
      </MetaRow>
      {(["github", "x", "linkedin"] as const).map((kind) => {
        const href = urlOf(urls, kind);
        return (
          <MetaRow key={kind} label={urlLabel(kind)}>
            {href ? (
              <MetaLink href={href}>{urlDisplay(kind, href)}</MetaLink>
            ) : (
              "—"
            )}
          </MetaRow>
        );
      })}
    </>
  );
}

export function errorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) {
    return fallback;
  }
  const thrown =
    /Uncaught (?:Convex)?Error: (.*?)(?:\s+at handler\b|\n|$)/.exec(
      err.message
    )?.[1];
  const message = (thrown ?? err.message).split("\n")[0]?.trim();
  if (!message || message.startsWith("[CONVEX")) {
    return fallback;
  }
  return message;
}
