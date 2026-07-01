import { Skeleton } from "@/components/ui/skeleton";

export function SessionCardSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-border/50 rounded-2xl">
      <div className="flex items-center gap-3.5">
        <Skeleton className="w-11 h-11 rounded-full shrink-0" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
      <Skeleton className="h-8 w-24 rounded-xl shrink-0 self-end sm:self-center" />
    </div>
  );
}

export function SessionsListSkeleton() {
  return (
    <div className="divide-y divide-border/30">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 flex-wrap justify-between">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <Skeleton className="w-11 h-11 rounded-full shrink-0" />
            <div className="space-y-2 min-w-0 flex-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PatientCardSkeleton() {
  return (
    <div className="dashboard-card p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 flex-1 rounded-xl" />
        <Skeleton className="h-8 w-20 rounded-xl" />
      </div>
    </div>
  );
}

export function ProfileFormSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function SessionHistorySkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 items-start">
          <Skeleton className="w-3 h-3 rounded-full mt-1.5 shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      ))}
    </div>
  );
}
