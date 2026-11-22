import { redirect } from "next/navigation";

export default function AdminEquiposRedirect() {
  redirect("/admin/teams");
}
