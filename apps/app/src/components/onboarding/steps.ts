import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

export type Me = NonNullable<FunctionReturnType<typeof api.users.me>>;

export type StepId = "details" | "identity" | "links" | "directory";

export const STEP_COPY: Record<StepId, { title: string; description: string }> = {
  details: {
    title: "Confirma tus datos",
    description:
      "Un teléfono de contacto para el evento y las condiciones de participación.",
  },
  identity: {
    title: "Tu nombre y tu foto",
    description: "Así te ven los demás en el feed y en el directorio.",
  },
  links: {
    title: "GitHub y X",
    description:
      "Para encontrarte en tu equipo y ligar tu proyecto. Si no tienes cuenta, sáltalo.",
  },
  directory: {
    title: "Tu ficha de participante",
    description:
      "El grafo de participantes conecta a la gente por ciudad, universidad o empresa, habilidades e intereses.",
  },
};

/**
 * Which steps this account still needs, in order. Phone and terms only for
 * an accepted signup (their functions are `accepted*`); the rest follows
 * `users.me.profileMissing` (convex/lib/profile.ts) plus the optional links.
 */
export function planSteps(me: Me): StepId[] {
  const steps: StepId[] = [];
  if (me.accepted && !me.onboardingComplete) {
    steps.push("details");
  }
  if (
    me.profileMissing.includes("name") ||
    me.profileMissing.includes("photo")
  ) {
    steps.push("identity");
  }
  if (!me.githubLinked || !me.twitterHandle) {
    steps.push("links");
  }
  if (me.profileMissing.includes("directory")) {
    steps.push("directory");
  }
  return steps;
}
