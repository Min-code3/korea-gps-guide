export default function Loading() {
  return (
    <main className="flex flex-col h-dvh overflow-hidden bg-stone-50">
      <div className="h-[45vh] shrink-0 bg-stone-200 animate-pulse" />
      <div className="px-5 pt-4 pb-3">
        <div className="h-6 w-24 bg-stone-200 rounded animate-pulse mb-3" />
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-stone-200 rounded-full animate-pulse" />
          <div className="h-8 w-20 bg-stone-200 rounded-full animate-pulse" />
        </div>
      </div>
      <div className="flex-1 px-5 flex flex-col gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="flex-1">
              <div className="h-4 w-32 bg-stone-200 rounded animate-pulse mb-2" />
              <div className="h-3 w-48 bg-stone-100 rounded animate-pulse" />
            </div>
            <div className="w-20 h-20 bg-stone-200 rounded-xl animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </main>
  );
}
