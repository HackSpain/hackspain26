import { v } from "convex/values";
import { adminMutation, adminQuery } from "./lib/customFunctions";
import { resolveEdition } from "./lib/editions";
import { fail } from "./lib/errors";
import { eventPhase, eventPhaseValidator } from "./lib/eventWindow";
import {
  applicationsModeValidator,
  submissionsAreOpenFor,
  submissionsModeValidator,
} from "./lib/schedule";

const optionalTime = v.optional(v.number());

function requirePair(
  start: number | undefined,
  end: number | undefined,
  message: string
): void {
  if ((start === undefined) !== (end === undefined)) {
    fail("VALIDATION", message);
  }
  if (start !== undefined && end !== undefined && start >= end) {
    fail("VALIDATION", "El fin debe ser posterior al inicio.");
  }
}

export const adminCalendar = adminQuery({
  args: { editionId: v.optional(v.id("editions")) },
  handler: async (ctx, args) => {
    const edition = await resolveEdition(ctx, args.editionId);
    const window = {
      endsAt: edition.eventEndsAt,
      startsAt: edition.eventStartsAt,
    };
    const now = Date.now();
    return {
      applicationsClosesAt: edition.applicationsClosesAt,
      applicationsMode: edition.applicationsMode ?? "auto",
      applicationsOpensAt: edition.applicationsOpensAt,
      applicationsWaitlistFrom: edition.applicationsWaitlistFrom,
      checkInOpensAt: edition.checkInOpensAt,
      current: edition.current,
      eventEndsAt: edition.eventEndsAt,
      eventPhase: eventPhase(window, now),
      eventStartsAt: edition.eventStartsAt,
      label: edition.label,
      slug: edition.slug,
      submissionsMode:
        edition.submissionsMode ?? (edition.submissionsOpen ? "on" : "off"),
      submissionsOpen: submissionsAreOpenFor(edition, now),
      submitClosesAt: edition.submitClosesAt,
      submitOpensAt: edition.submitOpensAt,
    };
  },
  returns: v.object({
    applicationsClosesAt: optionalTime,
    applicationsMode: applicationsModeValidator,
    applicationsOpensAt: optionalTime,
    applicationsWaitlistFrom: optionalTime,
    checkInOpensAt: optionalTime,
    current: v.boolean(),
    eventEndsAt: optionalTime,
    eventPhase: eventPhaseValidator,
    eventStartsAt: optionalTime,
    label: v.string(),
    slug: v.string(),
    submissionsMode: submissionsModeValidator,
    submissionsOpen: v.boolean(),
    submitClosesAt: optionalTime,
    submitOpensAt: optionalTime,
  }),
});

export const adminSaveCalendar = adminMutation({
  args: {
    applicationsClosesAt: optionalTime,
    applicationsMode: applicationsModeValidator,
    applicationsOpensAt: optionalTime,
    applicationsWaitlistFrom: optionalTime,
    checkInOpensAt: optionalTime,
    editionId: v.optional(v.id("editions")),
    eventEndsAt: optionalTime,
    eventStartsAt: optionalTime,
    submissionsMode: submissionsModeValidator,
    submitClosesAt: optionalTime,
    submitOpensAt: optionalTime,
  },
  handler: async (ctx, args) => {
    requirePair(
      args.eventStartsAt,
      args.eventEndsAt,
      "Indica el inicio y el fin, o deja los dos vacíos."
    );
    requirePair(
      args.submitOpensAt,
      args.submitClosesAt,
      "Indica la apertura y el cierre de envíos, o deja los dos vacíos."
    );
    if (
      args.applicationsOpensAt !== undefined &&
      args.applicationsClosesAt !== undefined &&
      args.applicationsOpensAt >= args.applicationsClosesAt
    ) {
      fail(
        "VALIDATION",
        "El cierre de inscripciones debe ser posterior a la apertura."
      );
    }
    if (
      args.applicationsWaitlistFrom !== undefined &&
      args.applicationsOpensAt !== undefined &&
      args.applicationsWaitlistFrom < args.applicationsOpensAt
    ) {
      fail(
        "VALIDATION",
        "La lista de espera no puede empezar antes de abrir inscripciones."
      );
    }
    if (
      args.applicationsWaitlistFrom !== undefined &&
      args.applicationsClosesAt !== undefined &&
      args.applicationsWaitlistFrom > args.applicationsClosesAt
    ) {
      fail(
        "VALIDATION",
        "La lista de espera no puede empezar después de cerrar inscripciones."
      );
    }
    const edition = await resolveEdition(ctx, args.editionId);
    const submissionsOpen =
      args.submissionsMode === "on" ||
      (args.submissionsMode === "auto" &&
        submissionsAreOpenFor(
          {
            ...edition,
            submissionsMode: args.submissionsMode,
            submitClosesAt: args.submitClosesAt,
            submitOpensAt: args.submitOpensAt,
          },
          Date.now()
        ));
    await ctx.db.patch(edition._id, {
      applicationsClosesAt: args.applicationsClosesAt,
      applicationsMode: args.applicationsMode,
      applicationsOpensAt: args.applicationsOpensAt,
      applicationsWaitlistFrom: args.applicationsWaitlistFrom,
      checkInOpensAt: args.checkInOpensAt,
      eventEndsAt: args.eventEndsAt,
      eventStartsAt: args.eventStartsAt,
      submissionsMode: args.submissionsMode,
      submissionsOpen,
      submitClosesAt: args.submitClosesAt,
      submitOpensAt: args.submitOpensAt,
    });
    return null;
  },
  returns: v.null(),
});
