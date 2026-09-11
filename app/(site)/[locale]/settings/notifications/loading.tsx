export default function NotificationSettingsLoading() {
  return (
    <div className="min-h-screen px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-gray-200/80 dark:bg-white/[0.08]" />
        <p className="mt-3 h-4 w-full max-w-md animate-pulse rounded bg-gray-100 dark:bg-white/[0.05]" />
        <div className="mt-10 space-y-4">
          <div className="h-40 animate-pulse rounded-2xl border border-gray-100 bg-white/60 dark:border-white/[0.06] dark:bg-white/[0.03]" />
          <div className="h-40 animate-pulse rounded-2xl border border-gray-100 bg-white/60 dark:border-white/[0.06] dark:bg-white/[0.03]" />
        </div>
      </div>
    </div>
  );
}
