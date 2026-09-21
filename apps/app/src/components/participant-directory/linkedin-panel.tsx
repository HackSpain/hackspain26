"use client";

import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  linkedinUrlFor,
  normalizeLinkedinSlug,
} from "@convex/lib/linkedinProfile";
import { errorMessage, LoadingText, MetaLink, MetaRow } from "@/components/page";
import type { DirectoryParticipant } from "./types";

export function linkedinSlugOf(person: DirectoryParticipant): string | null {
  const url = person.urls?.find((entry) => entry.kind === "linkedin")?.url;
  return url ? normalizeLinkedinSlug(url) : null;
}

export function LinkedinPanel({ person }: { person: DirectoryParticipant }) {
  const slug = linkedinSlugOf(person);
  const data = useQuery(
    api.directory.linkedin,
    slug ? { slug } : "skip",
  );
  const refresh = useAction(api.directoryLinkedin.refresh);
  const [loadError, setLoadError] = useState<string | null>(null);
  const enabled = data?.enabled === true;

  useEffect(() => {
    if (!slug || !enabled) {
      return;
    }
    let cancelled = false;
    void refresh({ slug }).catch((error: unknown) => {
      if (!cancelled) {
        setLoadError(errorMessage(error, "LinkedIn no responde."));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, refresh, slug]);

  if (!slug) {
    return null;
  }

  const profile = data?.profile;
  const loading = enabled && (data === undefined || (!profile && !loadError));
  const url = profile?.url ?? linkedinUrlFor(slug);

  return (
    <section className="space-y-4">
      <h3 className="font-bungee text-sm uppercase">LinkedIn</h3>
      {loading ? <LoadingText /> : null}
      {loadError ? <p className="text-sm text-hs-red">{loadError}</p> : null}
      {profile?.missing ? (
        <p className="text-sm text-hs-brown">
          Este LinkedIn no aparece.
        </p>
      ) : null}
      <div className="min-w-0">
        <MetaLink href={url}>{profile?.name ?? slug}</MetaLink>
        {profile?.headline ? (
          <p className="text-sm text-hs-brown">{profile.headline}</p>
        ) : null}
      </div>
      {profile && !profile.missing ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.company ? (
              <MetaRow label="Empresa">{profile.company}</MetaRow>
            ) : null}
            {profile.location ? (
              <MetaRow label="Lugar">{profile.location}</MetaRow>
            ) : null}
            {profile.followers !== undefined ? (
              <MetaRow label="Seguidores">
                {profile.followers.toLocaleString("es")}
              </MetaRow>
            ) : null}
            {profile.years !== undefined ? (
              <MetaRow label="Experiencia">{profile.years} años</MetaRow>
            ) : null}
          </div>
          {profile.experience.length ? (
            <div className="space-y-2">
              <p className="font-bungee text-xs">Puestos</p>
              <ul className="grid gap-2">
                {profile.experience.map((job) => (
                  <li
                    key={`${job.name}-${job.title ?? ""}`}
                    className="border-[3px] border-hs-ink bg-hs-sand px-3 py-2"
                  >
                    <span className="block font-medium">
                      {job.title ?? job.name}
                    </span>
                    <span className="block text-sm text-hs-brown">
                      {[job.title ? job.name : null, job.current ? "Actual" : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
