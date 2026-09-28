import { CLOSING_PATH } from "@/lib/closing";
import { RECEPTION_PATH } from "@/lib/reception";

export function isPublicAppPath(pathname: string): boolean {
  return (
    pathname === "/tv" ||
    pathname === "/cli-auth/handoff" ||
    pathname === "/final/cancelar" ||
    pathname === RECEPTION_PATH ||
    pathname === CLOSING_PATH
  );
}
