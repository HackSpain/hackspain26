"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { LoadingText } from "@/components/page";
import { DirectoryForm } from "@/components/participant-directory/directory-form";

/** The participant card, last step: saving it completes the profile. */
export function DirectoryStep({ onDone }: { onDone: () => void }) {
  const directory = useQuery(api.directory.me);
  if (directory === undefined) {
    return <LoadingText />;
  }
  return (
    <DirectoryForm
      me={directory}
      bare
      submitLabel="Guardar y terminar"
      onSaved={onDone}
    />
  );
}
