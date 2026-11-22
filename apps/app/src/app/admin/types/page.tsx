import { redirect } from "next/navigation";

export default function AdminTypesRedirect() {
  redirect("/admin?tab=roles");
}
