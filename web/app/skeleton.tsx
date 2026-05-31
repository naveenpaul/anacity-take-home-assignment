/**
 * Skeleton primitives for route-level loading states.
 *
 * Plain muted blocks with a subtle opacity pulse — no gradient shimmer
 * (DESIGN.md §8 forbids gradient-sweep skeletons). The pulse is disabled
 * under prefers-reduced-motion via the guard in globals.css.
 */

export function SkeletonBar({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-surface-muted rounded-sm animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`border border-line rounded-sm p-4 space-y-3 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <SkeletonBar className="h-4 w-2/3" />
          <SkeletonBar className="h-3 w-1/3" />
        </div>
        <SkeletonBar className="h-5 w-20 rounded-full" />
      </div>
      <SkeletonBar className="h-3 w-1/4" />
    </div>
  );
}
