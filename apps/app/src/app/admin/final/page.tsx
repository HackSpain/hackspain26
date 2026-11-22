import { redirect } from "next/navigation";

export default function AdminFinalRedirect() {
  redirect("/admin/judging?tab=final");
}
