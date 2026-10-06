export default function CampaignsLoading() {
  return (
    <div role="status" aria-label="Chargement des campagnes" className="px-4 pb-8 pt-16 sm:px-7 md:pt-6">
      <span className="sr-only">Chargement des campagnes…</span>
      <div aria-hidden className="animate-pulse">
        <div className="mb-3 h-7 w-64 max-w-full rounded-lg bg-elev" />
        <div className="mb-10 h-4 w-96 max-w-full rounded bg-hover" />
        <div className="mb-6 h-11 w-80 max-w-full rounded-lg bg-elev" />
        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-72 rounded-2xl bg-raised p-5 ring-1 ring-line">
              <div className="mb-5 h-12 w-12 rounded-xl bg-elev" />
              <div className="mb-3 h-5 w-3/4 rounded bg-elev" />
              <div className="h-4 w-full rounded bg-hover" />
              <div className="mt-12 h-16 rounded-lg bg-hover" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
