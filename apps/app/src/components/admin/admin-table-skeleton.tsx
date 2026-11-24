import { ListTableSkeleton, Page, Skeleton } from "@/components/page";

export function AdminTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Page compact className="space-y-3">
      <Skeleton className="h-11 w-56" />
      <ListTableSkeleton rows={rows} />
    </Page>
  );
}
