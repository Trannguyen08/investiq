export default function StockDetailLoading() {
  return (
    <main id="main-content" className="market-page stock-detail-page max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6 text-slate-100 animate-pulse">
      {/* Back button skeleton */}
      <div className="h-4 w-32 bg-slate-800/80 rounded" />

      {/* Hero Header skeleton */}
      <header className="relative flex flex-wrap items-center justify-between gap-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-8 sm:p-10 shadow-sm">
        <div className="flex flex-col gap-2.5 pt-2 sm:pt-0">
          <div className="h-3.5 w-36 bg-sky-950/80 border border-sky-800/30 rounded" />
          <div className="h-10 w-28 bg-slate-800 rounded-lg mt-1" />
          <div className="h-4 w-56 bg-slate-800/70 rounded" />
          <div className="flex items-center gap-3 mt-3">
            <div className="h-9 w-24 bg-emerald-950/60 border border-emerald-800/40 rounded-xl" />
            <div className="h-9 w-24 bg-rose-950/60 border border-rose-800/40 rounded-xl" />
            <div className="h-9 w-32 bg-slate-800/70 rounded-xl" />
          </div>
        </div>

        {/* Live Price Block skeleton */}
        <div className="flex flex-col items-end gap-2 bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 min-w-[200px]">
          <div className="h-9 w-32 bg-slate-800 rounded" />
          <div className="h-4 w-28 bg-slate-800/60 rounded" />
          <div className="h-3 w-40 bg-slate-800/40 rounded mt-1" />
        </div>
      </header>

      {/* 5 Tabs Navigation skeleton */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <div className="h-9 w-36 bg-sky-900/40 border border-sky-700/50 rounded-lg" />
        <div className="h-9 w-40 bg-slate-800/40 rounded-lg" />
        <div className="h-9 w-36 bg-slate-800/40 rounded-lg" />
        <div className="h-9 w-32 bg-slate-800/40 rounded-lg" />
        <div className="h-9 w-28 bg-slate-800/40 rounded-lg" />
      </div>

      {/* Main Content Layout: Chart + Metrics */}
      <div className="stock-detail-market-layout grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Skeleton */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 min-h-[420px] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div className="h-5 w-40 bg-slate-800 rounded" />
            <div className="flex gap-1.5">
              <div className="h-7 w-12 bg-slate-800 rounded-md" />
              <div className="h-7 w-12 bg-slate-800 rounded-md" />
              <div className="h-7 w-12 bg-slate-800 rounded-md" />
              <div className="h-7 w-12 bg-slate-800 rounded-md" />
            </div>
          </div>
          <div className="w-full flex-1 bg-slate-950/40 border border-slate-800/40 rounded-xl flex items-center justify-center">
            <div className="text-xs text-slate-500 font-medium">Đang tải biểu đồ và sổ lệnh...</div>
          </div>
        </div>

        {/* Key Metrics Panel Skeleton */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
          <div className="h-5 w-36 bg-slate-800 rounded mb-2" />
          <div className="grid grid-cols-2 gap-3.5">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div key={idx} className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-3 flex flex-col gap-1.5">
                <div className="h-3 w-16 bg-slate-800/60 rounded" />
                <div className="h-5 w-20 bg-slate-800 rounded" />
              </div>
            ))}
          </div>
          <div className="h-16 w-full bg-slate-950/50 border border-slate-800/60 rounded-xl mt-auto" />
        </div>
      </div>
    </main>
  );
}
