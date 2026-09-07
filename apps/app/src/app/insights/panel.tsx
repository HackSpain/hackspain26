import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Panel({
  id,
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  id?: string;
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      id={id}
      className={cn(
        "min-w-0 scroll-mt-6 gap-5 border border-hs-ink/15 py-5",
        className
      )}
    >
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base text-balance">{title}</h2>
          {eyebrow ? (
            <p className="mt-1.5 text-xs leading-relaxed text-pretty text-hs-brown">
              {eyebrow}
            </p>
          ) : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="min-w-0 px-5">{children}</CardContent>
    </Card>
  );
}
