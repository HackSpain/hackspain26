"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { LoadingText } from "@/components/page";
import { DirectoryForm } from "@/components/participant-directory/directory-form";

/**
 * The participant card over the wizard's last two steps ("directory", then
 * "skills"). The wizard keeps this mounted across both so the draft survives;
 * `page` picks the half to show, `onNext` moves to the skills step and saving
 * there completes the profile.
 */
export function DirectoryStep({
  page,
  onNext,
  onDone,
  onBack,
}: {
  page: 0 | 1;
  onNext: () => void;
  onDone: () => void;
  onBack?: () => void;
}) {
  const directory = useQuery(api.directory.me);
  if (directory === undefined) {
    return <LoadingText />;
  }
  return (
    <DirectoryForm
      me={directory}
      bare
      page={page}
      submitLabel="Guardar y terminar"
      onNext={onNext}
      onSaved={onDone}
      onBack={onBack}
    />
  );
}
