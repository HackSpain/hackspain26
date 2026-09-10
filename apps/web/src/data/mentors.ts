import carlosSerranoPhoto from "../assets/mentors/carlos-serrano.jpg";
import davidGomesPhoto from "../assets/mentors/david-gomes.jpg";
import guillermoGarciaCoboPhoto from "../assets/mentors/guillermo-garcia-cobo.jpg";
import joanRodriguezPhoto from "../assets/mentors/joan-rodriguez.jpg";
import kintxoCortesPhoto from "../assets/mentors/kintxo-cortes.jpg";
import gigsLogo from "../assets/mentors/logos/gigs.svg";
import nvidiaLogo from "../assets/mentors/logos/nvidia.svg";
import quiverLogo from "../assets/mentors/logos/quiver.svg";
import spacexLogo from "../assets/mentors/logos/spacex.svg";
import maexAmentPhoto from "../assets/mentors/maex-ament.jpg";
import markVillacampaPhoto from "../assets/mentors/mark-villacampa.jpg";
import miguelCarranzaPhoto from "../assets/mentors/miguel-carranza.jpg";
import mihuraPhoto from "../assets/mentors/mihura.jpg";
import {
  causaPrimaLogo,
  embatLogo,
  revenuecatLogo,
} from "../components/theme/assets";

export interface Mentor {
  /** Company the logo belongs to, used for the logo alt text. */
  company?: string;
  /** Logo silhouette shown on the card (rendered via CSS mask, ink tint). */
  companyLogoSrc?: string;
  /** One or two short sentences on why this mentor is worth cornering. */
  description: string;
  /** Stable key, also used as the card anchor id. */
  id: string;
  /** Tailwind height class override — squarer marks need more height. */
  logoHeight?: string;
  name: string;
  photoSrc: string;
  /** One-line role/track record, shown under the name. */
  role: string;
}

/** The RevenueCat lockup is squarer than the other wordmarks, so it reads
 * small at the shared height. */
const REVENUECAT_LOGO_HEIGHT = "h-[clamp(1.25rem,2.8vw,1.6rem)]";

/**
 * The confirmed fundadores y mentores, shown as cards in the mentors overlay
 * behind the "Ver mentores" button. The list order is the display order —
 * roughly by track record — so new names slot in wherever they belong.
 * More are still being confirmed; keep appending as they land.
 */
export const MENTORS: Mentor[] = [
  {
    company: "Causa Prima",
    companyLogoSrc: causaPrimaLogo.src,
    description:
      "Cofundó Taulia (adquirida por SAP) y ha invertido en más de 150 startups.",
    id: "maex-ament",
    name: "Maex Ament",
    photoSrc: maexAmentPhoto.src,
    role: "Fundador de Causa Prima",
  },
  {
    company: "RevenueCat",
    companyLogoSrc: revenuecatLogo.src,
    description:
      "La infraestructura de suscripciones detrás de decenas de miles de apps.",
    id: "miguel-carranza",
    logoHeight: REVENUECAT_LOGO_HEIGHT,
    name: "Miguel Carranza",
    photoSrc: miguelCarranzaPhoto.src,
    role: "Fundador y CTO de RevenueCat",
  },
  {
    company: "Quiver AI",
    companyLogoSrc: quiverLogo.src,
    description:
      "Levantó 8,3M$ de a16z para construir modelos de IA de diseño vectorial.",
    id: "joan-rodriguez",
    name: "Joan Rodríguez",
    photoSrc: joanRodriguezPhoto.src,
    role: "Fundador de Quiver AI",
  },
  {
    company: "Gigs",
    companyLogoSrc: gigsLogo.src,
    description: "Llevó Airbnb, Shopify y Trade Republic a nuevos mercados.",
    id: "kintxo-cortes",
    name: "Kintxo Cortés",
    photoSrc: kintxoCortesPhoto.src,
    role: "Gigs · ex GM en Trade Republic y Shopify",
  },
  {
    company: "Embat",
    companyLogoSrc: embatLogo.src,
    description:
      "Ex JP Morgan; ahora lleva la tesorería de cientos de empresas a tiempo real con Embat.",
    id: "carlos-serrano",
    name: "Carlos Serrano",
    photoSrc: carlosSerranoPhoto.src,
    role: "Cofundador de Embat",
  },
  {
    company: "SpaceX",
    companyLogoSrc: spacexLogo.src,
    description: "Ingeniero en SpaceX; antes en Cursor y Neon.",
    id: "david-gomes",
    name: "David Gomes",
    photoSrc: davidGomesPhoto.src,
    role: "Software Engineer en SpaceX",
  },
  {
    company: "NVIDIA",
    companyLogoSrc: nvidiaLogo.src,
    description:
      "Investigó conducción autónoma en NVIDIA; ahora construye en stealth.",
    id: "guillermo-garcia-cobo",
    name: "Guillermo García Cobo",
    photoSrc: guillermoGarciaCoboPhoto.src,
    role: "Ex investigador en NVIDIA",
  },
  {
    company: "RevenueCat",
    companyLogoSrc: revenuecatLogo.src,
    description: "Construye los SDKs de RevenueCat; veterano del open source.",
    id: "mark-villacampa",
    logoHeight: REVENUECAT_LOGO_HEIGHT,
    name: "Mark Villacampa",
    photoSrc: markVillacampaPhoto.src,
    role: "Software Engineer en RevenueCat",
  },
  {
    description: "Interiorista y creador del mejor lector de PDFs del mundo.",
    id: "mihura",
    name: "Mihura",
    photoSrc: mihuraPhoto.src,
    role: "@XMihura",
  },
];
