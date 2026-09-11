export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b1f23]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-teal-500/30 border-t-teal-500 animate-spin" />
          <div className="absolute inset-0 h-10 w-10 rounded-full bg-teal-500/10 blur-lg" />
        </div>
        <span className="text-xs text-gray-400 dark:text-white/30 tracking-widest uppercase">
          Loading
        </span>
      </div>
    </div>
  );
}
