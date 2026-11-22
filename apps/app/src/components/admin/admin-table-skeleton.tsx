import { Page, Skeleton } from "@/components/page";

export function AdminTableSkeleton({ title }: { title: string }) {
  return (
    <Page title={title} className="space-y-4">
      <Skeleton className="h-11 w-56" />
      <div className="grid gap-3 md:hidden" aria-hidden>
        {["a", "b", "c"].map((key) => (
          <div key={key} className="border-[3px] border-hs-ink bg-hs-paper p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-56" />
            <Skeleton className="mt-4 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="hidden border-[3px] border-hs-ink md:block" aria-hidden>
        <div className="h-11 border-b-[3px] border-hs-ink bg-hs-sand" />
        {["a", "b", "c", "d", "e", "f"].map((key) => (
          <div
            key={key}
            className="flex h-11 items-center gap-3 border-b border-hs-ink/20 px-3"
          >
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </Page>
  );
}
