import { ConvexError } from "convex/values";
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

export function FormError({ message }: { message: ReactNode | null }) {
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
  meta,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  /** Small text on the label row's right edge (a counter, "opcional"). */
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={htmlFor}>{label}</Label>
          {meta ? (
            <span className="shrink-0 text-xs tabular-nums text-hs-brown">{meta}</span>
          ) : null}
        </div>
        {hint ? <p className="text-sm text-hs-brown">{hint}</p> : null}
      </div>
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
    <Card className="min-w-0 gap-3 overflow-hidden">
      <CardHeader className="min-w-0">
        {badges ? (
          <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-base [&_[data-slot=badge]]:whitespace-nowrap">
            <span className="min-w-0 break-words">{title}</span>
            {badges}
          </CardTitle>
        ) : (
          <CardTitle className="min-w-0 break-words text-base">{title}</CardTitle>
        )}
        {subtitle ? (
          <CardDescription className="min-w-0 break-all">{subtitle}</CardDescription>
        ) : null}
      </CardHeader>
      {children || actions ? (
        <CardContent className="min-w-0 space-y-3">
          {children}
          {actions ? (
            <div className="flex min-w-0 flex-col gap-2">{actions}</div>
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
  if (err instanceof ConvexError) {
    const data = err.data as { message?: unknown } | null;
    if (typeof data?.message === "string" && data.message) {
      return data.message;
    }
  }
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
