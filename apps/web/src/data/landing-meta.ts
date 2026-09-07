import { areSignupsClosed } from "./signup-deadline";

const SITE = "https://hackspain.com";

/** Official profiles for CTAs (footer, signup end screen, etc.). */
export const HACKSPAIN_SOCIAL_URLS = {
  x: "https://x.com/hackspain26",
  instagram: "https://www.instagram.com/hackspain26/",
  github: "https://github.com/samuelcorsan/hackspain.com",
} as const;

/** Open Graph / Twitter / JSON-LD primary share image (`public/og-landing.png`). */
export const SOCIAL_SHARE_IMAGE = {
  path: "/og-landing.png",
  width: 1200,
  height: 630,
} as const;
export interface PageSeo {
  description: string;
  ogImageAlt: string;
  title: string;
}

const PAGES: PageSeo[] = [
  {
    title: "HackSpain 2026 — MADRID '26",
    description:
      "El hackathon para unir a los mejores builders jóvenes de España. 18 al 20 de Septiembre, UPM - ETSIT. 250 participantes.",
    ogImageAlt: "HackSpain 2026 — MADRID '26",
  },
  {
    title: "España tiene talento. Nosotros vamos a juntarlo. | HackSpain 2026",
    description:
      "36 horas. 250 de los mejores builders menores de 30. HackSpain 2026 es el punto de encuentro de los jóvenes que van a posicionar a España como líder de talento tech joven.",
    ogImageAlt: "HackSpain 2026 — España tiene talento",
  },
  {
    title: "Tracks originales | HackSpain 2026",
    description:
      "Compute gratis para todos. Cinco tracks con retos de las mejores startups de España: Maisa, HappyRobot, Prosper AI, Embat y THEKER Robotics.",
    ogImageAlt: "HackSpain 2026 — tracks originales",
  },
  {
    title: "1 gran premio de 5.000 € | HackSpain 2026",
    description:
      "Un único gran premio de 5.000 € para el equipo ganador de HackSpain 2026, con el patrocinio de JME Ventures, Kfund, Kibo Ventures, Enzo Ventures y Acurio Ventures.",
    ogImageAlt: "HackSpain 2026 — 1 gran premio de 5.000 €",
  },
  {
    title: "Comida, bebida y charlas | HackSpain 2026",
    description:
      "Conecta con los mejores fundadores y mentores del ecosistema de España. Con RevenueCat, Reveni, Karumi, Invopop y Causa Prima.",
    ogImageAlt: "HackSpain 2026 — comida, bebida y charlas",
  },
  {
    title: "Inscripción abierta | HackSpain 2026",
    description: "Inscripción abierta para HackSpain 2026. Envía tu solicitud.",
    ogImageAlt: "HackSpain 2026 — inscripción abierta",
  },
];

/** The signup section is the last one; its copy depends on the deadline. */
const SIGNUP_SECTION_INDEX = PAGES.length - 1;

const SIGNUP_CLOSED_SEO: PageSeo = {
  title: "Empieza el 18 de septiembre | HackSpain 2026",
  description:
    "HackSpain 2026 empieza el 18 de septiembre a las 17:00 en UPM - ETSIT, Madrid. Las plazas están cubiertas.",
  ogImageAlt: "HackSpain 2026 — empieza el 18 de septiembre",
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
    title: "Apúntate al hackathon | HackSpain 2026",
    description:
      "Completa tu solicitud para HackSpain 2026. Revisamos cada candidatura antes de confirmar la plaza.",
    ogImageAlt: "HackSpain 2026 — apúntate al hackathon",
  };
}

export const AMBASSADOR_KEYWORDS =
  "embajador HackSpain, campus hackathon España, universidad hackathon Madrid 2026, embajador estudiantil hackathon";

export function ambassadorSeo(): PageSeo {
  return {
    title: "Sé la cara de HackSpain en tu campus | HackSpain 2026",
    description:
      "Junta builders, mueve el boca a boca y empuja hacia el registro — te mantenemos al día con fechas y enlaces oficiales, te aclaramos dudas si las tienes, y tienes contacto directo con el equipo para Madrid 2026.",
    ogImageAlt: "HackSpain 2026 — programa de embajadores",
  };
}

export const PRIVACY_KEYWORDS =
  "privacidad HackSpain, comunicación datos patrocinadores, RGPD, datos personales, registro hackathon, LOPDGDD";

export function privacySeo(): PageSeo {
  return {
    title: "Política de privacidad — HACKSPAIN 2026",
    description:
      "Política de privacidad de la Asociación HackSpain: responsable del tratamiento, comunicación a patrocinadores, RGPD, LOPDGDD, derechos y tratamiento del registro (incl. análisis automatizado e IA).",
    ogImageAlt: "HackSpain — política de privacidad",
  };
}

export const BRAND_KEYWORDS =
  "marca HackSpain, logo HackSpain, identidad visual HackSpain, recursos de prensa HackSpain, brand assets HackSpain";

export function brandSeo(): PageSeo {
  return {
    title: "Marca y recursos — HackSpain",
    description:
      "Descarga los logos oficiales de HackSpain y consulta las pautas de color, tipografía, espaciado y uso de la marca.",
    ogImageAlt: "HackSpain — guía de marca y recursos oficiales",
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
    "@type": "Organization",
    "@id": `${SITE}/#organization`,
    name: "HackSpain",
    alternateName: ["Hack Spain", "hack spain", "Hack Spain hackathon"],
    url: SITE,
    logo: `${SITE}/hs-icon.png`,
    description:
      "El hackathon para unir a los mejores builders jóvenes de España.",
    sameAs: [
      HACKSPAIN_SOCIAL_URLS.x,
      HACKSPAIN_SOCIAL_URLS.instagram,
      HACKSPAIN_SOCIAL_URLS.github,
    ],
    knowsAbout: [
      "hackathon España",
      "Madrid tech events",
      "young coders Europe",
      "machine learning hackathon",
    ],
    inLanguage: "es",
  };
}

export function jsonLdWebSite() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE}/#website`,
    name: "HackSpain",
    alternateName: ["Hack Spain", "hack spain"],
    url: SITE,
    description:
      "HackSpain 2026 — MADRID '26. 18 al 20 de Septiembre, UPM - ETSIT. Contenido en español.",
    inLanguage: "es",
    publisher: { "@id": `${SITE}/#organization` },
  };
}

export function jsonLdWebPage(sectionIndex: number, pageUrl: string) {
  const seo = seoForSectionIndex(sectionIndex);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: seo.title,
    description: seo.description,
    inLanguage: "es",
    isPartOf: { "@id": `${SITE}/#website` },
    about: { "@id": `${SITE}/#event` },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: `${SITE}${SOCIAL_SHARE_IMAGE.path}`,
      width: SOCIAL_SHARE_IMAGE.width,
      height: SOCIAL_SHARE_IMAGE.height,
    },
  };
}

export function jsonLdEvent() {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${SITE}/#event`,
    name: "HackSpain 2026",
    alternateName: [
      "Hack Spain 2026",
      "hack spain hackathon",
      "HackSpain hackathon Madrid",
      "hackathon España",
      "hackathon Spain",
    ],
    description:
      "HackSpain 2026: 36 horas, 250 builders menores de 30. 18 al 20 de Septiembre en UPM - ETSIT, Madrid.",
    inLanguage: "es",
    keywords:
      "hackathon Madrid, hackathon España, HackSpain, builders jóvenes, tracks originales, compute gratis",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    startDate: "2026-09-18T17:00:00+02:00",
    endDate: "2026-09-20",
    organizer: { "@id": `${SITE}/#organization` },
    location: {
      "@type": "Place",
      name: "UPM - ETSIT, Madrid, España",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Madrid",
        addressCountry: "ES",
      },
    },
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
        name: '¿Qué es HackSpain o "Hack Spain"?',
        acceptedAnswer: {
          "@type": "Answer",
          text: "HackSpain es el hackathon para unir a los mejores builders jóvenes de España. Edición 2026: 36 horas, 250 participantes, 18 al 20 de Septiembre en UPM - ETSIT (Madrid). Web oficial: hackspain.com.",
        },
      },
      {
        "@type": "Question",
        name: "¿Cuándo es HackSpain 2026 y dónde se celebra?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "18 al 20 de Septiembre de 2026 en UPM - ETSIT, Madrid, España. Más detalles en hackspain.com.",
        },
      },
      {
        "@type": "Question",
        name: "¿Cómo me apunto o me registro en HackSpain?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Completa tu solicitud en hackspain.com/signup. Revisamos cada candidatura antes de confirmar la plaza. También puedes seguir @hackspain26 en X e Instagram o escribir a contact@hackspain.com.",
        },
      },
      {
        "@type": "Question",
        name: "¿Cómo puedo ser embajador o embajadora de HackSpain?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Lee el programa en hackspain.com/ambassador. Puedes solicitar plaza y marcar que quieres participar como embajador o embajadora en hackspain.com/signup.",
        },
      },
      {
        "@type": "Question",
        name: "¿Cuáles son los patrocinadores de HackSpain / Hack Spain?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Los patrocinadores actuales son Google, K Fund, fal.ai, Cognition, Exa, UPM, OneCoWork, Cursor, Exponential, HappyRobot, Embat, Prosper AI, Maisa y THEKER Robotics. Se esperan muchos más; la lista completa y actualizada siempre estará en hackspain.com/sponsors.",
        },
      },
      {
        "@type": "Question",
        name: "¿Qué premios hay en HackSpain?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Los premios aún no están definidos (por determinar). Se anunciarán en hackspain.com y en @hackspain26 (X e Instagram) conforme se acerque el evento.",
        },
      },
      {
        "@type": "Question",
        name: "¿Qué tracks tiene HackSpain?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Tracks originales con retos de las mejores startups de España, compute gratis para todos y un gran premio con jurado estrella. Detalles en hackspain.com/tracks.",
        },
      },
      {
        "@type": "Question",
        name: "¿Cuántas personas participan?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "250 participantes en 36 horas. Cifras oficiales en hackspain.com.",
        },
      },
      {
        "@type": "Question",
        name: "¿Cómo seguir a HackSpain en redes?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "En X (Twitter): @hackspain26. Instagram: @hackspain26 (instagram.com/hackspain26). Contacto: contact@hackspain.com.",
        },
      },
      {
        "@type": "Question",
        name: "¿Dónde está la información para modelos de IA (llms.txt)?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "En https://hackspain.com/llms.txt hay un resumen en Markdown con hechos, FAQ y URLs canónicas para sistemas de respuesta.",
        },
      },
      {
        "@type": "Question",
        name: "¿Cuál es el sitio web oficial?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "https://hackspain.com",
        },
      },
    ],
  };
}
