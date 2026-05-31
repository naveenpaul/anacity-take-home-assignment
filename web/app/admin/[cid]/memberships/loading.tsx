import { SkeletonBar } from '../../../skeleton';

export default function MembershipsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <SkeletonBar className="h-3 w-48" />
        <SkeletonBar className="h-7 w-44" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <SkeletonBar className="h-4 w-24" />
        <SkeletonBar className="h-8 w-32" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3].map((m) => (
          <div key={m} className="border border-line rounded-sm p-4 space-y-3">
            <SkeletonBar className="h-4 w-40" />
            <SkeletonBar className="h-3 w-56" />
          </div>
        ))}
      </div>
    </div>
  );
}
