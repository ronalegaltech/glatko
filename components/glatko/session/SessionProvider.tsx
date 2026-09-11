"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/supabase/browser";
import type { SessionPayload } from "@/app/api/session/route";

/**
 * perf-static (2026-09-11): client-side session summary for the layout
 * chrome. The [locale] layout no longer reads auth cookies on the server (that
 * made every page a dynamic render), so the header / onboarding banner /
 * Sentry scope / search modal get the viewer from here instead.
 *
 * Sequence: the server HTML is the guest chrome; after hydration the last
 * known payload (sessionStorage, per tab) is applied immediately to avoid a
 * guest→user flash on navigations, then /api/session revalidates it. Auth
 * events (sign-in / sign-out / user update) trigger a refetch.
 */
export type SessionState = SessionPayload & { status: "loading" | "ready" };

const GUEST: SessionPayload = {
  userId: null,
  email: null,
  isPro: false,
  isAdmin: false,
  onboarding: null,
};

const INITIAL: SessionState = { ...GUEST, status: "loading" };
const CACHE_KEY = "glatko:session:v1";

const SessionContext = createContext<SessionState>(INITIAL);

function readCache(): SessionPayload | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionPayload>;
    if (typeof parsed !== "object" || parsed === null) return null;
    return { ...GUEST, ...parsed };
  } catch {
    return null;
  }
}

function writeCache(payload: SessionPayload | null) {
  try {
    if (payload) window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    else window.sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* storage unavailable — fine, the fetch still runs */
  }
}

export function SessionProvider({ locale, children }: { locale: string; children: ReactNode }) {
  const [state, setState] = useState<SessionState>(INITIAL);

  useEffect(() => {
    let cancelled = false;

    const cached = readCache();
    if (cached) setState({ ...cached, status: "ready" });

    const load = async () => {
      try {
        const res = await fetch(`/api/session?locale=${encodeURIComponent(locale)}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = res.ok ? ((await res.json()) as SessionPayload) : GUEST;
        if (cancelled) return;
        writeCache(payload.userId ? payload : null);
        setState({ ...GUEST, ...payload, status: "ready" });
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, status: "ready" }));
      }
    };
    void load();

    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        if (event === "SIGNED_OUT") writeCache(null);
        void load();
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [locale]);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
