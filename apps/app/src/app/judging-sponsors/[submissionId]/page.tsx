"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ProjectDetails } from "@/components/judging/project-details";
import { deliveryHref } from "@/components/judging/project-table";
import { VideoFrame } from "@/components/judging/video-frame";
import { EmptyState, LoadingText, Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { urlOf } from "@/lib/urls";

export default function DeliveryPage() {
  const params = useParams<{ submissionId: string }>();
  const submissionId =
    typeof params.submissionId === "string" ? params.submissionId : "";
  const me = useQuery(api.users.me);
  const allowed =
    me?.role === "admin" ||
    (me?.sections.includes("judgingSponsors") ?? false);
  const item = useQuery(
    api.judging.getDelivery,
    allowed && submissionId
      ? { submissionId: submissionId as Id<"submissions"> }
      : "skip",
  );

  if (me === undefined) {
    return <LoadingText />;
  }
  if (!allowed) {
    return (
      <Page title="Entrega">
        <EmptyState title="Solo para el jurado">
          Este enlace es para revisar una entrega.
        </EmptyState>
      </Page>
    );
  }
  if (item === undefined) {
    return <LoadingText />;
  }
  if (item === null) {
    return (
      <Page title="Entrega">
        <EmptyState title="Entrega no encontrada">
          No hay una submission con este enlace, o aún no está entregada.
        </EmptyState>
      </Page>
    );
  }

  return (
    <Page
      title={item.name || "Proyecto"}
      description={item.teamName ?? "Sin equipo"}
      className="space-y-4"
    >
      <CopyLink href={deliveryHref(item)} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <VideoFrame url={urlOf(item.urls, "video")} />
        <ProjectDetails item={item} />
      </div>
    </Page>
  );
}

function CopyLink({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-fit"
      onClick={() => {
        void navigator.clipboard
          .writeText(`${window.location.origin}${href}`)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
      }}
    >
      {copied ? "Enlace copiado" : "Copiar enlace"}
    </Button>
  );
}
