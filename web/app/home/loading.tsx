import { SkeletonBar, SkeletonCard } from '../skeleton';

export default function HomeLoading() {
  return (
    <div className="space-y-10">
      <div className="space-y-1.5">
        <SkeletonBar className="h-3 w-16" />
        <SkeletonBar className="h-7 w-48" />
        <SkeletonBar className="h-3 w-40" />
      </div>

      <SkeletonBar className="h-16 w-full" />

      <section className="space-y-4">
        <SkeletonBar className="h-3 w-56" />
        <div className="grid gap-3 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </section>

      <section className="space-y-3">
        <SkeletonBar className="h-3 w-64" />
        <SkeletonBar className="h-40 w-full" />
      </section>
    </div>
  );
}
