"use client";

import Image from "next/image";
import { presentMentors } from "@/lib/mentors";
import { cn } from "@/lib/utils";
import { useClock } from "./motion";

function gridClass(count: number) {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  if (count <= 4) return "grid-cols-2";
  if (count === 5 || count === 6) return "grid-cols-3";
  return "grid-cols-4";
}

export function MentorsBox() {
  const mentors = presentMentors();

  if (mentors.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-hs-ink px-6">
        <p className="font-bungee text-[clamp(1.2rem,4.5cqw,3.5rem)] text-balance text-hs-gold/60 uppercase">
          Nadie en sala ahora
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-hs-ink px-[1.6cqw] py-[1.4cqw]">
      <div
        className={cn(
          "grid min-h-0 flex-1 gap-[1.2cqw]",
          gridClass(mentors.length),
        )}
      >
        {mentors.map((mentor) => (
          <article
            key={mentor.id}
            className="flex min-h-0 flex-col overflow-hidden border-[3px] border-hs-gold/35 bg-hs-paper"
          >
            {/* Photos are local public assets; next/image adds no benefit on a venue canvas. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mentor.photoSrc}
              alt=""
              className="aspect-square w-full object-cover outline outline-1 -outline-offset-1 outline-black/10"
            />
            <div className="flex min-h-0 flex-1 flex-col justify-center px-[1.1cqw] py-[0.9cqw]">
              <h3 className="font-bungee text-[clamp(0.85rem,2.4cqw,1.85rem)] leading-tight text-balance text-hs-ink">
                {mentor.name}
              </h3>
              <p className="mt-[0.35cqw] text-[clamp(0.65rem,1.5cqw,1.05rem)] leading-snug text-pretty font-semibold text-hs-brown">
                {mentor.role}
              </p>
              <p className="mt-[0.25cqw] text-[clamp(0.6rem,1.25cqw,0.9rem)] font-semibold tracking-wide text-hs-ink/70 uppercase">
                {mentor.company}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function MentorsScreen() {
  const now = useClock();
  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden bg-hs-ink p-[2.4vmin] text-hs-paper">
      <header className="flex shrink-0 items-center justify-between gap-6 pb-[1.6vmin]">
        <Image
          src="/logo.svg"
          alt="HackSpain"
          width={190}
          height={63}
          className="h-auto w-[clamp(100px,12vw,280px)]"
          priority
        />
        <h1 className="font-bungee text-[clamp(1.4rem,4.2vmin,3.4rem)] text-hs-gold uppercase">
          Mentores ahora
        </h1>
        <p className="font-mono text-[clamp(16px,2.5vmin,48px)] tabular-nums text-hs-paper/60">
          {now?.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Madrid",
          })}
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <MentorsBox />
      </div>
    </main>
  );
}

export function MentorsPreview() {
  const mentors = presentMentors();
  if (mentors.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-hs-ink p-3">
        <p className="font-bungee text-xs text-hs-gold/60 uppercase">
          Nadie en sala
        </p>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "grid h-full content-start gap-1.5 bg-hs-ink p-2",
        mentors.length <= 2 ? "grid-cols-2" : "grid-cols-3",
      )}
    >
      {mentors.map((mentor) => (
        <div
          key={mentor.id}
          className="border-[3px] border-hs-gold/30 bg-hs-paper px-2 py-1.5"
        >
          <p className="font-bungee text-[10px] leading-tight text-hs-ink">
            {mentor.name}
          </p>
        </div>
      ))}
    </div>
  );
}
