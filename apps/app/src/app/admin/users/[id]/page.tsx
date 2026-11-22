import { redirect } from "next/navigation";

export default async function AdminParticipantRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { id } = await params;
  const { kind } = await searchParams;
  const next = new URLSearchParams();
  next.set("user", id);
  if (kind) {
    next.set("kind", kind);
  }
  redirect(`/admin?${next.toString()}`);
}
