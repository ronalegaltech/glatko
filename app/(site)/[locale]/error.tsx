"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      console.error("[Glatko Error]", error.message, error.stack);
    }
  }, [error]);
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F8F6F0] px-4 dark:bg-[#0b1f23]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(20,184,166,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(20,184,166,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-teal-500/[0.04] blur-[120px] dark:bg-teal-500/[0.06]" />
        <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-cyan-500/[0.03] blur-[100px] dark:bg-cyan-500/[0.05]" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-3xl border border-gray-200/60 bg-white/70 p-10 text-center shadow-xl backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="mb-6 flex items-center justify-center gap-1">
            <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">Glatko</span>
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-teal-500" />
          </div>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10">
            <span className="font-serif text-3xl text-red-500">!</span>
          </div>
          <h1 className="mt-6 font-serif text-2xl text-gray-900 dark:text-white">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-white/50">
            An unexpected error occurred. Please try again.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={reset}
              className="rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all hover:shadow-xl hover:shadow-teal-500/30"
            >
              Try Again
            </button>
            <Link
              href="/en"
              className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
