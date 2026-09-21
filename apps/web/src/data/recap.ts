/** Add verified posts here, preserving the author's wording and permalink. */
export interface CommunityPost {
  author: string;
  handle: string;
  text: string;
  url: string;
}

// Selected from public X posts in Safari on 2026-09-21. Original wording.
export const communityPosts: CommunityPost[] = [
  {
    author: "Rubén Godoy",
    handle: "godoyruben_",
    text: "Hackspain ha sido realmente increíble! Mejor hack so far @JBoixCampos @TuringMachine42\n\nTy 🐐 @disamdev @mrloldev @GuliMoreno @dumenac",
    url: "https://x.com/godoyruben_/status/2101679598312296518",
  },
  {
    author: "Calambre",
    handle: "calambreDon",
    text: "ir a la hackspain ya vale la pena solo por la energia y la inspiracion para construir cosas con la que vuelves, es increible",
    url: "https://x.com/calambreDon/status/2101985401980264942",
  },
  {
    author: "Alvaro",
    handle: "alvarombt",
    text: "Gracias a toda la gente de HackSpain por este finde\n\nHe programado con gente buenísima, conocido a un montón de gente increíble y por fin he desvirtualizado a muchísima gente que llevaba tiempo siguiendo por aquí\n\nMe voy con muchas más ganas de construir cosas que con las que llegué, ojalá se repita el año que viene\n\nYou can just do things",
    url: "https://x.com/alvarombt/status/2101931822233825374",
  },
  {
    author: "Victoriano Izquierdo",
    handle: "victorianoi",
    text: "Ayer me pasé unas horas por HackSpain y jodé qué alegría ver tanto chavales jóvenes motivados y talentosos programando con IA todo un finde sin parar.\n\nCon la IA el nivel de ambición en un hackathon cobra un nuevo significado y hace esto más por el ecosistema tecnológico que tantísimas otras cosas. También mola buenas startups españolas patrocinando, con retos concretos con sentido.\n\nCómo se lo curra @GuliMoreno ! Merece una calle y algún momento un marquesado o algo!",
    url: "https://x.com/victorianoi/status/2101586815459168374",
  },
  {
    author: "Saul",
    handle: "saugardev",
    text: "back from @hackspain:\n\n- great hackathon and great org\n- met a top tier founder with huuuge alpha\n- met with top tier hackers\n\nnow back to the grind",
    url: "https://x.com/saugardev/status/2101967814592430348",
  },
  {
    author: "Mihura",
    handle: "XMihura",
    text: "tremendo ambiente en la finalísima de hackspain\n\nincreíble trabajo, mi sincera enhorabuena al equipo organizador, hacen falta más cosas así\n\n@GuliMoreno @disamdev @mrloldev @pdepablocom @dumenac & co\n\nGOGOGO!!!",
    url: "https://x.com/XMihura/status/2101694782883996142",
  },
  {
    author: "Adria Blancafort",
    handle: "adriablancafort",
    text: "Amazing what @GuliMoreno @dumenac @mrloldev @disamdev have done with @hackspain gathering the best young spanish technical talent!\nHonoured to have participated as a judge",
    url: "https://x.com/adriablancafort/status/2101741168568533480",
  },
  {
    author: "Rubén",
    handle: "rubenpombo_",
    text: "En mi equipo de hackspain no nos conocíamos ninguno previamente. Para mí, parte de la gracia de estos eventos es adaptarte y sacar algo adelante con gente que no sabes cómo es",
    url: "https://x.com/rubenpombo_/status/2102023234547855808",
  },
];

/** One entry per published album; no placeholder or guessed gallery URLs. */
export const photoAlbums: {
  title: string;
  description: string;
  url: string;
}[] = [];

export const communitySearchUrl =
  "https://x.com/search?q=HackSpain%20since%3A2026-09-18%20until%3A2026-09-23&f=live";
