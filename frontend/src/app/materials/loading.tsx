export default function MaterialsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 rounded-lg skeleton-pulse" />
          <div className="h-4 w-48 rounded-lg skeleton-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-56 rounded-lg skeleton-pulse" />
          <div className="h-9 w-24 rounded-lg skeleton-pulse" />
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl overflow-hidden">
          <div className="h-12 skeleton-pulse" />
          <div className="p-4 space-y-3">
            <div className="h-24 rounded-xl skeleton-pulse" />
            <div className="h-24 rounded-xl skeleton-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
