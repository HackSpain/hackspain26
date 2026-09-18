import { MosaicBackground } from "../mosaic/mosaic-background";
import { useLayoutProfile } from "../mosaic/use-layout-profile";
import { formatRichPolicyText } from "./format-rich-policy-text";

interface ConductSection {
  id: string;
  paragraphs: string[];
  title: string;
}

const CONDUCT: {
  intro: string;
  pageTitle: string;
  sections: ConductSection[];
  updatedLine: string;
} = {
  intro:
    "HackSpain es un hackathon presencial. Este código vale para participantes, mentores, jueces, organización y cualquiera que esté en el recinto o en los canales del evento. Lo organiza la **Asociación HackSpain**.",
  pageTitle: "Código de conducta",
  sections: [
    {
      id: "build-here",
      title: "1. El proyecto se construye aquí",
      paragraphs: [
        "No llegues con el proyecto hecho. Puedes traer ideas, repos vacíos, plantillas públicas y herramientas que ya uses. Lo que presentes tiene que haberse construido durante HackSpain, en el horario del evento.",
        "Si reutilizas código abierto o un experimento previo, dilo. Copiar un producto ya resuelto y disfrazarlo de trabajo de 36 horas te saca del concurso.",
      ],
    },
    {
      id: "good-faith",
      title: "2. Buena fe",
      paragraphs: [
        "Juega limpio. No mientas en la inscripción, en el equipo ni en la entrega. No busques atajos para saltarte el espíritu del hackathon aunque la letra te deje un resquicio.",
        "Si algo no está claro, pregunta a la organización. No asumas que «si no está prohibido, vale».",
      ],
    },
    {
      id: "other-teams",
      title: "3. Los demás equipos",
      paragraphs: [
        "No intentes romper, tumbar, espiar ni sabotear el producto de otro equipo. Tampoco sus cuentas, demos, repos o infra.",
        "El hacking ofensivo contra otros participantes no es un track. Si encuentras un fallo de verdad, avisa a la organización; no lo uses.",
      ],
    },
    {
      id: "respect",
      title: "4. Respeto",
      paragraphs: [
        "Trata bien a tu equipo y a quien no está en él: otros hackers, mentores, jueces, sponsors, staff y recinto.",
        "No hay sitio para acoso, humillaciones, comentarios discriminatorios ni presionar a alguien para que se quede o se vaya. Si alguien te pide que pares, paras.",
      ],
    },
    {
      id: "deadlines",
      title: "5. Plazos",
      paragraphs: [
        "Las horas de envío, check-in y demo las marca la organización. Si el formulario se cierra, se cierra. No hay entregas por Discord a última hora salvo que lo digamos nosotros.",
        "Llegar tarde a una demo o a un briefing que te toca es cosa tuya. Avisa si no puedes continuar; no dejes al equipo colgado en silencio.",
      ],
    },
    {
      id: "enforcement",
      title: "6. Si se rompe",
      paragraphs: [
        "La organización puede avisar, descalificar, pedir que salgas del recinto o no invitarte a otra edición. En casos graves, también avisar al recinto o a quien corresponda.",
        "Para dudas o para contar un incidente: contact@hackspain.com.",
      ],
    },
  ],
  updatedLine: "Última actualización: 18 de septiembre de 2026",
};

export function ConductPage() {
  const t = CONDUCT;
  const profile = useLayoutProfile();

  return (
    <div className="relative z-0 min-h-dvh w-full">
      <MosaicBackground
        className="pointer-events-none fixed inset-0 -z-10 h-full min-h-dvh w-full"
        variant={profile ?? "desktop"}
      />
      <div className="relative z-0 mx-auto max-w-3xl px-3 pb-10 sm:px-4">
        <article className="border-[3px] border-hs-ink bg-hs-ink">
          <header className="border-hs-ink border-b-[3px] bg-hs-orange px-4 py-5 sm:px-6">
            <h1
              className="scroll-mt-28 font-bungee text-2xl text-hs-ink leading-tight sm:text-3xl"
              id="code-of-conduct"
            >
              {t.pageTitle}
            </h1>
            <p className="mt-2 font-bold font-sans text-hs-ink text-sm sm:text-base">
              {t.updatedLine}
            </p>
          </header>
          <div className="border-hs-ink border-t-[3px] bg-hs-paper px-4 py-6 sm:px-8 sm:py-10">
            <p className="border-hs-ink border-b-[3px] pb-6 font-sans font-semibold text-hs-brown text-sm leading-snug sm:text-base">
              {formatRichPolicyText(t.intro, "intro")}
            </p>
            <div className="divide-y-[3px] divide-hs-ink">
              {t.sections.map((s) => (
                <section
                  aria-labelledby={s.id}
                  className="scroll-mt-28 pt-8 first:pt-6"
                  key={s.id}
                >
                  <h2
                    className="font-bungee text-hs-ink text-lg leading-snug sm:text-xl"
                    id={s.id}
                  >
                    {s.title}
                  </h2>
                  <div className="mt-3 space-y-3 font-sans font-semibold text-hs-ink text-sm leading-relaxed sm:text-[0.95rem]">
                    {s.paragraphs.map((p) => (
                      <p key={`${s.id}-${p}`}>
                        {formatRichPolicyText(p, `${s.id}-${p.slice(0, 48)}`)}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
