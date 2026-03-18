export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-lg skeleton-pulse" />
        <div className="h-4 w-64 rounded-lg skeleton-pulse" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-2xl skeleton-pulse" />
        ))}
      </div>
      <div className="h-48 rounded-2xl skeleton-pulse" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-80 rounded-2xl skeleton-pulse" />
        <div className="h-80 rounded-2xl skeleton-pulse" />
      </div>
    </div>
  );
}
