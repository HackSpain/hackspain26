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
      "HackSpain 2026 reunió a 250 jóvenes builders en un hackathon de 36 horas en Madrid. Explora la edición, sus cinco tracks, mentores y comunidad.",
    ogImageAlt: "HackSpain 2026 — MADRID '26",
    title: "HackSpain 2026: hackathon en Madrid, tracks y comunidad",
  },
  {
    description: "Vídeo y publicaciones de quienes participaron en HackSpain 2026, el hackathon celebrado del 18 al 20 de septiembre en Madrid.",
    ogImageAlt: "HackSpain 2026 — vuestras historias",
    title: "Comunidad y vídeo de HackSpain 2026",
  },
  {
    description:
      "36 horas. 250 de los mejores builders menores de 30. HackSpain 2026 fue el punto de encuentro de los jóvenes que van a posicionar a España como líder de talento tech joven.",
    ogImageAlt: "HackSpain 2026 — España tiene talento",
    title: "Misión de HackSpain: jóvenes builders en España",
  },
  {
    description:
      "Compute gratis para todos. Cinco tracks con retos de las mejores startups de España: Maisa, HappyRobot, Prosper AI, Embat y THEKER Robotics.",
    ogImageAlt: "HackSpain 2026 — tracks originales",
    title: "Tracks y startups de HackSpain 2026",
  },
  {
    description:
      "Infraestructura para construir sin límites en HackSpain 2026, con Convex, Vercel, QuiverAI, Cloudflare, Tinybird, Cognition, Exa, fal.ai, Cursor y Helmcode.",
    ogImageAlt: "HackSpain 2026 — infraestructura para construir",
    title: "Infraestructura de HackSpain 2026",
  },
  {
    description:
      "El gran premio de 5.000 € y los jurados de HackSpain 2026, con JME Ventures, Kfund, Kibo Ventures, Enzo Ventures y Acurio Ventures.",
    ogImageAlt: "HackSpain 2026 — 1 gran premio de 5.000 €",
    title: "Gran premio y jurado de HackSpain 2026",
  },
  {
    description:
      "Conoce a los fundadores, ingenieros y mentores que acompañaron a los equipos de HackSpain 2026 en Madrid.",
    ogImageAlt: "HackSpain 2026 — comida, bebida y charlas",
    title: "Fundadores y mentores de HackSpain 2026",
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
    "HackSpain 2026 se celebró del 18 al 20 de septiembre en UPM–ETSIT, Madrid. Revive la edición y sigue a la comunidad.",
  ogImageAlt: "HackSpain 2026 — gracias por hacerlo posible",
  title: "Inscripción cerrada | HackSpain 2026",
};

export function seoForSectionIndex(i: number): PageSeo {
  const index = Math.max(0, Math.min(PAGES.length - 1, i));
  if (index === SIGNUP_SECTION_INDEX && areSignupsClosed()) {
    return SIGNUP_CLOSED_SEO;
  }
  return PAGES[index] ?? PAGES[0];
}

export function signupSeo(): PageSeo {
  if (areSignupsClosed()) {
    return SIGNUP_CLOSED_SEO;
  }
  return {
    description:
      "Completa tu solicitud para HackSpain 2026. Revisamos cada candidatura antes de confirmar la plaza.",
    ogImageAlt: "HackSpain 2026 — apúntate al hackathon",
    title: "Apúntate al hackathon | HackSpain 2026",
  };
}

export function ambassadorSeo(): PageSeo {
  return {
    description:
      "Así fue el programa de embajadores de HackSpain 2026, que dio a conocer el hackathon en campus y comunidades tecnológicas de España.",
    ogImageAlt: "HackSpain 2026 — programa de embajadores",
    title: "Programa de embajadores de HackSpain 2026",
  };
}

export function privacySeo(): PageSeo {
  return {
    description:
      "Política de privacidad de la Asociación Exponential Fellowship: responsable del tratamiento, comunicación a patrocinadores, RGPD, LOPDGDD, derechos y tratamiento del registro (incl. análisis automatizado e IA).",
    ogImageAlt: "HackSpain — política de privacidad",
    title: "Política de privacidad — HACKSPAIN 2026",
  };
}

export function conductSeo(): PageSeo {
  return {
    description:
      "Normas de HackSpain: el proyecto se construye en el evento, se actúa de buena fe, se respetan los demás equipos, las personas y los plazos.",
    ogImageAlt: "HackSpain — código de conducta",
    title: "Código de conducta — HACKSPAIN 2026",
  };
}

export function brandSeo(): PageSeo {
  return {
    description:
      "Descarga los logos oficiales de HackSpain y consulta las pautas de color, tipografía, espaciado y uso de la marca.",
    ogImageAlt: "HackSpain — guía de marca y recursos oficiales",
    title: "Marca y recursos — HackSpain",
  };
}

export function jsonLdOrganization() {
  return {
    "@context": "https://schema.org",
    "@id": `${SITE}/#organization`,
    "@type": "Organization",
    address: {
      "@type": "PostalAddress",
      addressCountry: "ES",
      addressLocality: "Madrid",
      postalCode: "28003",
      streetAddress: "C/ Santa Engracia 148",
    },
    alternateName: ["HackSpain", "Hack Spain", "hack spain"],
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
    name: "Asociación Exponential Fellowship",
    taxID: "G19717818",
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

export function jsonLdWebPage(
  pageUrl: string,
  seo: Pick<PageSeo, "title" | "description">,
  aboutEvent: boolean
) {
  return {
    "@context": "https://schema.org",
    "@id": `${pageUrl}#webpage`,
    "@type": "WebPage",
    ...(aboutEvent ? { about: { "@id": `${SITE}/#event` } } : {}),
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
    endDate: "2026-09-20T15:00:00+02:00",
    image: `${SITE}${SOCIAL_SHARE_IMAGE.path}`,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
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
