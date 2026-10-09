/** Drizzle wraps Postgres/Neon errors; `23505` unique violation lives on `cause`. */
export function isPostgresUniqueViolation(e: unknown): boolean {
  const seen = new Set<unknown>();
  let cur: unknown = e;
  for (
    let depth = 0;
    depth < 14 && cur !== null && cur !== undefined;
    depth++
  ) {
    if (seen.has(cur)) {
      break;
    }
    seen.add(cur);
    if (
      typeof cur === "object" &&
      cur !== null &&
      "code" in cur &&
      (cur as { code: unknown }).code === "23505"
    ) {
      return true;
    }
    if (cur instanceof Error && cur.cause !== null && cur.cause !== undefined) {
      cur = cur.cause;
      continue;
    }
    if (typeof cur === "object" && cur !== null && "cause" in cur) {
      const next = (cur as { cause: unknown }).cause;
      if (next === null || next === undefined) {
        break;
      }
      cur = next;
      continue;
    }
    break;
  }
  return false;
}
