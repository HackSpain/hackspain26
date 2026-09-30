import { CLOSING_PATH } from "@/lib/closing";

export const PUBLIC_APP_PATHS = [
  "/tv",
  "/cli-auth/handoff",
  "/final/cancelar",
  CLOSING_PATH,
] as const;

export function isPublicAppPath(pathname: string): boolean {
  return PUBLIC_APP_PATHS.some((path) => path === pathname);
}
