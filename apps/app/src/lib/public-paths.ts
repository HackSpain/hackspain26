import { CLOSING_PATH } from "@/lib/closing";

export function isPublicAppPath(pathname: string): boolean {
  return (
    pathname === "/tv" ||
    pathname === "/final/cancelar" ||
    pathname === CLOSING_PATH
  );
}
