import adriaBlancafortPhoto from "../assets/judges/adria-blancafort.jpg";
import alejandroBujanPhoto from "../assets/judges/alejandro-bujan.jpg";
import felixGilPhoto from "../assets/judges/felix-gil.jpg";
import ignacioAlfeiranPhoto from "../assets/judges/ignacio-alfeiran.jpg";
import ivanFernandezPhoto from "../assets/judges/ivan-fernandez.jpg";
import ivanLandabasoPhoto from "../assets/judges/ivan-landabaso.jpg";
import jaimeNovoaPhoto from "../assets/judges/jaime-novoa.jpg";
import juanVecinoPhoto from "../assets/judges/juan-vecino.jpg";
import mariaMunozPhoto from "../assets/judges/maria-munoz.jpg";
import martaSantiagoPhoto from "../assets/judges/marta-santiago.jpg";
import miguelGonzalezPhoto from "../assets/judges/miguel-gonzalez.jpg";
import nicolasDeOryPhoto from "../assets/judges/nicolas-de-ory.jpg";
import pabloMenendezPhoto from "../assets/judges/pablo-menendez.jpg";
import quiliPenaPhoto from "../assets/judges/quili-pena.jpg";

export interface Judge {
  company: string;
  /** Stable key, also used as the card anchor id. */
  id: string;
  name: string;
  /** Missing photo renders as an initials tile until one lands. */
  photoSrc?: string;
}

/**
 * The five VCs from the grand prize sponsor funds — they judge the final
 * award. Keep in sync with GRAND_PRIZE_SPONSORS in
 * components/sections/partner-logos.tsx.
 */
export const FINAL_AWARD_JUDGES: Judge[] = [
  {
    company: "Kfund",
    id: "jaime-novoa",
    name: "Jaime Novoa",
    photoSrc: jaimeNovoaPhoto.src,
  },
  {
    company: "JME Ventures",
    id: "ivan-landabaso",
    name: "Iván Landabaso",
    photoSrc: ivanLandabasoPhoto.src,
  },
  {
    company: "Acurio Ventures",
    id: "miguel-gonzalez",
    name: "Miguel González",
    photoSrc: miguelGonzalezPhoto.src,
  },
  {
    company: "Enzo Ventures",
    id: "ivan-fernandez",
    name: "Iván Fernández",
    photoSrc: ivanFernandezPhoto.src,
  },
  {
    company: "Kibo Ventures",
    id: "ignacio-alfeiran",
    name: "Ignacio Alfeirán",
    photoSrc: ignacioAlfeiranPhoto.src,
  },
];

/** The general judging panel, across all tracks. */
export const GENERAL_JUDGES: Judge[] = [
  {
    company: "HappyRobot",
    id: "quili-pena",
    name: "Quili Peña",
    photoSrc: quiliPenaPhoto.src,
  },
  {
    company: "Base10 Partners",
    id: "alejandro-bujan",
    name: "Alejandro Buján",
    photoSrc: alejandroBujanPhoto.src,
  },
  {
    company: "Harbor",
    id: "adria-blancafort",
    name: "Adrià Blancafort",
    photoSrc: adriaBlancafortPhoto.src,
  },
  {
    company: "Krea",
    id: "felix-gil",
    name: "Félix Gil",
    photoSrc: felixGilPhoto.src,
  },
  {
    company: "Harbor",
    id: "juan-vecino",
    name: "Juan Vecino",
    photoSrc: juanVecinoPhoto.src,
  },
  {
    company: "Caspian",
    id: "nicolas-de-ory",
    name: "Nicolás de Ory",
    photoSrc: nicolasDeOryPhoto.src,
  },
  {
    company: "Harbor",
    id: "pablo-menendez",
    name: "Pablo Menéndez",
    photoSrc: pabloMenendezPhoto.src,
  },
  {
    company: "Invoke.bio",
    id: "maria-munoz",
    name: "María Muñoz",
    photoSrc: mariaMunozPhoto.src,
  },
  {
    company: "Autonomous Alliance, Inc",
    id: "marta-santiago",
    name: "Marta Santiago",
    photoSrc: martaSantiagoPhoto.src,
  },
];
