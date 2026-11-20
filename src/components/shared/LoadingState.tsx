import { Skeleton } from '../ui/Skeleton';

export function LoadingState({ rows = 4, label }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      {label && <p className="text-sm text-secondary">{label}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-surface border border-border-subtle p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <div className="grid grid-cols-3 gap-3 pt-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
