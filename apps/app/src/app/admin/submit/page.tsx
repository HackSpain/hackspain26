import { redirect } from "next/navigation";

export default async function AdminSubmitRedirect({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team } = await searchParams;
  const next = new URLSearchParams();
  next.set("tab", "entregas");
  if (team) {
    next.set("team", team);
  }
  redirect(`/admin/teams?${next.toString()}`);
}
