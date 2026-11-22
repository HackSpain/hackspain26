import type { ParticipationStatus } from "@convex/lib/validators";

export const PEOPLE_Q = "q";
export const PEOPLE_ROLE = "role";
export const PEOPLE_STATUS = "status";
export const PEOPLE_ATTENDANCE = "attendance";
export const PEOPLE_PAGE = "page";

const ATTENDANCE = ["attending", "cancelled", "undecided"] as const;
const STATUSES: readonly ParticipationStatus[] = [
  "interested",
  "applied",
  "waitlist",
  "accepted",
  "rejected",
  "confirmed",
  "cancelled",
];

export type PeopleAttendance = (typeof ATTENDANCE)[number];

export type PeopleFilters = {
  attendance: "all" | PeopleAttendance;
  page: number;
  q: string;
  role: "all" | "none" | string;
  status: "all" | ParticipationStatus;
};

export function peopleFiltersFrom(params: URLSearchParams): PeopleFilters {
  const attendance = params.get(PEOPLE_ATTENDANCE);
  const status = params.get(PEOPLE_STATUS);
  const role = params.get(PEOPLE_ROLE);
  const page = Number(params.get(PEOPLE_PAGE) ?? "1");
  return {
    attendance: isAttendance(attendance) ? attendance : "all",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    q: params.get(PEOPLE_Q)?.trim() ?? "",
    role: role && role.length > 0 ? role : "all",
    status: isStatus(status) ? status : "all",
  };
}

type PeopleFilterKey =
  | typeof PEOPLE_Q
  | typeof PEOPLE_ROLE
  | typeof PEOPLE_STATUS
  | typeof PEOPLE_ATTENDANCE
  | typeof PEOPLE_PAGE;

export function writePeopleFilter(
  params: URLSearchParams,
  key: PeopleFilterKey,
  value: string
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (
    value === "" ||
    value === "all" ||
    (key === PEOPLE_PAGE && value === "1")
  ) {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  if (key !== PEOPLE_PAGE) {
    next.delete(PEOPLE_PAGE);
  }
  return next;
}

function isAttendance(value: string | null): value is PeopleAttendance {
  return ATTENDANCE.some((entry) => entry === value);
}

function isStatus(value: string | null): value is ParticipationStatus {
  return STATUSES.some((entry) => entry === value);
}
