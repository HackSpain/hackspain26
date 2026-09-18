"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@convex/_generated/api";
import { LoadingText } from "@/components/page";
import { ParticipantDirectory } from "@/components/participant-directory/participant-directory";
import { contentWidth } from "@/lib/layout";

const container = contentWidth("/participantes");

/**
 * Real data. The viewer's own card was filled during onboarding, so the map
 * renders straight away; "Editar mi ficha" goes to the profile. The map
 * bleeds edge to edge, so the loading state wraps itself in the regular
 * content width.
 */
export default function ParticipantsPage() {
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
