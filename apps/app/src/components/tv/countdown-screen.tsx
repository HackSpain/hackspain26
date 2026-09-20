"use client";

import Image from "next/image";
import { useClock } from "./motion";
import frame from "./sponsors-screen.module.css";
import styles from "./countdown-screen.module.css";

export function CountdownScreen() {
  const now = useClock();

  return (
    <main className={frame.screen} aria-label="Tiempo terminado en HackSpain">
      <header className={frame.header}>
        <Image src="/logo.svg" alt="HackSpain" width={928} height={306} className={frame.brand} priority />
        <h1 className={`${frame.title} ${styles.bungee}`}>Entrega de proyectos</h1>
        <time className={`${frame.clock} ${styles.bungee}`}>
          {now?.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })}
        </time>
      </header>
      <div className={frame.leftRail} aria-hidden="true"><span /><span /><span /></div>
      <section className={styles.finished} aria-labelledby="time-finished">
        <h2 id="time-finished" className={styles.headline}>Tiempo<br />terminado</h2>
        <p className={styles.instructions}>No se permiten más commits<br />ni cambios en el proyecto.</p>
        <div className={styles.help}>
          <p>¿Problemas con el envío?</p>
          <p>Avisad a la organización.</p>
        </div>
      </section>
      <div className={frame.rightRail} aria-hidden="true"><span /><span /><span /></div>
      <div className={frame.footer} aria-hidden="true"><span /><span /><span /><span /></div>
    </main>
  );
}
