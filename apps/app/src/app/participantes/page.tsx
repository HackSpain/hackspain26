"use client";

import { useQuery } from "convex/react";
import { PencilLine } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { LoadingText, Page } from "@/components/page";
import { DirectoryForm } from "@/components/participant-directory/directory-form";
import { ParticipantDirectory } from "@/components/participant-directory/participant-directory";
import { Button } from "@/components/ui/button";

/**
 * Real data. The graph only renders once the viewer's own card is complete;
 * until then the form takes the whole page.
 */
export default function ParticipantsPage() {
  const me = useQuery(api.directory.me);
  const [editing, setEditing] = useState(false);
  const participants = useQuery(api.directory.list, me?.complete ? {} : "skip");

  if (me === undefined) {
    return <LoadingText />;
  }

  if (!me.complete || editing) {
    return (
      <Page title="Participantes">
        <DirectoryForm
          me={me}
          onSaved={() => setEditing(false)}
          onCancel={me.complete ? () => setEditing(false) : undefined}
        />
      </Page>
    );
  }

  if (participants === undefined) {
    return <LoadingText />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          <PencilLine aria-hidden /> Editar mi ficha
        </Button>
      </div>
      <ParticipantDirectory participants={participants} />
    </div>
  );
}
