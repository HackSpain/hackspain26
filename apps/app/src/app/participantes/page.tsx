"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@convex/_generated/api";
import { LoadingText } from "@/components/page";
import { ParticipantDirectory } from "@/components/participant-directory/participant-directory";
import { contentWidth } from "@/lib/layout";

const container = contentWidth("/participantes");

export default function ParticipantsPage() {
  return (
    <Suspense
      fallback={
        <div className={container}>
          <LoadingText />
        </div>
      }
    >
      <ParticipantsBody />
    </Suspense>
  );
}

function ParticipantsBody() {
  const router = useRouter();
  const participants = useQuery(api.directory.list);

  if (participants === undefined) {
    return (
      <div className={container}>
        <LoadingText />
      </div>
    );
  }

  return (
    <ParticipantDirectory
      participants={participants}
      onEdit={() => router.push("/profile#ficha")}
    />
  );
}
