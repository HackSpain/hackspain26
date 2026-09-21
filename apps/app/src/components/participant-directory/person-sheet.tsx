"use client";

import { useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname, useSearchParams } from "next/navigation";
import { initialsOf } from "@/components/avatar";
import { LinkedText } from "@/components/linked-text";
import { ProjectDetails } from "@/components/judging/project-details";
import { writeParams } from "@/components/judging/project-table";
import { VideoFrame } from "@/components/judging/video-frame";
import { EmptyState, MetaLink, MetaRow } from "@/components/page";
import { Badge } from "@/components/ui/badge";
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
import { UsagePanel } from "./usage-panel";
import { linksFor } from "./network-model";
import type { DirectoryParticipant } from "./types";
import { personHeading } from "./types";

export const PERSON_PARAM = "persona";
const EXTRA_URL_KINDS = ["web", "x"] as const;
const SWAP_EASE = [0.23, 1, 0.32, 1] as const;

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

function Portrait({
  person,
  size = "md",
}: {
  person: DirectoryParticipant;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "size-10" : "size-16";
  return person.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- profile images may use authenticated app URLs or GitHub avatars.
    <img
      src={person.photoUrl}
      alt=""
      className={`${box} shrink-0 rounded-full border-[3px] border-hs-ink object-cover outline outline-1 outline-black/10`}
    />
  ) : (
    <span
      className={`grid ${box} shrink-0 place-items-center rounded-full border-[3px] border-hs-ink bg-hs-sand font-bungee text-sm text-hs-brown`}
      aria-hidden="true"
    >
      {initialsOf(person.displayName)}
    </span>
  );
}

function PersonRow({
  person,
  hint,
  onOpen,
}: {
  person: DirectoryParticipant;
  hint?: string;
  onOpen: (id: string, from: HTMLElement | null) => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 border-2 border-hs-ink/20 bg-hs-sand/60 px-3 py-2 text-left hs-hover-bright motion-safe:transition-transform motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.96]"
      onClick={(event) => onOpen(person.id, event.currentTarget)}
    >
      <Portrait person={person} size="sm" />
      <span className="min-w-0">
        <span className="block font-medium">{personHeading(person)}</span>
        {hint ? (
          <span className="block text-sm text-hs-brown">{hint}</span>
        ) : null}
      </span>
    </button>
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
  const reduceMotion = useReducedMotion();
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
    EXTRA_URL_KINDS.includes(entry.kind as (typeof EXTRA_URL_KINDS)[number]),
  );
  const swap = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, transform: "translateY(8px)" },
        animate: { opacity: 1, transform: "translateY(0px)" },
        exit: { opacity: 0, transform: "translateY(-6px)" },
      };

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
        <AnimatePresence mode="wait" initial={false}>
          {person === null ? (
            <motion.div
              key="missing"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              initial={swap.initial}
              animate={swap.animate}
              exit={swap.exit}
              transition={{ duration: 0.16, ease: SWAP_EASE }}
            >
              <SheetHeader>
                <SheetTitle>Ficha</SheetTitle>
              </SheetHeader>
              <SheetBody>
                <EmptyState title="Persona no encontrada">
                  Esa ficha no está en el directorio.
                </EmptyState>
              </SheetBody>
            </motion.div>
          ) : (
            <motion.div
              key={person.id}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              initial={swap.initial}
              animate={swap.animate}
              exit={{
                ...swap.exit,
                transition: { duration: 0.16, ease: SWAP_EASE },
              }}
              transition={{ duration: 0.22, ease: SWAP_EASE }}
            >
              <SheetHeader>
                <div className="flex items-start gap-4">
                  <Portrait person={person} />
                  <div className="min-w-0">
                    <SheetTitle className="text-balance">
                      {person.displayName}
                    </SheetTitle>
                    <SheetDescription>
                      {[person.role, person.team?.name].filter(Boolean).join(" · ") ||
                        "Participante"}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <SheetBody className="space-y-6">
                {facts.length ? (
                  <p className="text-sm text-pretty text-hs-brown">
                    {facts.join(" · ")}
                  </p>
                ) : null}
                {person.bio ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-pretty">
                    <LinkedText text={person.bio} />
                  </p>
                ) : null}
                {person.skills.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {person.skills.map((skill) => (
                      <li key={skill}>
                        <Badge>{skill}</Badge>
                      </li>
                    ))}
                  </ul>
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
                {personLinks.length ? (
                  <div className="grid gap-3">
                    {personLinks.map((entry) => (
                      <MetaRow key={entry.kind} label={urlLabel(entry.kind)}>
                        <MetaLink href={entry.url}>
                          {urlDisplay(entry.kind, entry.url)}
                        </MetaLink>
                      </MetaRow>
                    ))}
                  </div>
                ) : null}

                <GithubPanel person={person} />
                <LinkedinPanel person={person} />
                <UsagePanel userId={person.id} />

                <section className="space-y-3">
                  <h3 className="font-bungee text-sm uppercase">Equipo</h3>
                  {person.team ? (
                    <>
                      <p className="text-sm font-medium">{person.team.name}</p>
                      {teammates.length ? (
                        <ul className="grid gap-2">
                          {teammates.map((mate) => (
                            <li key={mate.id}>
                              <PersonRow
                                person={mate}
                                hint={mate.city}
                                onOpen={onOpen}
                              />
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
                          <PersonRow
                            person={link.participant}
                            hint={link.affinities
                              .slice(0, 3)
                              .map((item) => item.value)
                              .join(" · ")}
                            onOpen={onOpen}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </SheetBody>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
