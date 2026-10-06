export default function CampaignLoading() {
  return (
    <div role="status" aria-label="Chargement de la campagne" className="px-4 pb-8 pt-16 sm:px-7 md:pt-6">
      <span className="sr-only">Chargement de la campagne…</span>
      <div aria-hidden className="animate-pulse">
        <div className="mb-6 h-4 w-36 rounded bg-elev" />
        <div className="mb-3 h-8 w-96 max-w-full rounded-lg bg-elev" />
        <div className="mb-6 h-4 w-3/4 rounded bg-hover" />
        <div className="mb-8 h-11 w-full rounded-lg bg-hover" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-96 w-[min(82vw,292px)] shrink-0 rounded-2xl bg-hover p-3">
              <div className="mb-6 h-5 w-3/4 rounded bg-elev" />
              <div className="mb-3 h-24 rounded-xl bg-raised" />
              <div className="h-24 rounded-xl bg-raised" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
