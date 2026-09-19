"use client";

import { useAction, useQuery } from "convex/react";
import { Suspense } from "react";
import { api } from "@convex/_generated/api";
import { DeliveryBriefing } from "@/components/delivery-briefing";
import { LoadingText, Page } from "@/components/page";
import { SubmitFlow } from "@/components/submit-project";
import { Alert, AlertDescription } from "@/components/ui/alert";

function SubmitPage() {
  const tracks = useQuery(api.tracks.list);
  const settings = useQuery(api.tracks.settings);
  const mine = useQuery(api.submissions.mine);
  const catalog = useQuery(api.perks.listCatalog);
  const team = useQuery(api.teams.mine);
  const submit = useAction(api.submissions.submit);

  if (
    tracks === undefined ||
    settings === undefined ||
    mine === undefined ||
    team === undefined
  ) {
    return <LoadingText />;
  }

  return (
    <Page
      title="Submit"
      description="Gran Premio a las 11: vídeo de 3 minutos, repo y, si aplica, una demo. Los tracks se presentan en persona."
    >
      <DeliveryBriefing />
      {!settings.submissionsOpen ? (
        <Alert>
          <AlertDescription>
            El envío aún no está abierto. Puedes preparar los enlaces; el botón
            se activa cuando lo abramos.
          </AlertDescription>
        </Alert>
      ) : null}
      <SubmitFlow
        catalog={catalog}
        mine={mine}
        onSubmit={(args) => submit(args)}
        submissionsOpen={settings.submissionsOpen}
        teamRepo={team?.repoUrl ?? ""}
        tracks={tracks}
      />
    </Page>
  );
}

export default function SubmitRoute() {
  return (
    <Suspense fallback={<LoadingText />}>
      <SubmitPage />
    </Suspense>
  );
}
