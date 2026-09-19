import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

export type Me = NonNullable<FunctionReturnType<typeof api.users.me>>;

export type StepId = "details" | "identity" | "links" | "directory" | "skills";

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
      "Rol, ciudad y universidad o empresa: por eso agrupa el grafo a la gente.",
  },
  skills: {
    title: "Con qué construyes",
    description: "Habilidades, intereses y una frase sobre ti.",
  },
};

export type StepPlan = {
  steps: StepId[];
  /** Where the wizard opens: the first step that is still pending. */
  start: number;
};

/**
 * The wizard's steps, in order, and where to open it. Phone and terms only
 * for an accepted signup (their functions are `accepted*`). That step and
 * name + photo stay in the plan once done, so "Atrás" can reach them for a
 * review; the rest follows `users.me.profileMissing` (convex/lib/profile.ts)
 * plus the optional links.
 */
export function planSteps(me: Me): StepPlan {
  const plan: { id: StepId; pending: boolean }[] = [];
  if (me.accepted) {
    plan.push({ id: "details", pending: !me.onboardingComplete });
  }
  plan.push({
    id: "identity",
    pending: me.profileMissing.includes("name") || me.profileMissing.includes("photo"),
  });
  if (!me.githubLinked || !me.twitterHandle) {
    plan.push({ id: "links", pending: true });
  }
  if (me.profileMissing.includes("directory")) {
    // One draft across two steps: DirectoryStep stays mounted for both.
    plan.push({ id: "directory", pending: true }, { id: "skills", pending: true });
  }
  const start = plan.findIndex((step) => step.pending);
  return {
    steps: plan.map((step) => step.id),
    start: start === -1 ? plan.length : start,
  };
}
