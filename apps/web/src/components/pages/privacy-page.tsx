import { MosaicBackground } from "../mosaic/mosaic-background";
import { useLayoutProfile } from "../mosaic/use-layout-profile";
import { formatRichPolicyText } from "./format-rich-policy-text";

interface PrivacySection {
  id: string;
  paragraphs: string[];
  title: string;
}

const PRIVACY: {
  pageTitle: string;
  updatedLine: string;
  disclaimer: string;
  goodFaithTitle: string;
  goodFaithBody: string;
  sections: PrivacySection[];
} = {
  disclaimer:
    "Esta información se ofrece con fines de transparencia y no sustituye asesoramiento jurídico. La **Asociación HackSpain** puede actualizar este documento; la fecha indicada arriba cambiará cuando lo hagamos.",
  goodFaithBody:
    "La **Asociación HackSpain** se compromete a actuar en todo momento de **buena fe** hacia participantes, patrocinadores y colaboradores cuando tratamos datos personales y organizamos HackSpain. Todo lo recogido en esta política de privacidad está redactado y debe interpretarse y aplicarse de **buena fe**, con intención honesta, equidad y proporcionalidad, junto con el cumplimiento estricto de la ley.",
  goodFaithTitle: "Buena fe",
  pageTitle: "Política de privacidad",
  sections: [
    {
      id: "controller",
      title: "1. Responsable del tratamiento",
      paragraphs: [
        "El responsable del tratamiento es la **Asociación HackSpain** («nosotros», «HackSpain»), asociación sin ánimo de lucro inscrita en España, en el marco de la iniciativa HackSpain 2026 y actividades relacionadas.",
        "Para consultas sobre protección de datos y ejercicio de derechos: contact@hackspain.com.",
        "Tratamos los datos personales de conformidad con el Reglamento (UE) 2016/679 (**RGPD**) y, en su caso, con la Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (**LOPDGDD**).",
      ],
    },
    {
      id: "data-we-collect",
      title: "2. Categorías de datos",
      paragraphs: [
        "A través del formulario de registro / interés podemos recopilar: datos identificativos y de contacto (p. ej. nombre, email), contexto profesional o académico que decidas aportar, enlaces a perfiles o webs públicos, respuestas en texto libre (p. ej. logros, intereses, motivación como embajador/a y lugar de estudios si aplica), restricciones alimentarias y detalles de alergias que decidas comunicar, y datos técnicos habituales en peticiones web (p. ej. dirección IP, user agent) tratados por nuestro alojamiento y proveedores de seguridad.",
        "Las restricciones alimentarias o alergias pueden revelar datos relativos a la salud, una categoría especial de datos. Su aportación es opcional y no debes incluir otros datos de categorías especiales en los campos de texto libre.",
      ],
    },
    {
      id: "purposes",
      title: "3. Finalidades",
      paragraphs: [
        "Utilizamos tus datos para: gestionar manifestaciones de interés y solicitudes; comunicarnos contigo sobre HackSpain; organizar y mejorar el evento; cumplir obligaciones legales; garantizar la seguridad y prevenir abusos; elaborar estadísticas agregadas que no te identifiquen; y comunicar datos personales a patrocinadores y colaboradores oficiales de HackSpain según el apartado 4.",
        "Las restricciones alimentarias y alergias se utilizan exclusivamente para planificar las comidas, prevenir incidentes y atender tus necesidades durante el evento.",
      ],
    },
    {
      id: "sponsors",
      title: "4. Patrocinadores y colaboradores (destinatarios de tus datos)",
      paragraphs: [
        "Podemos comunicar datos personales a patrocinadores y colaboradores oficiales de HackSpain 2026. El listado actual puede publicarse en https://hackspain.com y actualizarse con el tiempo.",
        "La comunicación se limita a lo necesario para finalidades vinculadas al evento, como: entrega de premios, retos o contenido técnico ofrecido por un patrocinador; coordinación logística o promocional acordada con patrocinadores; facilitar a patrocinadores información agregada o, cuando proceda, información de participantes relacionada con talento, selección o contacto vinculado al hackathon; cumplimiento de acuerdos de patrocinio; y finalidades análogas directamente relacionadas con HackSpain.",
        "No comunicamos a patrocinadores ni colaboradores tus restricciones alimentarias, alergias ni sus detalles. Solo podrá acceder a ellos el personal o proveedor de restauración que necesite conocerlos para organizar comidas seguras, sujeto a deberes de confidencialidad y protección de datos.",
        "Los patrocinadores y colaboradores que reciban tus datos pueden actuar como **responsables del tratamiento independientes** para sus propias finalidades. El uso que hagan de los datos se regirá por sus propias políticas de privacidad y bases jurídicas. Seleccionamos patrocinadores y, cuando corresponde, exigimos compromisos contractuales o prácticos de confidencialidad y protección de datos, pero no somos responsables de su tratamiento independiente más allá de lo exigido por la normativa aplicable.",
        "La base jurídica para comunicar tus datos a patrocinadores y colaboradores incluye: tu **consentimiento**, prestado al enviar el formulario tras leer esta política; y, cuando proceda, nuestro **interés legítimo** en organizar un hackathon con patrocinio y cumplir compromisos con partners, siempre que no prevalezcan tus intereses y derechos fundamentales. Si el patrocinador se basa en interés legítimo, puedes tener **derecho de oposición** según su política y la ley aplicable.",
        "Si un patrocinador o colaborador está establecido fuera del Espacio Económico Europeo, las transferencias quedan sujetas al capítulo V del RGPD (p. ej. decisiones de adecuación, cláusulas contractuales tipo u otras garantías apropiadas). La documentación del patrocinador debe describir dichas transferencias cuando existan.",
      ],
    },
    {
      id: "legal-basis",
      title: "5. Base jurídica (RGPD)",
      paragraphs: [
        "El tratamiento por la **Asociación HackSpain** se basa en: tu **consentimiento** al enviar el formulario y aceptar esta política (incluida la comunicación a patrocinadores según el apartado 4, cuando aplique el consentimiento); nuestros **intereses legítimos** en organizar HackSpain, valorar la participación o el programa de embajadores/as, asegurar nuestros servicios y desarrollar el evento con patrocinadores, cuando dichos intereses no prevalezcan sobre tus derechos; y **obligaciones legales** cuando corresponda.",
        "Cuando facilitas restricciones alimentarias o alergias, tratamos esos datos sobre la base de tu **consentimiento explícito**, solicitado mediante una casilla separada antes de enviar la solicitud, de conformidad con el artículo 9.2.a del RGPD. No aportar estos datos no afecta a la valoración de tu candidatura.",
        "Puedes retirar el consentimiento en cualquier momento; la retirada no afecta a la licitud del tratamiento previo. Para derechos frente al tratamiento independiente de un patrocinador, también puedes dirigirte a dicho patrocinador o solicitarnos aclaración sobre el destinatario.",
      ],
    },
    {
      id: "storage-retention",
      title: "6. Conservación y almacenamiento",
      paragraphs: [
        "Los datos se almacenan en infraestructura acorde con nuestra actividad. Cuando los servidores estén en el Espacio Económico Europeo (EEE) o en países con decisión de adecuación, las transferencias quedan cubiertas en esos términos. Las transferencias internacionales adicionales se detallan en el apartado siguiente.",
        "Conservamos los datos solo el tiempo necesario para las finalidades indicadas, incluidas reclamaciones legales y necesidades organizativas legítimas, y después los suprimimos o anonimizamos salvo que la ley exija un plazo mayor.",
        "Las restricciones alimentarias y alergias se separan de los canales generales de coordinación y se eliminan o anonimizan cuando dejan de ser necesarias para la logística y seguridad alimentaria del evento, salvo obligación legal o necesidad de atender una reclamación.",
      ],
    },
    {
      id: "processors-ai",
      title:
        "7. Encargados, algoritmos y herramientas de terceros (incluida IA)",
      paragraphs: [
        "Podemos utilizar proveedores (encargados del tratamiento) para alojamiento, bases de datos, correo, analítica, seguridad, restauración y funciones similares. Tratan los datos solo siguiendo nuestras instrucciones y con un contrato acorde al RGPD.",
        "Podemos utilizar medios automatizados —incluidos algoritmos y servicios de inteligencia artificial o aprendizaje automático de terceros— para ayudar a revisar, clasificar, resumir o puntuar el contenido de las solicitudes (por ejemplo para priorizar contactos, valorar el encaje en el programa de embajadores/as o detectar spam). Este tratamiento puede implicar la transferencia del contenido estrictamente necesario a proveedores establecidos fuera del EEE. Cuando proceda, nos basamos en garantías apropiadas del RGPD (como las cláusulas contractuales tipo de la Comisión Europea), además de medidas técnicas y organizativas.",
        "No se adoptan decisiones que te afecten significativamente únicamente de forma automatizada sin revisión humana cuando el RGPD lo exija; puedes solicitar intervención humana según el apartado de derechos.",
      ],
    },
    {
      id: "rights",
      title: "8. Tus derechos",
      paragraphs: [
        "En virtud del RGPD y la LOPDGDD puedes, con los límites legales: acceder a tus datos; rectificar los inexactos; suprimirlos («derecho al olvido») cuando proceda; limitar el tratamiento; oponerte al basado en interés legítimo (incluidos ciertos supuestos de comunicación a patrocinadores cuando esa sea la base); recibir tus datos en formato estructurado (portabilidad) cuando el tratamiento se base en consentimiento o contrato y sea automatizado; y retirar el consentimiento.",
        "Para ejercer derechos frente a la **Asociación HackSpain**, escribe a contact@hackspain.com. Si tu solicitud se refiere al tratamiento por un patrocinador o colaborador como **responsable independiente**, también debes dirigirte a ellos mediante la información de su política de privacidad; te asistiremos cuando el **RGPD** nos obligue (p. ej. información sobre destinatarios).",
        "Puedes presentar reclamación ante una autoridad de control; en España, la Agencia Española de Protección de Datos (AEPD — https://www.aepd.es).",
      ],
    },
    {
      id: "security",
      title: "9. Seguridad",
      paragraphs: [
        "Aplicamos medidas técnicas y organizativas apropiadas para proteger los datos personales frente a accesos no autorizados, pérdida o alteración. Ningún sistema en Internet es completamente seguro.",
      ],
    },
    {
      id: "changes",
      title: "10. Cambios",
      paragraphs: [
        "Podemos actualizar este documento para reflejar cambios en el tratamiento o en la normativa (incluidos cambios en patrocinadores o en las prácticas de comunicación de datos). Actualizaremos la fecha de «última actualización» y, cuando corresponda, te informaremos o solicitaremos un nuevo consentimiento.",
      ],
    },
  ],
  updatedLine: "Última actualización: 29 de julio de 2026",
};

export function PrivacyPage() {
  const t = PRIVACY;
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
              id="privacy-policy"
            >
              {t.pageTitle}
            </h1>
            <p className="mt-2 font-bold font-sans text-hs-ink text-sm sm:text-base">
              {t.updatedLine}
            </p>
          </header>
          <div className="border-hs-ink border-t-[3px] bg-hs-paper px-4 py-6 sm:px-8 sm:py-10">
            <p className="border-hs-ink border-b-[3px] pb-6 font-sans font-semibold text-hs-brown text-sm leading-snug sm:text-base">
              {formatRichPolicyText(t.disclaimer, "disclaimer")}
            </p>
            <div className="border-hs-ink border-b-[3px] bg-hs-teal/10 px-3 py-5 sm:px-4 sm:py-6">
              <h2 className="font-bungee text-base text-hs-ink leading-snug sm:text-lg">
                {t.goodFaithTitle}
              </h2>
              <p className="mt-2 font-sans font-semibold text-hs-ink text-sm leading-relaxed sm:text-[0.95rem]">
                {formatRichPolicyText(t.goodFaithBody, "good-faith")}
              </p>
            </div>
            <div className="divide-y-[3px] divide-hs-ink">
              {t.sections.map((s) => (
                <section
                  aria-labelledby={
                    s.id === "processors-ai" ? "data-processing" : s.id
                  }
                  className="scroll-mt-28 pt-8 first:pt-6"
                  key={s.id}
                >
                  <h2
                    className="font-bungee text-hs-ink text-lg leading-snug sm:text-xl"
                    id={s.id === "processors-ai" ? "data-processing" : s.id}
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
