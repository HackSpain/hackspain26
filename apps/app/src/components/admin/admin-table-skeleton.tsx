import { ListTableSkeleton, Page, Skeleton } from "@/components/page";

export function AdminTableSkeleton({
  rows = 6,
  title,
}: {
  rows?: number;
  title: string;
}) {
  return (
    <Page title={title} className="space-y-4">
      <Skeleton className="h-11 w-56" />
      <ListTableSkeleton rows={rows} />
    </Page>
  );
}
