"use client";

import Image from "next/image";
import { resolveTvSponsors } from "@/lib/tv";
import { useClock } from "./motion";
import styles from "./sponsors-screen.module.css";

export function SponsorsScreen() {
  const now = useClock();

  return (
    <main className={styles.screen} aria-label="Patrocinadores de HackSpain">
      <header className={styles.header}>
        <Image src="/logo.svg" alt="HackSpain" width={928} height={306} className={styles.brand} priority />
        <h1 className={styles.title}>Patrocinadores</h1>
        <time className={styles.clock}>
          {now?.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })}
        </time>
      </header>
      <div className={styles.leftRail} aria-hidden="true"><span /><span /><span /></div>
      <ul className={styles.grid}>
        {resolveTvSponsors().map((sponsor) => (
          <li key={sponsor.name} className={styles.cell} data-sponsor={sponsor.name}>
            <Image
              src={sponsor.logoUrl.replace("/sponsors/", "/sponsors/tv/").replace(/\.png$/, ".svg")}
              alt={sponsor.name}
              width={360}
              height={120}
              className={styles.logo}
              priority
            />
          </li>
        ))}
      </ul>
      <div className={styles.rightRail} aria-hidden="true"><span /><span /><span /></div>
      <div className={styles.footer} aria-hidden="true"><span /><span /><span /><span /></div>
    </main>
  );
}
