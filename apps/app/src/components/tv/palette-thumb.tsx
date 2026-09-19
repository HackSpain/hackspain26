/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import type { TvWidgetKind } from "@/lib/tv";
import { cn } from "@/lib/utils";

const SPONSOR_MARKS = [
  { src: "/sponsors/cursor.svg", name: "Cursor" },
  { src: "/sponsors/fal.svg", name: "fal.ai" },
  { src: "/sponsors/cognition.svg", name: "Cognition" },
  { src: "/sponsors/vercel.svg", name: "Vercel" },
] as const;

export function PaletteThumb({ kind }: { kind: TvWidgetKind }) {
  return (
    <div
      aria-hidden
      className="relative size-full overflow-hidden bg-hs-ink text-hs-paper"
    >
      {thumb(kind)}
    </div>
  );
}

function thumb(kind: TvWidgetKind) {
  switch (kind) {
    case "banner": {
      return (
        <div className="flex size-full items-center justify-center bg-hs-ink px-2">
          <p className="font-bungee text-[11px] leading-none text-balance text-hs-gold uppercase">
            HackSpain
          </p>
        </div>
      );
    }
    case "ticker": {
      return (
        <div className="flex size-full items-center bg-hs-ink">
          <div className="flex h-[42%] w-full items-center overflow-hidden bg-hs-gold">
            <p className="whitespace-nowrap px-2 font-bungee text-[9px] text-hs-ink uppercase">
              Cena · 21:00 · planta baja · Cena · 21:00
            </p>
          </div>
        </div>
      );
    }
    case "clock": {
      return (
        <div className="flex size-full items-center justify-center bg-hs-ink">
          <p className="font-bungee text-lg leading-none tabular-nums text-hs-paper">
            21:00
          </p>
        </div>
      );
    }
    case "message": {
      return (
        <div className="flex size-full items-center bg-hs-ink p-2">
          <div className="flex h-full w-full flex-col justify-center border-[3px] border-hs-gold/40 px-2">
            <span className="h-1.5 w-4/5 bg-hs-paper/80" />
            <span className="mt-1 h-1.5 w-3/5 bg-hs-paper/45" />
            <span className="mt-1 h-1.5 w-2/5 bg-hs-paper/25" />
          </div>
        </div>
      );
    }
    case "liveCommits": {
      return (
        <Paper>
          <p className="font-bungee text-[8px] uppercase">Commits</p>
          <div className="mt-1 space-y-1">
            {[
              ["tortilla", "feat: auth"],
              ["siesta", "fix: deploy"],
              ["paella", "docs: readme"],
            ].map(([repo, msg]) => (
              <div key={repo} className="flex items-center gap-1.5">
                <span className="size-1.5 shrink-0 bg-hs-teal" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[7px] text-hs-brown">
                    {repo}
                  </p>
                  <p className="truncate text-[8px] font-semibold leading-none">
                    {msg}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Paper>
      );
    }
    case "liveAgents": {
      return (
        <Paper>
          <p className="font-bungee text-[8px] uppercase">Agentes</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(
              [
                ["Claude", true],
                ["Codex", true],
                ["Cursor", false],
              ] as const
            ).map(([name, on]) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 border border-hs-ink/20 px-1 py-0.5 text-[7px] font-semibold"
              >
                <span
                  className={cn("size-1.5", on ? "bg-hs-gold" : "bg-hs-ink/20")}
                />
                {name}
              </span>
            ))}
          </div>
        </Paper>
      );
    }
    case "liveModels": {
      return (
        <Paper>
          <p className="font-bungee text-[8px] uppercase">Modelos</p>
          <div className="mt-1.5 space-y-1">
            {(
              [
                ["claude-sonnet-4-5", 90, "bg-hs-orange"],
                ["gpt-5-codex", 62, "bg-hs-teal"],
                ["gemini-2-5-pro", 34, "bg-hs-navy"],
              ] as const
            ).map(([name, width, color]) => (
              <div key={name} className="space-y-0.5">
                <p className="truncate font-mono text-[7px] leading-none">{name}</p>
                <span className="block h-1 bg-hs-ink/10">
                  <span className={cn("block h-full", color)} style={{ width: `${width}%` }} />
                </span>
              </div>
            ))}
          </div>
        </Paper>
      );
    }
    case "liveTokens": {
      return (
        <div className="flex size-full flex-col justify-between bg-hs-gold p-2 text-hs-ink">
          <p className="font-bungee text-[8px] uppercase">Tokens</p>
          <div className="flex items-end justify-between gap-1">
            <p className="font-sans text-lg leading-none font-black tracking-tight tabular-nums">
              12.4M
            </p>
            <Spark
              heights={[30, 45, 40, 62, 55, 80, 70]}
              color="bg-hs-ink"
              className="h-7 w-10"
            />
          </div>
        </div>
      );
    }
    case "liveLeaderboard":
    case "insightsLeaderboard": {
      return (
        <Paper>
          <p className="font-bungee text-[8px] uppercase">Equipos</p>
          <ol className="mt-1 space-y-0.5">
            {(
              [
                ["Molinos", 92],
                ["Tortilla", 74],
                ["Paella", 51],
              ] as const
            ).map(([name, pct], index) => (
              <li key={name} className="flex items-center gap-1">
                <span
                  className={cn(
                    "flex size-3 items-center justify-center font-mono text-[7px] tabular-nums",
                    index === 0 && "bg-hs-gold",
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[8px] font-semibold">
                  {name}
                </span>
                <span className="h-1 min-w-0 flex-1 bg-hs-ink/10">
                  <span
                    className="block h-full bg-hs-navy/50"
                    style={{ width: `${pct}%` }}
                  />
                </span>
              </li>
            ))}
          </ol>
        </Paper>
      );
    }
    case "feed": {
      return (
        <Paper>
          <p className="font-bungee text-[8px] uppercase">Feed</p>
          <div className="mt-1 flex gap-1.5">
            <span className="size-8 shrink-0 bg-hs-gold outline outline-black/10" />
            <div className="min-w-0 flex-1 space-y-1 pt-0.5">
              <span className="block h-1.5 w-4/5 bg-hs-ink/80" />
              <span className="block h-1.5 w-full bg-hs-ink/25" />
              <span className="block h-1.5 w-2/3 bg-hs-ink/15" />
            </div>
          </div>
        </Paper>
      );
    }
    case "sponsorGrid": {
      return (
        <div className="grid size-full grid-cols-2 gap-1 bg-hs-paper p-1.5">
          {SPONSOR_MARKS.map((mark) => (
            <span
              key={mark.name}
              className="flex items-center justify-center border border-hs-ink/15 bg-hs-paper"
            >
              <img
                src={mark.src}
                alt=""
                className="h-4 w-auto max-w-[70%] object-contain brightness-0"
              />
            </span>
          ))}
        </div>
      );
    }
    case "sponsorTicker": {
      return (
        <div className="flex size-full items-center bg-hs-paper">
          <div className="flex h-[48%] w-full items-center gap-2 overflow-hidden border-y border-hs-ink/15 bg-hs-sand/60 px-1.5">
            {SPONSOR_MARKS.map((mark) => (
              <img
                key={mark.name}
                src={mark.src}
                alt=""
                className="h-3.5 w-auto shrink-0 object-contain opacity-80 brightness-0"
              />
            ))}
          </div>
        </div>
      );
    }
    case "insightsStats": {
      return (
        <div className="grid size-full grid-cols-2 gap-1 bg-hs-ink p-1.5">
          {["12M", "840", "64", "112"].map((value, index) => (
            <div
              key={value}
              className={cn(
                "flex flex-col justify-between p-1",
                index === 0
                  ? "bg-hs-gold text-hs-ink"
                  : "bg-hs-paper text-hs-ink",
              )}
            >
              <span className="h-1 w-5 bg-current/30" />
              <span className="font-sans text-[11px] leading-none font-black tabular-nums">
                {value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    case "insightsActivity": {
      return (
        <Paper>
          <p className="font-bungee text-[8px] uppercase">Actividad</p>
          <div className="mt-1 min-h-0 flex-1">
            <Spark
              heights={[28, 42, 36, 58, 50, 72, 64, 88, 70, 80, 62, 75]}
              color="bg-hs-navy"
            />
          </div>
        </Paper>
      );
    }
    case "insightsHarness": {
      return (
        <Paper>
          <p className="font-bungee text-[8px] uppercase">Harnesses</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="size-8 shrink-0 rounded-full border-[6px] border-hs-sand border-t-hs-gold border-r-hs-teal" />
            <div className="min-w-0 flex-1 space-y-1">
              <span className="block h-1 w-full bg-hs-gold" />
              <span className="block h-1 w-3/4 bg-hs-teal" />
              <span className="block h-1 w-1/2 bg-hs-navy/40" />
            </div>
          </div>
        </Paper>
      );
    }
    case "insightsStacks": {
      return (
        <Paper>
          <p className="font-bungee text-[8px] uppercase">Stacks</p>
          <div className="mt-1.5 space-y-1">
            {[88, 70, 52, 34].map((width) => (
              <span
                key={width}
                className="block h-1.5 bg-hs-navy/70"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        </Paper>
      );
    }
    case "insightsScatter": {
      return (
        <Paper>
          <p className="font-bungee text-[8px] uppercase">Tokens / commits</p>
          <div className="relative mt-1 min-h-0 flex-1 border border-hs-ink/15">
            <span className="absolute top-[28%] left-[22%] size-1.5 bg-hs-navy" />
            <span className="absolute top-[46%] left-[48%] size-1.5 bg-hs-teal" />
            <span className="absolute top-[62%] left-[70%] size-1.5 bg-hs-gold" />
            <span className="absolute top-[38%] left-[60%] size-1.5 bg-hs-orange" />
            <span className="absolute top-[72%] left-[40%] size-1.5 bg-hs-navy/50" />
          </div>
        </Paper>
      );
    }
    case "insightsEvolution": {
      return (
        <Paper>
          <p className="font-bungee text-[8px] uppercase">Evolución</p>
          <div className="mt-1 flex min-h-0 flex-1 items-end gap-0.5">
            {[32, 44, 38, 58, 70, 64, 82].map((height) => (
              <span
                key={height}
                className={cn(
                  "min-w-0 flex-1",
                  height === 82 ? "bg-hs-gold" : "bg-hs-navy/55",
                )}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </Paper>
      );
    }
  }
}

function Paper({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-full min-h-0 flex-col bg-hs-paper p-1.5 text-hs-ink">
      {children}
    </div>
  );
}

function Spark({
  heights,
  color,
  className,
}: {
  heights: number[];
  color: string;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full items-end gap-px", className)}>
      {heights.map((height, index) => (
        <span
          key={index}
          className={cn("min-w-0 flex-1", color)}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}
