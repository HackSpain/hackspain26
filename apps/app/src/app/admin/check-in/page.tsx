import { redirect } from "next/navigation";

export default function AdminCheckInRedirect() {
  redirect("/admin/event?tab=accesos");
}
