export const ADMIN_NAV = [
  { href: "/admin", label: "Personas" },
  { href: "/admin/teams", label: "Equipos" },
  { href: "/admin/tracks", label: "Retos" },
  { href: "/admin/perks", label: "Perks" },
  { href: "/admin/judging", label: "Jurado" },
  { href: "/admin/event", label: "Evento" },
  { href: "/admin/tv", label: "TV" },
] as const;

export function adminNavActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/users/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
