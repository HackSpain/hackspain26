import { CLOSING_PATH } from "@/lib/closing";

export function isPublicAppPath(pathname: string): boolean {
  return (
    pathname === "/tv" ||
    pathname === "/cli-auth/handoff" ||
    pathname === "/final/cancelar" ||
    pathname === CLOSING_PATH
  );
}
