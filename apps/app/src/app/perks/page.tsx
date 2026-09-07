"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import {
  EmptyState,
  FormError,
  LoadingText,
  Page,
  errorMessage,
} from "@/components/page";
import { PerkCard } from "@/components/perk-card";

export default function PerksPage() {
  const catalog = useQuery(api.perks.listCatalog);
  const claim = useMutation(api.perks.claim);
  const [error, setError] = useState<string | null>(null);

  if (catalog === undefined) {
    return <LoadingText />;
  }

  return (
    <Page
      title="Perks"
      description="Reclama beneficios de partners. Los de email se convierten en solicitud. Los de código te dan uno único."
    >
      <FormError message={error} />
      {catalog.length === 0 ? (
        <EmptyState title="Aún no hay perks">
          Los beneficios de partners aparecerán aquí cuando la organización los
          publique.
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
                void claim({ perkId: perk._id }).catch((caughtError: unknown) =>
                  setError(
                    errorMessage(caughtError, "No se ha podido reclamar")
                  )
                );
              }}
            />
          ))}
        </div>
      )}
    </Page>
  );
}
