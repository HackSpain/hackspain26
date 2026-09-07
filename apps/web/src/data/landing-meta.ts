import { areSignupsClosed } from "./signup-deadline";

const SITE = "https://hackspain.com";

/** Official profiles for CTAs (footer, signup end screen, etc.). */
export const HACKSPAIN_SOCIAL_URLS = {
  github: "https://github.com/samuelcorsan/hackspain.com",
  instagram: "https://www.instagram.com/hackspain26/",
  x: "https://x.com/hackspain26",
} as const;

/** Open Graph / Twitter / JSON-LD primary share image (`public/og-landing.png`). */
export const SOCIAL_SHARE_IMAGE = {
  height: 630,
  path: "/og-landing.png",
  width: 1200,
} as const;
export interface PageSeo {
  description: string;
  ogImageAlt: string;
  title: string;
}

const PAGES: PageSeo[] = [
  {
    description:
      "El hackathon para unir a los mejores builders jóvenes de España. 18 al 20 de Septiembre, UPM - ETSIT. 250 participantes.",
    ogImageAlt: "HackSpain 2026 — MADRID '26",
    title: "HackSpain 2026 — MADRID '26",
  },
  {
    description:
      "36 horas. 250 de los mejores builders menores de 30. HackSpain 2026 es el punto de encuentro de los jóvenes que van a posicionar a España como líder de talento tech joven.",
    ogImageAlt: "HackSpain 2026 — España tiene talento",
    title: "España tiene talento. Nosotros vamos a juntarlo. | HackSpain 2026",
  },
  {
    description:
      "Compute gratis para todos. Cinco tracks con retos de las mejores startups de España: Maisa, HappyRobot, Prosper AI, Embat y THEKER Robotics.",
    ogImageAlt: "HackSpain 2026 — tracks originales",
    title: "Tracks originales | HackSpain 2026",
  },
  {
    description:
      "Un único gran premio de 5.000 € para el equipo ganador de HackSpain 2026, con el patrocinio de JME Ventures, Kfund, Kibo Ventures, Enzo Ventures y Acurio Ventures.",
    ogImageAlt: "HackSpain 2026 — 1 gran premio de 5.000 €",
    title: "1 gran premio de 5.000 € | HackSpain 2026",
  },
  {
    description:
      "Conecta con los mejores fundadores y mentores del ecosistema de España. Con RevenueCat, Reveni, Karumi, Invopop y Causa Prima.",
    ogImageAlt: "HackSpain 2026 — comida, bebida y charlas",
    title: "Comida, bebida y charlas | HackSpain 2026",
  },
  {
    description: "Inscripción abierta para HackSpain 2026. Envía tu solicitud.",
    ogImageAlt: "HackSpain 2026 — inscripción abierta",
    title: "Inscripción abierta | HackSpain 2026",
  },
];

/** The signup section is the last one; its copy depends on the deadline. */
const SIGNUP_SECTION_INDEX = PAGES.length - 1;

const SIGNUP_CLOSED_SEO: PageSeo = {
  description:
    "HackSpain 2026 empieza el 18 de septiembre a las 17:00 en UPM - ETSIT, Madrid. Las plazas están cubiertas.",
  ogImageAlt: "HackSpain 2026 — empieza el 18 de septiembre",
  title: "Empieza el 18 de septiembre | HackSpain 2026",
};

export function seoForSectionIndex(i: number): PageSeo {
  const index = Math.max(0, Math.min(PAGES.length - 1, i));
  if (index === SIGNUP_SECTION_INDEX && areSignupsClosed()) {
    return SIGNUP_CLOSED_SEO;
  }
  return PAGES[index] ?? PAGES[0];
}

export const SIGNUP_KEYWORDS =
  "apuntarse HackSpain, registro hackathon España, hackathon Madrid 2026, Hack Spain registro, interés hackathon jóvenes";

export function signupSeo(): PageSeo {
  return {
    description:
      "Completa tu solicitud para HackSpain 2026. Revisamos cada candidatura antes de confirmar la plaza.",
    ogImageAlt: "HackSpain 2026 — apúntate al hackathon",
    title: "Apúntate al hackathon | HackSpain 2026",
  };
}

export const AMBASSADOR_KEYWORDS =
  "embajador HackSpain, campus hackathon España, universidad hackathon Madrid 2026, embajador estudiantil hackathon";

export function ambassadorSeo(): PageSeo {
  return {
    description:
      "Junta builders, mueve el boca a boca y empuja hacia el registro — te mantenemos al día con fechas y enlaces oficiales, te aclaramos dudas si las tienes, y tienes contacto directo con el equipo para Madrid 2026.",
    ogImageAlt: "HackSpain 2026 — programa de embajadores",
    title: "Sé la cara de HackSpain en tu campus | HackSpain 2026",
  };
}

export const PRIVACY_KEYWORDS =
  "privacidad HackSpain, comunicación datos patrocinadores, RGPD, datos personales, registro hackathon, LOPDGDD";

export function privacySeo(): PageSeo {
  return {
    description:
      "Política de privacidad de la Asociación HackSpain: responsable del tratamiento, comunicación a patrocinadores, RGPD, LOPDGDD, derechos y tratamiento del registro (incl. análisis automatizado e IA).",
    ogImageAlt: "HackSpain — política de privacidad",
    title: "Política de privacidad — HACKSPAIN 2026",
  };
}

export const BRAND_KEYWORDS =
  "marca HackSpain, logo HackSpain, identidad visual HackSpain, recursos de prensa HackSpain, brand assets HackSpain";

export function brandSeo(): PageSeo {
  return {
    description:
      "Descarga los logos oficiales de HackSpain y consulta las pautas de color, tipografía, espaciado y uso de la marca.",
    ogImageAlt: "HackSpain — guía de marca y recursos oficiales",
    title: "Marca y recursos — HackSpain",
  };
}

const KEYWORDS_BASE =
  "HackSpain, Hack Spain, hackathon Madrid, hackathon España, builders jóvenes, UPM ETSIT, hackspain.com";

const KEYWORDS_BY_SECTION = [
  "MADRID 2026, 18 al 20 de Septiembre, 250 participantes",
  "España tiene talento, talento tech joven, 36 horas",
  "tracks originales, compute gratis, startups España",
  "gran premio, 5.000 euros, premio hackathon, fondos españoles, venture capital España",
  "comida bebida charlas, fundadores España, mentores hackathon, networking startups",
  "inscripción abierta, apúntate HackSpain",
];

export function keywordsForSectionIndex(i: number): string {
  const extra =
    KEYWORDS_BY_SECTION[
      Math.max(0, Math.min(KEYWORDS_BY_SECTION.length - 1, i))
    ] ?? "";
  return extra ? `${KEYWORDS_BASE}, ${extra}` : KEYWORDS_BASE;
}

export function jsonLdOrganization() {
  return {
    "@context": "https://schema.org",
    "@id": `${SITE}/#organization`,
    "@type": "Organization",
    alternateName: ["Hack Spain", "hack spain", "Hack Spain hackathon"],
    description:
      "El hackathon para unir a los mejores builders jóvenes de España.",
    inLanguage: "es",
    knowsAbout: [
      "hackathon España",
      "Madrid tech events",
      "young coders Europe",
      "machine learning hackathon",
    ],
    logo: `${SITE}/hs-icon.png`,
    name: "HackSpain",
    sameAs: [
      HACKSPAIN_SOCIAL_URLS.x,
      HACKSPAIN_SOCIAL_URLS.instagram,
      HACKSPAIN_SOCIAL_URLS.github,
    ],
    url: SITE,
  };
}

export function jsonLdWebSite() {
  return {
    "@context": "https://schema.org",
    "@id": `${SITE}/#website`,
    "@type": "WebSite",
    alternateName: ["Hack Spain", "hack spain"],
    description:
      "HackSpain 2026 — MADRID '26. 18 al 20 de Septiembre, UPM - ETSIT. Contenido en español.",
    inLanguage: "es",
    name: "HackSpain",
    publisher: { "@id": `${SITE}/#organization` },
    url: SITE,
  };
}

export function jsonLdWebPage(sectionIndex: number, pageUrl: string) {
  const seo = seoForSectionIndex(sectionIndex);
  return {
    "@context": "https://schema.org",
    "@id": `${pageUrl}#webpage`,
    "@type": "WebPage",
    about: { "@id": `${SITE}/#event` },
    description: seo.description,
    inLanguage: "es",
    isPartOf: { "@id": `${SITE}/#website` },
    name: seo.title,
    primaryImageOfPage: {
      "@type": "ImageObject",
      height: SOCIAL_SHARE_IMAGE.height,
      url: `${SITE}${SOCIAL_SHARE_IMAGE.path}`,
      width: SOCIAL_SHARE_IMAGE.width,
    },
    url: pageUrl,
  };
}

export function jsonLdEvent() {
  return {
    "@context": "https://schema.org",
    "@id": `${SITE}/#event`,
    "@type": "Event",
    alternateName: [
      "Hack Spain 2026",
      "hack spain hackathon",
      "HackSpain hackathon Madrid",
      "hackathon España",
      "hackathon Spain",
    ],
    description:
      "HackSpain 2026: 36 horas, 250 builders menores de 30. 18 al 20 de Septiembre en UPM - ETSIT, Madrid.",
    endDate: "2026-09-20",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    inLanguage: "es",
    keywords:
      "hackathon Madrid, hackathon España, HackSpain, builders jóvenes, tracks originales, compute gratis",
    location: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressCountry: "ES",
        addressLocality: "Madrid",
      },
      name: "UPM - ETSIT, Madrid, España",
    },
    name: "HackSpain 2026",
    organizer: { "@id": `${SITE}/#organization` },
    startDate: "2026-09-18T17:00:00+02:00",
    url: SITE,
  };
}

export function jsonLdFaq() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        acceptedAnswer: {
          "@type": "Answer",
          text: "HackSpain es el hackathon para unir a los mejores builders jóvenes de España. Edición 2026: 36 horas, 250 participantes, 18 al 20 de Septiembre en UPM - ETSIT (Madrid). Web oficial: hackspain.com.",
        },
        name: '¿Qué es HackSpain o "Hack Spain"?',
      },
      {
        "@type": "Question",
        acceptedAnswer: {
          "@type": "Answer",
          text: "18 al 20 de Septiembre de 2026 en UPM - ETSIT, Madrid, España. Más detalles en hackspain.com.",
        },
        name: "¿Cuándo es HackSpain 2026 y dónde se celebra?",
      },
      {
        "@type": "Question",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Completa tu solicitud en hackspain.com/signup. Revisamos cada candidatura antes de confirmar la plaza. También puedes seguir @hackspain26 en X e Instagram o escribir a contact@hackspain.com.",
        },
        name: "¿Cómo me apunto o me registro en HackSpain?",
      },
      {
        "@type": "Question",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Lee el programa en hackspain.com/ambassador. Puedes solicitar plaza y marcar que quieres participar como embajador o embajadora en hackspain.com/signup.",
        },
        name: "¿Cómo puedo ser embajador o embajadora de HackSpain?",
      },
      {
        "@type": "Question",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Los patrocinadores actuales son Google, K Fund, fal.ai, Cognition, Exa, UPM, OneCoWork, Cursor, Exponential, HappyRobot, Embat, Prosper AI, Maisa y THEKER Robotics. Se esperan muchos más; la lista completa y actualizada siempre estará en hackspain.com/sponsors.",
        },
        name: "¿Cuáles son los patrocinadores de HackSpain / Hack Spain?",
      },
      {
        "@type": "Question",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Los premios aún no están definidos (por determinar). Se anunciarán en hackspain.com y en @hackspain26 (X e Instagram) conforme se acerque el evento.",
        },
        name: "¿Qué premios hay en HackSpain?",
      },
      {
        "@type": "Question",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Tracks originales con retos de las mejores startups de España, compute gratis para todos y un gran premio con jurado estrella. Detalles en hackspain.com/tracks.",
        },
        name: "¿Qué tracks tiene HackSpain?",
      },
      {
        "@type": "Question",
        acceptedAnswer: {
          "@type": "Answer",
          text: "250 participantes en 36 horas. Cifras oficiales en hackspain.com.",
        },
        name: "¿Cuántas personas participan?",
      },
      {
        "@type": "Question",
        acceptedAnswer: {
          "@type": "Answer",
          text: "En X (Twitter): @hackspain26. Instagram: @hackspain26 (instagram.com/hackspain26). Contacto: contact@hackspain.com.",
        },
        name: "¿Cómo seguir a HackSpain en redes?",
      },
      {
        "@type": "Question",
        acceptedAnswer: {
          "@type": "Answer",
          text: "En https://hackspain.com/llms.txt hay un resumen en Markdown con hechos, FAQ y URLs canónicas para sistemas de respuesta.",
        },
        name: "¿Dónde está la información para modelos de IA (llms.txt)?",
      },
      {
        "@type": "Question",
        acceptedAnswer: {
          "@type": "Answer",
          text: "https://hackspain.com",
        },
        name: "¿Cuál es el sitio web oficial?",
      },
    ],
  };
}
