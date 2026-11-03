export default function MarketLoading() {
  return (
    <main id="main-content" className="market-page max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6 text-slate-100 animate-pulse">
      {/* Hero Skeleton */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-2">
        <div className="h-3 w-28 bg-slate-800 rounded" />
        <div className="h-7 w-64 bg-slate-800 rounded" />
        <div className="h-3.5 w-96 max-w-full bg-slate-800/80 rounded" />
      </div>

      {/* Status Skeleton */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
        <div className="h-4 w-40 bg-slate-800 rounded" />
        <div className="h-4 w-32 bg-slate-800 rounded" />
      </div>

      {/* Tabs Skeleton */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
        <div className="h-9 w-24 bg-sky-500/20 border border-sky-500/30 rounded-xl" />
        <div className="h-9 w-20 bg-slate-800 rounded-xl" />
        <div className="h-9 w-20 bg-slate-800 rounded-xl" />
        <div className="h-9 w-24 bg-slate-800 rounded-xl" />
        <div className="h-9 w-28 bg-slate-800 rounded-xl" />
      </div>

      {/* Summary Card Skeleton */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 grid md:grid-cols-2 gap-5">
        <div className="flex flex-col gap-3 justify-center">
          <div className="h-3 w-32 bg-slate-800 rounded" />
          <div className="h-6 w-3/4 bg-slate-800 rounded" />
          <div className="h-3 w-48 bg-slate-800/70 rounded" />
        </div>
        <div className="h-44 bg-slate-950/60 border border-slate-800 rounded-xl" />
      </div>

      {/* Heatmap & Quick Facts Skeleton */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 h-64 bg-slate-900/90 border border-slate-800 rounded-2xl p-5" />
        <div className="h-64 bg-slate-900/90 border border-slate-800 rounded-2xl p-5" />
      </div>

      {/* Table Skeleton */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
        <div className="h-5 w-40 bg-slate-800 rounded" />
        <div className="h-10 w-full bg-slate-800/60 rounded-xl" />
        <div className="h-12 w-full bg-slate-950/40 rounded-lg" />
        <div className="h-12 w-full bg-slate-950/40 rounded-lg" />
        <div className="h-12 w-full bg-slate-950/40 rounded-lg" />
      </div>
    </main>
  );
}
