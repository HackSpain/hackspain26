import { redirect } from "next/navigation";

export default function AdminNotificationsRedirect() {
  redirect("/admin/event?tab=avisos");
}
