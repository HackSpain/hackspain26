import type { Doc } from "../_generated/dataModel";

export type AttendanceStatus = Doc<"users">["attendanceStatus"];

export function countsAsAttending(
  status: AttendanceStatus | null | undefined
): boolean {
  return status !== "cancelled";
}

export function defaultedAttendance(
  status: AttendanceStatus | null | undefined,
  onboarded: boolean
): AttendanceStatus {
  if (status === "cancelled") {
    return "cancelled";
  }
  if (onboarded || status === null || status === undefined) {
    return "attending";
  }
  return status;
}
