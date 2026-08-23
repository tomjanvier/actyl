export default function DashboardLoading() {
  return (
    <div className="animate-pulse px-6 py-5">
      <div className="mb-5 h-8 w-64 rounded-lg bg-elev" />
      <div className="space-y-2.5">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-hover" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    </div>
  );
}
