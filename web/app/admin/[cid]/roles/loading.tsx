import { SkeletonBar } from '../../../skeleton';

export default function RolesLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <SkeletonBar className="h-3 w-48" />
        <SkeletonBar className="h-7 w-32" />
        <SkeletonBar className="h-4 w-96 max-w-full" />
      </div>
      <SkeletonBar className="h-8 w-36" />
      <div className="space-y-2">
        {[0, 1, 2, 3].map((r) => (
          <div key={r} className="border border-line rounded-sm p-4 space-y-3">
            <SkeletonBar className="h-4 w-40" />
            <div className="flex flex-wrap gap-1">
              {[0, 1, 2, 3, 4].map((p) => (
                <SkeletonBar key={p} className="h-5 w-24 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
