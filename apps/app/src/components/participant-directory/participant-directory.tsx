"use client";

import type { DirectoryParticipant } from "./types";
import { ConnectionGraph } from "./connection-graph";
import "./participant-directory.css";

export function ParticipantDirectory({
  participants,
}: {
  participants: DirectoryParticipant[];
}) {
  return (
    // Proton Pass can add data-protonpass-form before React hydrates this wrapper.
    // Suppress attribute mismatches only here; descendants still hydrate normally.
    <div className="participant-directory" suppressHydrationWarning>
      <section className="pd-hero">
        <div className="pd-hero-copy">
          <h1>
            CONOCE A LOS <em>BUILDERS</em> DEL FUTURO.
          </h1>
          <p>
            Conoce a quienes comparten tu ciudad, universidad, habilidades e
            intereses.
          </p>
          <a className="pd-primary" href="#participantes">
            Encontrar conexiones <span>↓</span>
          </a>
        </div>
      </section>

      <ConnectionGraph participants={participants} />
    </div>
  );
}
