"use client";

import { useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initialsOf } from "@/components/avatar";
import { LinkedText } from "@/components/linked-text";
import { ProjectDetails } from "@/components/judging/project-details";
import { writeParams } from "@/components/judging/project-table";
import { VideoFrame } from "@/components/judging/video-frame";
import { EmptyState, MetaLink, MetaRow } from "@/components/page";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { urlDisplay, urlLabel, urlOf } from "@/lib/urls";
import { GithubPanel } from "./github-panel";
import { LinkedinPanel } from "./linkedin-panel";
import { linksFor } from "./network-model";
import type { DirectoryParticipant } from "./types";
import { personHeading } from "./types";

export const PERSON_PARAM = "persona";
const PERSON_URL_KINDS = ["github", "linkedin", "web", "x"] as const;

export function usePersonPicker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const personId = searchParams.get(PERSON_PARAM);
  const pushed = useRef(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openPerson = (id: string, from: HTMLElement | null = null) => {
    triggerRef.current = from;
    const alreadyOpen = new URLSearchParams(window.location.search).has(
      PERSON_PARAM,
    );
    writeParams(
      pathname,
      (params) => params.set(PERSON_PARAM, id),
      alreadyOpen ? "replace" : "push",
    );
    if (!alreadyOpen) {
      pushed.current = true;
    }
  };

  const closePerson = () => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
      return;
    }
    writeParams(pathname, (params) => params.delete(PERSON_PARAM), "replace");
  };

  return {
    closePerson,
    openPerson,
    personId,
    triggerRef,
  };
}

function Portrait({ person }: { person: DirectoryParticipant }) {
  return person.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- profile images may use authenticated app URLs or GitHub avatars.
    <img
      src={person.photoUrl}
      alt=""
      className="size-14 rounded-full border-[3px] border-hs-ink object-cover"
    />
  ) : (
    <span
      className="grid size-14 place-items-center rounded-full border-[3px] border-hs-ink bg-hs-sand font-bungee text-sm text-hs-brown"
      aria-hidden="true"
    >
      {initialsOf(person.displayName)}
    </span>
  );
}

export function PersonSheet({
  participants,
  personId,
  onClose,
  onOpen,
  returnFocusRef,
}: {
  participants: DirectoryParticipant[];
  personId: string | null;
  onClose: () => void;
  onOpen: (id: string, from: HTMLElement | null) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const selected =
    participants.find((person) => person.id === personId) ?? null;
  const [shown, setShown] = useState<DirectoryParticipant | null>(selected);
  if (selected && selected !== shown) {
    setShown(selected);
  }
  const person = selected ?? shown;
  const teammates = useMemo(() => {
    if (!person?.team) {
      return [];
    }
    return participants.filter(
      (item) => item.team?.id === person.team?.id && item.id !== person.id,
    );
  }, [participants, person]);
  const links = person ? linksFor(person, participants) : [];
  const facts = person
    ? [person.city, person.university, person.company, person.degree].filter(
        Boolean,
      )
    : [];
  const personLinks = (person?.urls ?? []).filter((entry) =>
    PERSON_URL_KINDS.includes(
      entry.kind as (typeof PERSON_URL_KINDS)[number],
    ),
  );

  return (
    <Sheet
      open={personId !== null}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <SheetContent
        className="sm:max-w-3xl lg:max-w-5xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = returnFocusRef.current;
          if (target?.isConnected) {
            target.focus();
          }
          returnFocusRef.current = null;
        }}
      >
        <SheetHeader>
          <div className="flex items-start gap-3">
            {person ? <Portrait person={person} /> : null}
            <div className="min-w-0">
              <SheetTitle>{person ? personHeading(person) : "Ficha"}</SheetTitle>
              <SheetDescription>
                {person?.team?.name ?? person?.city ?? "Participante"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <SheetBody className="space-y-8">
          {person === null ? (
            <EmptyState title="Persona no encontrada">
              Esa ficha no está en el directorio.
            </EmptyState>
          ) : (
            <>
              {facts.length ? (
                <p className="text-sm text-hs-brown">{facts.join(" · ")}</p>
              ) : null}
              {person.bio ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  <LinkedText text={person.bio} />
                </p>
              ) : null}
              {person.achievements ? (
                <MetaRow label="Logros">
                  <span className="whitespace-pre-wrap">
                    <LinkedText text={person.achievements} />
                  </span>
                </MetaRow>
              ) : null}
              {person.freeTime ? (
                <MetaRow label="En el rato libre">
                  <span className="whitespace-pre-wrap">
                    <LinkedText text={person.freeTime} />
                  </span>
                </MetaRow>
              ) : null}
              {personLinks.length || person.githubUsername ? (
                <div className="grid gap-3">
                  {personLinks.map((entry) => (
                    <MetaRow key={entry.kind} label={urlLabel(entry.kind)}>
                      <MetaLink href={entry.url}>
                        {urlDisplay(entry.kind, entry.url)}
                      </MetaLink>
                    </MetaRow>
                  ))}
                  {person.githubUsername &&
                  !personLinks.some((entry) => entry.kind === "github") ? (
                    <MetaRow label="GitHub">
                      <MetaLink
                        href={`https://github.com/${person.githubUsername}`}
                      >
                        {person.githubUsername}
                      </MetaLink>
                    </MetaRow>
                  ) : null}
                </div>
              ) : null}
              {person.skills.length ? (
                <MetaRow label="Habilidades">
                  {person.skills.join(" · ")}
                </MetaRow>
              ) : null}

              <GithubPanel person={person} />
              <LinkedinPanel person={person} />

              <section className="space-y-3">
                <h3 className="font-bungee text-sm uppercase">Equipo</h3>
                {person.team ? (
                  <>
                    <p className="text-sm font-medium">{person.team.name}</p>
                    {teammates.length ? (
                      <ul className="grid gap-2">
                        {teammates.map((mate) => (
                          <li key={mate.id}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-3 border-[3px] border-hs-ink bg-hs-sand px-3 py-2 text-left hs-hover-bright"
                              onClick={(event) =>
                                onOpen(mate.id, event.currentTarget)
                              }
                            >
                              <Portrait person={mate} />
                              <span className="min-w-0">
                                <span className="block font-medium">
                                  {personHeading(mate)}
                                </span>
                                <span className="block text-sm text-hs-brown">
                                  {mate.city}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-hs-brown">
                        Nadie más del equipo tiene ficha todavía.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-hs-brown">Sin equipo.</p>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="font-bungee text-sm uppercase">Proyecto</h3>
                {person.project ? (
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <VideoFrame url={urlOf(person.project.urls, "video")} />
                    <ProjectDetails
                      item={{
                        challenges: (person.tracks ?? []).map((track) => ({
                          _id: track.id,
                          label: track.label,
                          logoUrl: track.logoUrl,
                          slug: track.slug,
                        })),
                        description: person.project.description,
                        members: [person, ...teammates].map(
                          (item) => item.displayName,
                        ),
                        perks: [],
                        teamName: person.team?.name,
                        techStack: person.project.techStack,
                        urls: person.project.urls,
                      }}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-hs-brown">
                    Este equipo aún no ha presentado proyecto.
                  </p>
                )}
              </section>

              {links.length ? (
                <section className="space-y-3">
                  <h3 className="font-bungee text-sm uppercase">En común</h3>
                  <ul className="grid gap-2">
                    {links.slice(0, 8).map((link) => (
                      <li key={link.participant.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 border-[3px] border-hs-ink bg-hs-paper px-3 py-2 text-left hs-hover-bright"
                          onClick={(event) =>
                            onOpen(link.participant.id, event.currentTarget)
                          }
                        >
                          <Portrait person={link.participant} />
                          <span className="min-w-0">
                            <span className="block font-medium">
                              {personHeading(link.participant)}
                            </span>
                            <span className="block text-sm text-hs-brown">
                              {link.affinities
                                .slice(0, 3)
                                .map((item) => item.value)
                                .join(" · ")}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
