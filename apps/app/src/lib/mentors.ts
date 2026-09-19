/**
 * Fundadores y mentores from the landing (`apps/web/src/data/mentors.ts`).
 * Names, roles and companies stay in sync with that list; photos live in
 * `/public/mentors`. Edit PRESENT_MENTOR_IDS to control who appears on TV.
 */
export const MENTORS = [
  {
    id: "maex-ament",
    name: "Maex Ament",
    role: "Fundador de Causa Prima",
    company: "Causa Prima",
    photoSrc: "/mentors/maex-ament.jpg",
  },
  {
    id: "miguel-carranza",
    name: "Miguel Carranza",
    role: "Fundador y CTO de RevenueCat",
    company: "RevenueCat",
    photoSrc: "/mentors/miguel-carranza.jpg",
  },
  {
    id: "joan-rodriguez",
    name: "Joan Rodríguez",
    role: "Fundador de Quiver AI",
    company: "Quiver AI",
    photoSrc: "/mentors/joan-rodriguez.jpg",
  },
  {
    id: "kintxo-cortes",
    name: "Kintxo Cortés",
    role: "Gigs · ex GM en Trade Republic y Shopify",
    company: "Gigs",
    photoSrc: "/mentors/kintxo-cortes.jpg",
  },
  {
    id: "david-gomes",
    name: "David Gomes",
    role: "Software Engineer en SpaceX",
    company: "SpaceX",
    photoSrc: "/mentors/david-gomes.jpg",
  },
  {
    id: "guillermo-garcia-cobo",
    name: "Guillermo García Cobo",
    role: "Ex investigador en NVIDIA",
    company: "NVIDIA",
    photoSrc: "/mentors/guillermo-garcia-cobo.jpg",
  },
  {
    id: "mark-villacampa",
    name: "Mark Villacampa",
    role: "Software Engineer en RevenueCat",
    company: "RevenueCat",
    photoSrc: "/mentors/mark-villacampa.jpg",
  },
] as const;

export type MentorId = (typeof MENTORS)[number]["id"];
export type Mentor = (typeof MENTORS)[number];

/** Who is in the venue right now. Comment out ids to hide a card. */
export const PRESENT_MENTOR_IDS = [
  "maex-ament",
  "miguel-carranza",
  "joan-rodriguez",
  "kintxo-cortes",
  "david-gomes",
  "guillermo-garcia-cobo",
  "mark-villacampa",
] as const satisfies readonly MentorId[];

export function presentMentors(): Mentor[] {
  const present = new Set<string>(PRESENT_MENTOR_IDS);
  return MENTORS.filter((mentor) => present.has(mentor.id));
}
