export default function Loading() {
  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="h-10 w-48 animate-pulse rounded-xl bg-gradient-to-r from-teal-500/10 to-teal-500/5" />
        <div className="mt-8 space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 dark:border-white/[0.06] dark:bg-white/[0.02]"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="h-11 w-11 animate-pulse rounded-full bg-teal-500/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded-lg bg-white/[0.06] dark:bg-white/[0.06]" />
                <div className="h-3 w-48 animate-pulse rounded-lg bg-white/[0.04] dark:bg-white/[0.04]" />
              </div>
              <div className="h-3 w-10 animate-pulse rounded bg-white/[0.04] dark:bg-white/[0.04]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
