import { RECEPTION_PATH } from "@/lib/reception";

export function isPublicAppPath(pathname: string): boolean {
  return (
    pathname === "/tv" ||
    pathname === "/final/cancelar" ||
    pathname === RECEPTION_PATH
  );
}
