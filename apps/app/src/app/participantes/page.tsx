"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { LoadingText, Page } from "@/components/page";
import { DirectoryForm } from "@/components/participant-directory/directory-form";
import { ParticipantDirectory } from "@/components/participant-directory/participant-directory";
import { contentWidth } from "@/lib/layout";

const container = contentWidth("/participantes");

/**
 * Real data. The map only renders once the viewer's own card is complete;
 * until then the form takes the page. The map itself bleeds edge to edge, so
 * everything else here wraps itself in the regular content width.
 */
export default function ParticipantsPage() {
  const me = useQuery(api.directory.me);
  const [editing, setEditing] = useState(false);
  const participants = useQuery(api.directory.list, me?.complete ? {} : "skip");

  if (me === undefined) {
    return (
      <div className={container}>
        <LoadingText />
      </div>
    );
  }

  if (!me.complete || editing) {
    return (
      <div className={container}>
        <Page title="Participantes">
          <DirectoryForm
            me={me}
            onSaved={() => setEditing(false)}
            onCancel={me.complete ? () => setEditing(false) : undefined}
          />
        </Page>
      </div>
    );
  }

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
      onEdit={() => setEditing(true)}
    />
  );
}
