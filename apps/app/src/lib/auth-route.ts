import { CLI_AUTH_PATH } from "@/lib/cli-handoff";
import {
  DELIVERIES_PATH,
  hasDirectory,
  hasSponsorCatalog,
  isAnyJudgingPath,
  isJudgingPath,
  isPathAllowedWhenClosed,
  isSponsorJudgingPath,
  isTracksPath,
  JUDGING_PATH,
  sectionForPath,
} from "@/lib/sections";

export type AuthMe = {
  accepted: boolean;
  admin: boolean;
  canJudge: boolean;
  event: { open: boolean };
  isRegistered: boolean;
  onboardingComplete: boolean;
  profileComplete: boolean;
  role: string;
  sections: readonly string[];
};

/**
 * Where a signed-in person lands after login or when `/` is the wrong home.
 * Admins and hackers stay on `/`. Judges score; sponsors read deliveries.
 */
export function dashboardHome(
  me: Pick<AuthMe, "admin" | "canJudge" | "sections">
): string {
  if (me.admin) {
    return "/";
  }
  if (me.canJudge) {
    return JUDGING_PATH;
  }
  if (hasSponsorCatalog(me.sections)) {
    return DELIVERIES_PATH;
  }
  return "/";
}

function statusDestination(me: AuthMe): string | null {
  if (!me.admin) {
    if (!me.isRegistered) {
      return "/unregistered";
    }
    if (!me.accepted) {
      return "/pending";
    }
    if (!me.onboardingComplete) {
      return "/onboarding";
    }
  }
  if (!me.profileComplete) {
    return "/onboarding";
  }
  return null;
}

function isAdminUser(me: AuthMe): boolean {
  return me.admin || me.role === "admin";
}

/**
 * Redirect target for this path, or `null` to render it. Destinations stay
 * unregistered / pending / onboarding / home / judging / deliveries. Applicants
 * stay in the accept queue even when their catalog role is mentor or jurado.
 */
export function route(me: AuthMe, path: string): string | null {
  if (path === CLI_AUTH_PATH) {
    return null;
  }

  if (isAdminUser(me)) {
    if (!me.profileComplete && path !== "/onboarding") {
      return "/onboarding";
    }
    if (path === "/login") {
      return "/";
    }
    if (path === "/onboarding" && me.profileComplete) {
      const detailsDue = me.accepted && !me.onboardingComplete;
      if (!detailsDue) {
        return "/";
      }
      return null;
    }
    if (path === "/pending" || path === "/unregistered") {
      return "/";
    }
    return null;
  }

  if (!me.event.open && !isPathAllowedWhenClosed(path, me.canJudge)) {
    return "/";
  }

  const section = sectionForPath(path);
  if (
    section &&
    !me.sections.includes(section) &&
    !(me.canJudge && section === "tracks")
  ) {
    return "/";
  }

  if (path.startsWith("/admin")) {
    return "/";
  }

  const dest = statusDestination(me);
  const home = dashboardHome(me);

  if (isAnyJudgingPath(path)) {
    if (dest) {
      return dest;
    }
    if (isJudgingPath(path) && !me.canJudge) {
      return hasSponsorCatalog(me.sections) ? DELIVERIES_PATH : home;
    }
    if (isSponsorJudgingPath(path) && !hasSponsorCatalog(me.sections)) {
      return me.canJudge ? JUDGING_PATH : home;
    }
    return null;
  }

  if (me.canJudge && isTracksPath(path)) {
    return dest && dest !== "/onboarding" ? dest : null;
  }

  if (path === "/login") {
    return dest ?? home;
  }

  if (dest && path !== dest) {
    return dest;
  }

  if (
    !dest &&
    (path === "/onboarding" ||
      path === "/unregistered" ||
      path === "/pending" ||
      path === "/login")
  ) {
    return home;
  }

  if (path === "/" && home !== "/") {
    return home;
  }

  if (hasDirectory(me.sections) && path === "/" && home === DELIVERIES_PATH) {
    return home;
  }

  return null;
}
