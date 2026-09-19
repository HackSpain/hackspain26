"use client";

import { Trophy } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { compact } from "@/app/insights/mock-data";
import { ArenaLights } from "@/components/arena-lights";
import { NO_TEAM_ID } from "@/app/insights/use-live-insights";
import type { LiveInsightData } from "@/app/insights/use-live-insights";
import {
  advanceMilestonePlayback,
  BROADCAST_MS,
  createMilestonePlayback,
  reachedTokenMilestones,
  updateMilestonePlayback,
} from "@/lib/tv-milestones";
import type { TokenMilestone } from "@/lib/tv-milestones";
import styles from "./milestone-broadcast.module.css";

const EASE = [0.22, 1, 0.36, 1] as const;

function useMilestonePlayback(
  data: LiveInsightData,
  replayInitial: boolean,
): TokenMilestone | undefined {
  const milestones = useMemo(
    () =>
      reachedTokenMilestones(
        data.samples,
        data.teams.filter((team) => team.id !== NO_TEAM_ID),
    ),
    [data.samples, data.teams],
  );
  const [playback, setPlayback] = useState(() => replayInitial && data.status === "ok"
    ? updateMilestonePlayback(createMilestonePlayback(), milestones, Date.now(), true)
    : createMilestonePlayback());

  useEffect(() => {
    if (data.status !== "ok" && data.status !== "empty") {
      return;
    }
    const now = Date.now();
    // oxlint-disable-next-line react/set-state-in-effect -- reconcile an external telemetry poll with the timed broadcast queue.
    setPlayback((current) => updateMilestonePlayback(current, milestones, now, replayInitial));
  }, [data.status, milestones, replayInitial]);

  const nextAt = playback.active ? playback.endsAt : playback.pending.length ? playback.availableAt : undefined;
  useEffect(() => {
    if (nextAt === undefined) {
      return;
    }
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setPlayback((current) => advanceMilestonePlayback(current, now));
    }, Math.max(0, nextAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [nextAt]);

  return playback.active;
}

export function MilestoneBroadcast({
  data,
  replayInitial = false,
}: {
  data: LiveInsightData;
  replayInitial?: boolean;
}) {
  const reduced = useReducedMotion();
  const active = useMilestonePlayback(data, replayInitial);

  return (
    <AnimatePresence initial={false} mode="wait">
      {active ? (
        <motion.aside
          key={active.id}
          role="status"
          aria-live="polite"
          className={styles.broadcast}
          initial={{ opacity: 0, y: reduced ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: reduced ? 0.15 : 0.3, ease: EASE }}
        >
          <div className={styles.layout}>
            <header className={styles.header}>
              <span className={styles.badge}><Trophy aria-hidden /> Nuevo hito</span>
              <span className={styles.eyebrow}>
                {active.kind === "team" ? "Equipo" : "Todo HackSpain"}
              </span>
            </header>

            <div className={styles.content}>
              <div className={styles.lights} aria-hidden><ArenaLights /></div>
              <h2 className={styles.name}>
                {active.kind === "team" ? `El equipo ${active.team.name}` : "Entre todos"}
              </h2>
              <p className={styles.achievement}>
                {active.kind === "team" ? "Ha alcanzado" : "Hemos alcanzado"}
              </p>
              <p className={styles.metric}>
                <span className={styles.value}>{compact(active.tokens)}</span>{" "}
                <span className={styles.unit}>tokens</span>
              </p>
            </div>

            <footer className={styles.footer}>
              <span>HackSpain / 2026</span>
              <span>Seguimos en directo</span>
            </footer>
            <motion.div
              className={styles.progress}
              aria-hidden
              initial={{ scaleX: 1 }}
              animate={{ scaleX: reduced ? 1 : 0 }}
              transition={{ duration: reduced ? 0 : BROADCAST_MS / 1000, ease: "linear" }}
            />
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
