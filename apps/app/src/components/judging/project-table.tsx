"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import type { Id } from "@convex/_generated/dataModel";
import {
  ProjectDetails,
} from "@/components/judging/project-details";
import type { ProjectInfo } from "@/components/judging/project-details";
import { VideoFrame } from "@/components/judging/video-frame";
import { EmptyState, Page, RecordCard, Skeleton } from "@/components/page";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JUDGING_SPONSORS_PATH } from "@/lib/sections";
import { urlOf } from "@/lib/urls";

export const PROJECT_PARAM = "proyecto";
export const TRACK_PARAM = "reto";

export function deliveryHref(item: { _id: string }): string {
  return `${JUDGING_SPONSORS_PATH}/${item._id}`;
}

export type ProjectRow = ProjectInfo & {
  _id: Id<"submissions">;
  name: string;
};

function activateOnKey(event: KeyboardEvent<HTMLElement>, open: () => void) {
  if (event.target !== event.currentTarget) {
    return;
  }
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  event.preventDefault();
  open();
}

export function writeParams(
  pathname: string,
  mutate: (params: URLSearchParams) => void,
  mode: "push" | "replace",
) {
  const next = new URLSearchParams(window.location.search);
  mutate(next);
  const query = next.toString();
  const url = query ? `${pathname}?${query}` : pathname;
  if (mode === "push") {
    window.history.pushState(null, "", url);
    return;
  }
  window.history.replaceState(null, "", url);
}

export function useProjectPicker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = searchParams.get(PROJECT_PARAM) as Id<"submissions"> | null;
  const pushed = useRef(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openProject = (id: Id<"submissions">, from: HTMLElement | null) => {
    triggerRef.current = from;
    const alreadyOpen = new URLSearchParams(window.location.search).has(
      PROJECT_PARAM,
    );
    writeParams(
      pathname,
      (params) => params.set(PROJECT_PARAM, id),
      alreadyOpen ? "replace" : "push",
    );
    if (!alreadyOpen) {
      pushed.current = true;
    }
  };

  const closeProject = () => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
      return;
    }
    writeParams(pathname, (params) => params.delete(PROJECT_PARAM), "replace");
  };

  return {
    closeProject,
    openProject,
    pathname,
    projectId,
    searchParams,
    triggerRef,
  };
}

export function ProjectTableFallback({ title }: { title: string }) {
  return (
    <Page title={title} className="space-y-4">
      <Skeleton className="h-11 w-56" />
      <div className="grid gap-3 md:hidden" aria-hidden>
        {["a", "b", "c"].map((key) => (
          <div key={key} className="border-[3px] border-hs-ink bg-hs-paper p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-56" />
            <Skeleton className="mt-4 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="hidden border-[3px] border-hs-ink md:block" aria-hidden>
        <div className="h-11 border-b-[3px] border-hs-ink bg-hs-sand" />
        {["a", "b", "c"].map((key) => (
          <div
            key={key}
            className="flex h-11 items-center gap-3 border-b border-hs-ink/20 px-3"
          >
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    </Page>
  );
}

export function ProjectTable({
  rows,
  projectId,
  extraHead,
  extraCell,
  badges,
  onOpen,
}: {
  rows: ProjectRow[];
  projectId: Id<"submissions"> | null;
  extraHead?: ReactNode;
  extraCell?: (row: ProjectRow) => ReactNode;
  badges?: (row: ProjectRow) => ReactNode;
  onOpen: (id: Id<"submissions">, from: HTMLElement | null) => void;
}) {
  return (
    <div>
      <div className="hs-stagger grid gap-3 md:hidden">
        {rows.map((row) => (
          <div
            key={row._id}
            role="button"
            tabIndex={0}
            aria-label={`${row.name}, ${row.teamName ?? "sin equipo"}`}
            aria-haspopup="dialog"
            aria-expanded={row._id === projectId}
            onClick={(event) => onOpen(row._id, event.currentTarget)}
            onKeyDown={(event) =>
              activateOnKey(event, () => onOpen(row._id, event.currentTarget))
            }
            className="block cursor-pointer outline-none motion-safe:transition-transform motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:[&>[data-slot=card]]:bg-hs-sand/60 focus-visible:[&>[data-slot=card]]:border-hs-navy aria-expanded:[&>[data-slot=card]]:bg-hs-sand"
          >
            <RecordCard
              title={row.name || "Sin título"}
              subtitle={row.teamName ?? "Sin equipo"}
              badges={badges?.(row)}
            >
              <p className="text-sm font-medium text-hs-brown">
                {row.challenges.map((challenge) => challenge.label).join(" · ") ||
                  "Sin retos"}
              </p>
            </RecordCard>
          </div>
        ))}
      </div>
      <div className="hidden md:block">
        <Table
          className="border-separate border-spacing-0 font-medium"
          containerClassName="max-h-[min(40rem,calc(100dvh-18rem))] overflow-auto overscroll-contain"
        >
          <TableHeader className="sticky top-0 z-10 [&_th]:border-b-[3px] [&_th]:border-hs-ink [&_th]:bg-hs-sand">
            <TableRow>
              <TableHead>Proyecto</TableHead>
              <TableHead>Equipo</TableHead>
              <TableHead>Retos</TableHead>
              {extraHead}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row._id}
                data-state={row._id === projectId ? "selected" : undefined}
                onClick={(event) =>
                  onOpen(
                    row._id,
                    event.currentTarget.querySelector<HTMLElement>(
                      "[data-row-trigger]",
                    ),
                  )
                }
                className="h-11 cursor-pointer motion-safe:transition-colors motion-safe:duration-100 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-hs-sand/60 [&_td]:border-b [&_td]:border-hs-ink/20"
              >
                <TableCell>
                  <button
                    type="button"
                    data-row-trigger
                    aria-haspopup="dialog"
                    aria-expanded={row._id === projectId}
                    className="-mx-1 min-w-0 truncate px-1 text-left underline-offset-2 outline-none focus-visible:border-[3px] focus-visible:border-hs-navy [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
                  >
                    {row.name || "Sin título"}
                  </button>
                </TableCell>
                <TableCell className="max-w-48 truncate">
                  {row.teamName ?? "—"}
                </TableCell>
                <TableCell className="max-w-72 truncate">
                  {row.challenges.map((challenge) => challenge.label).join(" · ") ||
                    "—"}
                </TableCell>
                {extraCell?.(row)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function ProjectSheet({
  selected,
  emptyHint,
  onClose,
  returnFocusRef,
  children,
}: {
  selected: ProjectRow | null;
  emptyHint: string;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  children?: ReactNode;
}) {
  const [shown, setShown] = useState<ProjectRow | null>(selected);
  if (selected && selected !== shown) {
    setShown(selected);
  }
  const item = selected ?? shown;

  return (
    <Sheet
      open={selected !== null}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <SheetContent
        className="sm:max-w-3xl lg:max-w-5xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = returnFocusRef.current;
          if (target?.isConnected) {
            target.focus();
          }
          returnFocusRef.current = null;
        }}
      >
        <SheetHeader>
          <SheetTitle>{item?.name || "Proyecto"}</SheetTitle>
          <SheetDescription className="font-medium">
            {item?.teamName ?? "Sin equipo"}
          </SheetDescription>
          {item ? <CopyDeliveryLink item={item} /> : null}
        </SheetHeader>
        <SheetBody className="space-y-6">
          {item === null ? (
            <EmptyState title="Proyecto no encontrado">{emptyHint}</EmptyState>
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <VideoFrame url={urlOf(item.urls, "video")} />
                <ProjectDetails item={item} />
              </div>
              {children}
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function CopyDeliveryLink({ item }: { item: ProjectRow }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-fit"
      onClick={() => {
        const url = `${window.location.origin}${deliveryHref(item)}`;
        void navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Enlace copiado" : "Copiar enlace"}
    </Button>
  );
}
