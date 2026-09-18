"use client";

import { useConvexConnectionState, useQuery } from "convex/react";
import Image from "next/image";
import { gsap } from "gsap";
import { Maximize, Minimize } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Arrival, ArrivalQueue } from "@/lib/arrival-queue";
import { reconcileArrivals } from "@/lib/arrival-queue";

const PRESENTATION_MS = 10_000;
const BAND_TONES = ["bg-hs-navy", "bg-hs-teal", "bg-hs-gold", "bg-hs-orange", "bg-hs-red"] as const;

const DEMO: Arrival[] = [
  // Public mentor portrait and role, already published on the marketing site.
  { id: "demo-1", checkedInAt: 1, number: 42, name: "Mark Villacampa", image: "/arrivals/demo-mark-villacampa.jpg", role: "Software Engineer", city: "", company: "RevenueCat", university: "", skills: [] },
  { id: "demo-2", checkedInAt: 2, number: 43, name: "Lucía Fernández de la Vega", image: null, role: "Diseño de producto", city: "Barcelona", company: "Estudio independiente", university: "", skills: ["Diseño UX/UI", "Figma", "Prototipado"] },
  { id: "demo-3", checkedInAt: 3, number: 44, name: "Dani", image: null, role: "Hacker", city: "", company: "", university: "", skills: [] },
];

function ArenaLights() {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const media = gsap.matchMedia(root);
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(".arena-light-left", { rotation: -27 }, {
        rotation: 28, duration: 5.4, ease: "sine.inOut", repeat: -1, yoyo: true,
      });
      gsap.fromTo(".arena-light-right", { rotation: 26 }, {
        rotation: -30, duration: 6.8, ease: "sine.inOut", repeat: -1, yoyo: true,
      });
      gsap.fromTo(".arena-light-center", { rotation: -12, opacity: 0.3 }, {
        rotation: 16, opacity: 0.8, duration: 4.2, ease: "sine.inOut", repeat: -1, yoyo: true,
      });
      gsap.fromTo(".arena-light-pool", { xPercent: -12, scaleX: 0.85, opacity: 0.3 }, {
        xPercent: 12, scaleX: 1.15, opacity: 0.6, duration: 5.4, ease: "sine.inOut", repeat: -1, yoyo: true,
      });
    });
    return () => media.revert();
  }, []);
  return (
    <div ref={root} aria-hidden className="pointer-events-none absolute inset-0 z-20 isolate overflow-hidden mix-blend-screen">
      <div className="arena-light arena-light-left" />
      <div className="arena-light arena-light-right" />
      <div className="arena-light arena-light-center" />
      <div className="arena-light-pool" />
    </div>
  );
}

function Portrait({ person }: { person: Arrival }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="arena-portrait absolute top-0 right-0 bottom-0 w-[1070px]">
      {person.image && !failed ? (
        <Image src={person.image} alt={person.name} fill unoptimized priority onError={() => setFailed(true)} className="object-cover object-top saturate-[0.7] sepia-[0.25] contrast-[1.08]" />
      ) : (
        <div className="arena-monogram absolute inset-0 flex items-center justify-center">
          <span className="arena-type -rotate-6 text-[460px] leading-none text-hs-paper">{person.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
        </div>
      )}
      <div className="arena-portrait-shade absolute inset-0" />
    </div>
  );
}

function Player({ person }: { person: Arrival }) {
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const media = gsap.matchMedia(root);
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline();
      tl.from(".arena-portrait", {
        autoAlpha: 0, x: 100, scale: 1.06, duration: 1.2, ease: "expo.out",
      }, 0.2)
        .from(".arena-first, .arena-last", {
          autoAlpha: 0, yPercent: 110, skewY: 4, duration: 0.9, stagger: 0.12, ease: "expo.out",
        }, 0.4)
        .from(".arena-affiliation, .arena-number", {
          autoAlpha: 0, y: 20, duration: 0.7, stagger: 0.08, ease: "power3.out",
        }, 0.8);
      const portrait = root.current?.querySelector(".arena-portrait img");
      if (portrait) {
        tl.to(portrait, { scale: 1.045, duration: 8, ease: "none" }, 1.2);
      }
    });
    media.add("(prefers-reduced-motion: reduce)", () => {
      gsap.from(root.current, { autoAlpha: 0, duration: 0.18, ease: "none" });
    });
    return () => media.revert();
  }, []);
  const words = person.name.trim().split(/\s+/);
  const firstName = words[0];
  const lastName = words.slice(1).join(" ");
  const nameSize = lastName.length > 45 ? 56 : lastName.length > 26 ? 72 : lastName.length > 15 ? 96 : lastName.length > 11 ? 120 : 144;
  const number = String(person.number).padStart(3, "0");
  return (
    <article ref={root} className="arena-player absolute inset-0" aria-label={`Entra ${person.name}`}>
      <div aria-hidden className="arena-brand-panel absolute top-0 right-0 h-full w-[780px]" />
      <Portrait person={person} />
      <div className="absolute top-[335px] left-[88px] z-10 w-[1120px]">
        <h1 className="arena-type uppercase leading-[0.98] tracking-[-0.025em] text-hs-paper">
          <span className="block overflow-hidden pb-2"><span className="arena-first block text-hs-gold" style={{ fontSize: firstName.length > 14 || lastName.length > 15 ? 96 : 132 }}>{firstName}</span></span>
          {lastName ? <span className="block overflow-hidden pb-5"><span className="arena-last block text-balance break-words" style={{ fontSize: nameSize }}>{lastName}</span></span> : null}
        </h1>
        <div className="arena-affiliation mt-10 max-w-[870px]">
          <p className="text-[22px] font-semibold uppercase tracking-[0.1em] text-hs-gold">{person.role}</p>
          {person.company || person.university ? (
            <p className="mt-3 line-clamp-2 text-[34px] leading-snug text-hs-paper/75">{[person.company, person.university].filter(Boolean).join(" / ")}</p>
          ) : null}
        </div>
      </div>
      <p className="arena-number arena-type absolute right-[88px] bottom-[64px] z-10 text-[76px] leading-none tracking-[-0.02em] text-hs-paper/65"><span className="mr-1 text-hs-gold">#</span>{number}</p>

    </article>
  );
}

/** One continuous backdrop: covers the swap, then opens onto the next person. */
function ArrivalBands({ personId }: { personId?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const media = gsap.matchMedia(root);
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.set(".arena-color-band", { y: 0, yPercent: 0 });
      if (!personId) {
        gsap.timeline({ repeat: -1, repeatDelay: 0.6 })
          .to(".arena-color-band", {
            yPercent: -100, duration: 0.75, stagger: 0.06, ease: "expo.inOut",
          }, 0.8)
          .set(".arena-color-band", { yPercent: 100 })
          .to(".arena-color-band", {
            yPercent: 0, duration: 0.55, stagger: 0.06, ease: "expo.out",
          }, 2.2);
        return;
      }
      gsap.timeline()
        .to(".arena-color-band", {
          yPercent: -100, duration: 0.75, stagger: 0.06, ease: "expo.inOut",
        }, 0.2)
        .fromTo(".arena-color-band", { yPercent: 100 }, {
          yPercent: 0, duration: 0.65, stagger: 0.06, ease: "expo.out", immediateRender: false,
        }, PRESENTATION_MS / 1000 - 1);
    });
    media.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(root.current, { autoAlpha: personId ? 0 : 1 });
    });
    return () => media.revert();
  }, [personId]);
  return (
    <div ref={root} aria-hidden className="arena-color-curtain pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {BAND_TONES.map((tone, column) => (
        <div key={tone} className={`arena-color-band absolute inset-y-0 ${tone}`} style={{ left: `${column * 20}%`, width: "calc(20% + 1px)" }} />
      ))}
    </div>
  );
}

export function ArrivalStage({ person, demo = false, connected = true }: { person: Arrival | null; demo?: boolean; connected?: boolean }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  useEffect(() => {
    const element = viewport.current;
    if (!element) { return; }
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(entry.contentRect.width / 1920, entry.contentRect.height / 1080)));
    observer.observe(element);
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => { observer.disconnect(); document.removeEventListener("fullscreenchange", onFullscreen); };
  }, []);
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); }
      else { await viewport.current?.requestFullscreen(); }
      setFullscreenError(false);
    } catch { setFullscreenError(true); }
  }
  return (
    <div ref={viewport} className="group relative flex h-dvh w-full items-center justify-center overflow-hidden bg-hs-ink">
      <main className="arena-stage relative h-[1080px] w-[1920px] shrink-0 overflow-hidden bg-hs-ink text-hs-paper" style={{ transform: `scale(${scale})` }} aria-label="Bienvenida de participantes">
        <ArenaLights />
        {person ? <Player key={person.id} person={person} /> : null}
        <ArrivalBands personId={person?.id} />
        <header className="absolute top-[48px] right-[88px] left-[88px] z-50 flex h-[75px] items-center justify-between">
          <Image src="/logo.svg" alt="HackSpain" width={190} height={62} className="h-auto w-[190px]" />
          {demo || !connected ? <p className="font-mono text-[15px] uppercase tracking-[0.2em] text-hs-paper/45">{demo ? "Demo" : "Reconectando"}</p> : null}
        </header>
      </main>
      <button type="button" onClick={() => void toggleFullscreen()} className="absolute right-4 bottom-4 flex size-11 items-center justify-center rounded bg-hs-ink text-hs-paper opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100" aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}>{fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}</button>
      {fullscreenError ? <p role="status" className="absolute right-4 bottom-16 bg-hs-ink p-3 text-hs-paper">Usa la opción de pantalla completa de tu navegador.</p> : null}
    </div>
  );
}

export function ArrivalDemo() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setStep((value) => value + 1), PRESENTATION_MS);
    return () => window.clearInterval(timer);
  }, []);
  const person = step % 4 === 3 ? null : DEMO[step % 4];
  return <ArrivalStage person={person} demo />;
}

export function LiveArrivals() {
  const [since, setSince] = useState<number>();
  const snapshot = useQuery(api.passes.arrivals, since === undefined ? {} : { since });
  const connection = useConvexConnectionState();
  const [queue, setQueue] = useState<ArrivalQueue>(() => ({ pending: [], seen: new Set() }));
  useEffect(() => {
    if (!snapshot) { return; }
    // Synchronize the live Convex subscription with the local playback queue.
    // oxlint-disable-next-line react/set-state-in-effect -- adopts the server clock, not the display computer's clock.
    if (since === undefined) { setSince(snapshot.serverTime); return; }
    setQueue((previous) => reconcileArrivals(previous, snapshot.entries));
  }, [since, snapshot]);
  const person = queue.pending[0] ?? null;
  const personId = person?.id;
  // Lock timing for the current player: later arrivals must not restart its timer.
  const duration = PRESENTATION_MS;
  useEffect(() => {
    if (!personId) { return; }
    const timer = window.setTimeout(() => setQueue((previous) => ({ ...previous, pending: previous.pending.filter((entry) => entry.id !== personId) })), duration);
    return () => window.clearTimeout(timer);
  }, [personId, duration]);
  return <ArrivalStage person={person} connected={connection.isWebSocketConnected} />;
}
