import { redirect } from "next/navigation";

export default async function NestedDeliveryRedirect({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  redirect(`/deliveries?project=${encodeURIComponent(submissionId)}`);
}
