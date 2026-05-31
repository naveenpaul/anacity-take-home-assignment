import { SkeletonBar } from '../../skeleton';

export default function CommunityLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <SkeletonBar className="h-3 w-48" />
        <SkeletonBar className="h-7 w-72" />
        <SkeletonBar className="h-4 w-56" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          {[0, 1].map((b) => (
            <section key={b} className="space-y-3">
              <SkeletonBar className="h-3 w-24" />
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2">
                {[0, 1, 2, 3].map((u) => (
                  <SkeletonBar key={u} className="h-10 w-full" />
                ))}
              </div>
            </section>
          ))}
        </div>
        <aside className="space-y-3">
          <SkeletonBar className="h-3 w-28" />
          <SkeletonBar className="h-64 w-full" />
        </aside>
      </div>
    </div>
  );
}
