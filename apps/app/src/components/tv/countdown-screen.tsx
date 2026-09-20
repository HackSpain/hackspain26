"use client";

import Image from "next/image";
import { useClock } from "./motion";
import frame from "./sponsors-screen.module.css";
import styles from "./countdown-screen.module.css";

// Fixed event deadline: 20 September 2026, 11:00 in Madrid (CEST).
const DEADLINE = Date.parse("2026-09-20T11:00:00+02:00");

export function CountdownScreen() {
  const now = useClock();
  const remaining = now ? Math.max(0, Math.ceil((DEADLINE - now.getTime()) / 1000)) : null;
  const finished = remaining === 0;
  const minutes = remaining === null ? "--" : String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = remaining === null ? "--" : String(remaining % 60).padStart(2, "0");

  return (
    <main className={frame.screen} aria-label="Cuenta atrás de HackSpain">
      <header className={frame.header}>
        <Image src="/logo.svg" alt="HackSpain" width={928} height={306} className={frame.brand} priority />
        <h1 className={`${frame.title} ${styles.bungee}`}>Tiempo restante</h1>
        <time className={`${frame.clock} ${styles.bungee}`}>
          {now?.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })}
        </time>
      </header>
      <div className={frame.leftRail} aria-hidden="true"><span /><span /><span /></div>
      <section className={styles.countdown}>
        <p className={styles.heading} role="status">{finished ? "¡Tiempo cumplido!" : "Cada segundo cuenta"}</p>
        <div className={styles.timer} role="timer" aria-label={`${minutes} minutos y ${seconds} segundos restantes`}>
          <div className={styles.unit}><span className={styles.digits}>{minutes}</span><span className={styles.label}>Minutos</span></div>
          <span className={styles.colon} aria-hidden="true">:</span>
          <div className={styles.unit}><span className={styles.digits}>{seconds}</span><span className={styles.label}>Segundos</span></div>
        </div>
        <p className={styles.deadline}>Hora de entrega · <time dateTime="2026-09-20T11:00:00+02:00">11:00</time> · Madrid</p>
      </section>
      <div className={frame.rightRail} aria-hidden="true"><span /><span /><span /></div>
      <div className={frame.footer} aria-hidden="true"><span /><span /><span /><span /></div>
    </main>
  );
}
