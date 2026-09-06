"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { EmptyState, FormError, LoadingText, Page } from "@/components/page";
import { PerkCard, type PerkCardPerk } from "@/components/perk-card";
import { PerkClaimDialog, claimErrorMessage } from "@/components/perk-claim-dialog";

export default function PerksPage() {
  const catalog = useQuery(api.perks.listCatalog);
  const claim = useMutation(api.perks.claim);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<PerkCardPerk | null>(null);

  if (catalog === undefined) return <LoadingText />;

  return (
    <Page
      title="Perks"
      description="Reclama beneficios de partners. Los de email se convierten en solicitud. Los de código te dan uno único."
    >
      <FormError message={error} />
      {catalog.length === 0 ? (
        <EmptyState title="Aún no hay perks">
          Los beneficios de partners aparecerán aquí cuando la organización los publique.
        </EmptyState>
      ) : (
        <div className="hs-stagger grid gap-4 sm:grid-cols-2">
          {catalog.map(({ perk, claim: existing }) => (
            <PerkCard
              key={perk._id}
              perk={perk}
              claim={existing}
              onClaim={() => {
                setError(null);
                if (perk.inputs.length > 0) {
                  setAsking(perk);
                  return;
                }
                void claim({ perkId: perk._id }).catch((err: unknown) =>
                  setError(claimErrorMessage(err, "No se ha podido reclamar")),
                );
              }}
            />
          ))}
        </div>
      )}
      <PerkClaimDialog
        perk={asking}
        onOpenChange={(open) => {
          if (!open) setAsking(null);
        }}
        onSubmit={async (answers) => {
          if (!asking) return;
          await claim({ perkId: asking._id, answers });
          setAsking(null);
        }}
      />
    </Page>
  );
}
