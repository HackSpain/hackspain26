/**
 * Deadline the landing-page countdown counts down to, after which the signup
 * CTAs switch to a disabled "closed" state and `POST /api/signup` stops
 * accepting applications.
 *
 * Written with an explicit offset so it never depends on the visitor's — or the
 * server's — timezone. `+02:00` is Madrid time in August (CEST); switch the
 * offset to `+01:00` if the deadline is ever moved past the October DST change.
 */
const SIGNUP_DEADLINE_ISO = "2026-08-09T23:59:00+02:00";

export const SIGNUP_DEADLINE_MS = new Date(SIGNUP_DEADLINE_ISO).getTime();

/**
 * HackSpain 2026 ended on Sunday 20 September 2026. From that moment signups
 * stay closed whatever `SIGNUP_DEADLINE_ISO` says and whatever link a visitor
 * holds: the late-access keys that used to bypass the deadline are gone. Move
 * this date only for a new edition.
 */
const EVENT_END_ISO = "2026-09-20T23:59:00+02:00";

const EVENT_END_MS = new Date(EVENT_END_ISO).getTime();

/**
 * Whether the signup window has closed. The single source of truth for the
 * countdown, the CTAs, the page copy and the API gate — a visitor's clock only
 * decides what the browser shows; `/api/signup` re-checks it server-side.
 */
export function areSignupsClosed(now: number = Date.now()): boolean {
  return now >= EVENT_END_MS || now >= SIGNUP_DEADLINE_MS;
}
