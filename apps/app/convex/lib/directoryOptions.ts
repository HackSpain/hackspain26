/**
 * Curated vocabularies for the directory card. The connections graph draws
 * edges from exact matches on these values, so the form offers them as
 * dropdowns and chips instead of free text, and `canonical` folds whatever
 * arrives (English names, acronyms, accents, old free text) onto one
 * spelling. Lists are Spanish-first because that is what the card shows.
 */

export type Option = {
  value: string;
  /** Other spellings that mean the same thing: English names, acronyms, typos we expect. */
  aliases?: readonly string[];
};

export type OptionGroup = { label: string; options: readonly Option[] };

/** The literal a select uses for "none of these, let me type it". */
export const OTHER = "__other__";

const o = (value: string, ...aliases: string[]): Option => ({ aliases, value });

export const ROLE_OPTIONS: readonly Option[] = [
  o("AI Engineer", "ai", "ia", "ingeniero ia", "ingeniera ia", "llm engineer", "genai engineer"),
  o("ML Engineer", "ml", "machine learning engineer", "mlops"),
  o("Data Scientist", "data", "data science", "cientifico de datos", "cientifica de datos"),
  o("Data Engineer", "data engineering", "ingeniero de datos"),
  o("Backend Developer", "backend", "back-end", "back end", "backend engineer"),
  o("Frontend Developer", "frontend", "front-end", "front end", "frontend engineer"),
  o("Full-stack Developer", "full-stack", "fullstack", "full stack", "full-stack engineer"),
  o("Mobile Developer", "mobile", "movil", "ios developer", "android developer"),
  o("DevOps / Platform", "devops", "platform", "sre", "infra", "cloud engineer"),
  o("Product Designer", "diseno", "diseno de producto", "designer", "ux designer", "ui designer", "ux/ui"),
  o("Product Manager", "product", "pm", "producto"),
  o("Researcher", "research", "investigador", "investigadora", "phd"),
  o("Founder", "fundador", "fundadora", "ceo", "cto", "emprendedor", "emprendedora"),
  o("Estudiante", "student", "alumno", "alumna"),
  o("Otro", "other", "otra"),
];

export const CITY_OPTIONS: readonly Option[] = [
  o("A Coruña", "la coruna", "coruna", "corunna"),
  o("Albacete"),
  o("Alcalá de Henares", "alcala"),
  o("Alicante", "alacant"),
  o("Almería"),
  o("Badajoz"),
  o("Barcelona", "bcn"),
  o("Bilbao", "bilbo"),
  o("Burgos"),
  o("Cáceres"),
  o("Cádiz"),
  o("Castellón de la Plana", "castellon", "castello", "castello de la plana"),
  o("Córdoba", "cordova"),
  o("Donostia / San Sebastián", "donostia", "san sebastian"),
  o("Elche", "elx"),
  o("Getafe"),
  o("Gijón", "xixon"),
  o("Girona", "gerona"),
  o("Granada"),
  o("Huelva"),
  o("Jaén"),
  o("Las Palmas de Gran Canaria", "las palmas", "gran canaria"),
  o("León"),
  o("Lleida", "lerida"),
  o("Logroño"),
  o("Lugo"),
  o("Madrid"),
  o("Málaga", "malaga"),
  o("Murcia"),
  o("Ourense", "orense"),
  o("Oviedo", "uvieu"),
  o("Palma", "palma de mallorca", "mallorca"),
  o("Pamplona", "iruna", "irunea", "pamplona-iruna"),
  o("Sabadell"),
  o("Salamanca"),
  o("Santa Cruz de Tenerife", "tenerife"),
  o("Santander"),
  o("Santiago de Compostela", "santiago"),
  o("Sevilla", "seville"),
  o("Tarragona"),
  o("Terrassa"),
  o("Toledo"),
  o("Valencia", "valencia", "valència"),
  o("Valladolid"),
  o("Vigo"),
  o("Vitoria-Gasteiz", "vitoria", "gasteiz"),
  o("Zaragoza", "saragossa"),
];

export const UNIVERSITY_OPTIONS: readonly Option[] = [
  o("Universidad Politécnica de Madrid", "upm", "technical university of madrid", "politecnica de madrid"),
  o("Universidad Complutense de Madrid", "ucm", "complutense", "complutense university"),
  o("Universidad Autónoma de Madrid", "uam", "autonoma de madrid"),
  o("Universidad Carlos III de Madrid", "uc3m", "carlos iii", "carlos 3"),
  o("Universidad Rey Juan Carlos", "urjc"),
  o("Universidad de Alcalá", "uah", "alcala de henares"),
  o("Universidad Pontificia Comillas", "comillas", "icai", "icade"),
  o("IE University", "ie", "ie universidad"),
  o("Universidad CEU San Pablo", "ceu san pablo", "ceu madrid"),
  o("Universidad Europea de Madrid", "universidad europea", "uem"),
  o("Universidad Francisco de Vitoria", "ufv"),
  o("Universidad Nebrija", "nebrija"),
  o("U-tad", "utad"),
  o("Universitat Politècnica de Catalunya", "upc", "universidad politecnica de cataluna", "polytechnic university of catalonia", "barcelonatech"),
  o("Universitat de Barcelona", "ub", "universidad de barcelona", "university of barcelona"),
  o("Universitat Autònoma de Barcelona", "uab", "universidad autonoma de barcelona"),
  o("Universitat Pompeu Fabra", "upf", "pompeu fabra"),
  o("Universitat Ramon Llull", "url", "la salle", "esade", "iqs"),
  o("Universitat Oberta de Catalunya", "uoc"),
  o("Universitat de Girona", "udg", "universidad de girona"),
  o("Universitat Rovira i Virgili", "urv"),
  o("Universitat de Lleida", "udl", "universidad de lleida"),
  o("Universitat Politècnica de València", "upv", "universidad politecnica de valencia", "politecnica de valencia"),
  o("Universitat de València", "uv", "universidad de valencia", "university of valencia"),
  o("Universidad de Alicante", "ua", "universitat d'alacant"),
  o("Universidad Miguel Hernández", "umh"),
  o("Universitat Jaume I", "uji", "jaume i"),
  o("Universidad CEU Cardenal Herrera", "ceu cardenal herrera", "ceu valencia"),
  o("Universidad de Sevilla", "us", "university of seville"),
  o("Universidad Pablo de Olavide", "upo"),
  o("Universidad Loyola", "loyola andalucia"),
  o("Universidad de Málaga", "uma", "university of malaga"),
  o("Universidad de Granada", "ugr", "university of granada"),
  o("Universidad de Córdoba", "uco"),
  o("Universidad de Cádiz", "uca"),
  o("Universidad de Jaén", "ujaen"),
  o("Universidad de Almería", "ual"),
  o("Universidad de Huelva", "uhu"),
  o("Universidad del País Vasco", "upv/ehu", "ehu", "euskal herriko unibertsitatea", "university of the basque country"),
  o("Universidad de Deusto", "deusto"),
  o("Mondragon Unibertsitatea", "mondragon"),
  o("Universidad de Navarra", "unav", "university of navarra", "tecnun"),
  o("Universidad Pública de Navarra", "upna"),
  o("Universidad de Zaragoza", "unizar", "university of zaragoza"),
  o("Universidad de Murcia", "um", "university of murcia"),
  o("Universidad Politécnica de Cartagena", "upct"),
  o("Universidad de Valladolid", "uva", "university of valladolid"),
  o("Universidad de Salamanca", "usal", "university of salamanca"),
  o("Universidad de León", "unileon"),
  o("Universidad de Burgos", "ubu"),
  o("Universidad de Oviedo", "uniovi", "university of oviedo"),
  o("Universidad de Cantabria", "unican"),
  o("Universidad de La Rioja", "unirioja"),
  o("Universidade de Santiago de Compostela", "usc", "universidad de santiago de compostela"),
  o("Universidade da Coruña", "udc", "universidad de a coruna", "universidad de la coruna"),
  o("Universidade de Vigo", "uvigo", "universidad de vigo"),
  o("Universidad de Castilla-La Mancha", "uclm"),
  o("Universidad de Extremadura", "uex"),
  o("Universitat de les Illes Balears", "uib", "universidad de las islas baleares"),
  o("Universidad de La Laguna", "ull"),
  o("Universidad de Las Palmas de Gran Canaria", "ulpgc"),
  o("UNED", "universidad nacional de educacion a distancia"),
  o("UNIR", "universidad internacional de la rioja"),
  o("ESIC", "esic business school"),
  o("42", "42 madrid", "42 barcelona", "42 malaga", "42 urduliz"),
];

export const DEGREE_OPTIONS: readonly Option[] = [
  o("Ingeniería Informática", "informatica", "computer science", "computer engineering", "cs", "grado en ingenieria informatica", "enginyeria informatica"),
  o("Ingeniería del Software", "software engineering", "ingenieria de software"),
  o("Ciencia de Datos", "data science", "ciencia e ingenieria de datos", "ingenieria de datos"),
  o("Inteligencia Artificial", "ia", "ai", "artificial intelligence", "grado en inteligencia artificial"),
  o("Matemáticas", "mathematics", "maths", "math", "matematicas"),
  o("Física", "physics", "fisica"),
  o("Ingeniería de Telecomunicaciones", "telecomunicaciones", "teleco", "telecommunications engineering"),
  o("Ingeniería Industrial", "industrial engineering", "industriales"),
  o("Ingeniería Electrónica", "electronica", "electronics"),
  o("Ingeniería Biomédica", "biomedica", "biomedical engineering"),
  o("Bioinformática", "bioinformatics"),
  o("Diseño", "design", "diseno grafico", "diseno de producto"),
  o("Administración y Dirección de Empresas", "ade", "business", "business administration"),
  o("Economía", "economics", "economia"),
  o("Derecho", "law"),
  o("Máster / Posgrado", "master", "posgrado", "msc", "phd", "doctorado"),
  o("Otra", "other", "otro"),
];

export const SKILL_GROUPS: readonly OptionGroup[] = [
  {
    label: "Lenguajes",
    options: [
      o("Python", "py"),
      o("TypeScript", "ts"),
      o("JavaScript", "js"),
      o("Go", "golang"),
      o("Rust"),
      o("Java"),
      o("Kotlin"),
      o("Swift"),
      o("C++", "cpp"),
      o("C#", "csharp", "c sharp", ".net", "dotnet"),
      o("SQL"),
    ],
  },
  {
    label: "Web y móvil",
    options: [
      o("React", "reactjs", "react.js"),
      o("Next.js", "nextjs", "next"),
      o("Vue", "vuejs", "vue.js", "nuxt"),
      o("Svelte", "sveltekit"),
      o("Angular"),
      o("Node.js", "node", "nodejs"),
      o("React Native"),
      o("Flutter", "dart"),
      o("iOS", "swiftui"),
      o("Android", "jetpack compose"),
      o("Tailwind", "tailwindcss", "tailwind css"),
    ],
  },
  {
    label: "IA y ML",
    options: [
      o("LLMs", "llm", "large language models", "gpt", "claude", "openai"),
      o("Agentes IA", "agents", "ai agents", "agentes", "agentic", "langchain", "langgraph"),
      o("RAG", "retrieval", "vector search", "embeddings"),
      o("Prompt engineering", "prompting", "prompts"),
      o("Machine Learning", "ml", "aprendizaje automatico", "scikit-learn", "sklearn"),
      o("Deep Learning", "dl", "neural networks", "redes neuronales"),
      o("PyTorch", "torch"),
      o("TensorFlow", "keras"),
      o("Computer Vision", "cv", "vision por computador", "vision artificial", "opencv", "yolo"),
      o("NLP", "procesamiento del lenguaje", "natural language processing"),
      o("Fine-tuning", "finetuning", "lora"),
      o("Voz y audio", "speech", "audio", "tts", "asr", "whisper"),
      o("IA generativa", "genai", "generative ai", "stable diffusion", "imagen generativa"),
    ],
  },
  {
    label: "Datos",
    options: [
      o("Data engineering", "etl", "pipelines", "airflow"),
      o("Data science", "ciencia de datos", "pandas", "estadistica"),
      o("Analítica", "analytics", "bi", "power bi", "tableau"),
      o("PostgreSQL", "postgres"),
      o("MongoDB", "mongo"),
      o("Spark", "pyspark", "big data"),
    ],
  },
  {
    label: "Infra y cloud",
    options: [
      o("Docker", "containers"),
      o("Kubernetes", "k8s"),
      o("AWS", "amazon web services"),
      o("GCP", "google cloud"),
      o("Azure"),
      o("DevOps", "ci/cd", "cicd", "github actions"),
      o("Serverless", "lambda", "cloudflare workers", "vercel"),
      o("Convex"),
      o("Supabase"),
      o("Firebase"),
    ],
  },
  {
    label: "Producto y diseño",
    options: [
      o("UX", "ux design", "diseno ux", "user experience", "ux research"),
      o("UI", "ui design", "diseno ui", "diseno de interfaces"),
      o("Figma"),
      o("Product management", "product", "producto", "gestion de producto"),
      o("Growth", "marketing", "growth hacking"),
      o("Pitching", "pitch", "storytelling"),
    ],
  },
  {
    label: "Otros",
    options: [
      o("Robótica", "robotics", "robots"),
      o("ROS 2", "ros", "ros2"),
      o("Hardware", "arduino", "raspberry pi", "iot", "electronica"),
      o("Ciberseguridad", "seguridad", "security", "cybersecurity", "pentesting"),
      o("Blockchain", "web3", "solidity", "crypto"),
      o("Game dev", "gamedev", "videojuegos", "unity", "unreal", "godot"),
      o("AR / VR", "ar", "vr", "xr", "realidad virtual", "realidad aumentada"),
    ],
  },
];

export const SKILL_OPTIONS: readonly Option[] = SKILL_GROUPS.flatMap(
  (group) => group.options
);

export const INTEREST_OPTIONS: readonly Option[] = [
  o("Agentes IA", "agents", "ai agents", "agentes"),
  o("IA generativa", "genai", "generative ai"),
  o("Open source", "open-source", "codigo abierto", "oss"),
  o("Herramientas dev", "developer tools", "devtools", "dev tools"),
  o("Educación", "education", "edtech", "educacion"),
  o("Salud", "health", "healthtech", "medicina", "biotech"),
  o("Fintech", "finanzas", "finance", "pagos"),
  o("Sostenibilidad", "sustainability", "clima", "climate", "energia", "medio ambiente"),
  o("Robótica", "robotics", "robots"),
  o("Hardware", "iot", "electronica"),
  o("Videojuegos", "games", "gaming", "game dev"),
  o("Startups", "emprendimiento", "startup"),
  o("Diseño accesible", "accesibilidad", "accessibility", "a11y"),
  o("Música", "music", "audio"),
  o("Ciencia", "science", "investigacion", "research"),
  o("Ciberseguridad", "seguridad", "security", "privacidad"),
  o("Movilidad", "mobility", "transporte", "smart cities"),
  o("Legaltech", "legal", "derecho"),
  o("Sector público", "govtech", "gobierno", "administracion publica"),
  o("Impacto social", "social impact", "ong", "social"),
  o("Creatividad", "arte", "art", "creative", "cultura"),
  o("Deporte", "sports", "fitness"),
  o("Turismo", "travel", "viajes"),
  o("Agro y alimentación", "agro", "agritech", "foodtech", "alimentacion"),
  o("Espacio", "space", "aeroespacial"),
];

/** Lowercase, no accents, single spaces, no trailing punctuation: the matching key. */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replaceAll(/[\s_]+/g, " ")
    .replaceAll(/[.,;:!?'"()]+$/g, "")
    .trim();
}

const indexes = new WeakMap<readonly Option[], Map<string, string>>();

function indexOf(options: readonly Option[]): Map<string, string> {
  let index = indexes.get(options);
  if (!index) {
    index = new Map();
    for (const option of options) {
      index.set(fold(option.value), option.value);
      for (const alias of option.aliases ?? []) {
        index.set(fold(alias), option.value);
      }
    }
    indexes.set(options, index);
  }
  return index;
}

/** The curated spelling for `input`, or undefined when it matches nothing. */
export function canonical(
  options: readonly Option[],
  input: string | undefined
): string | undefined {
  if (!input) {
    return undefined;
  }
  return indexOf(options).get(fold(input));
}

/** `canonical`, falling back to the cleaned free text (for "Otra"). */
export function canonicalOrText(
  options: readonly Option[],
  input: string | undefined
): string | undefined {
  const text = input?.trim().replaceAll(/\s+/g, " ");
  if (!text) {
    return undefined;
  }
  return canonical(options, text) ?? text;
}

/** Curated spellings for each tag, deduplicated, order kept. */
export function canonicalTags(
  options: readonly Option[],
  tags: readonly string[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const value = canonicalOrText(options, tag);
    if (!value) {
      continue;
    }
    const key = fold(value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function isOption(options: readonly Option[], value: string | undefined): boolean {
  return value !== undefined && options.some((option) => option.value === value);
}
