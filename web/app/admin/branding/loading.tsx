import { SkeletonBar } from '../../skeleton';

export default function BrandingLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <SkeletonBar className="h-3 w-32" />
        <SkeletonBar className="h-7 w-56" />
      </div>
      <div className="grid gap-8 md:grid-cols-[1fr_18rem]">
        <div className="space-y-5">
          {[0, 1, 2, 3].map((f) => (
            <div key={f} className="space-y-1.5">
              <SkeletonBar className="h-3 w-24" />
              <SkeletonBar className="h-9 w-full" />
            </div>
          ))}
          <SkeletonBar className="h-9 w-36" />
        </div>
        <aside className="space-y-3">
          <SkeletonBar className="h-3 w-20" />
          <SkeletonBar className="h-40 w-full" />
        </aside>
      </div>
    </div>
  );
}
