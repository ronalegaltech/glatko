import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const MIN_SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export function mergeSessionCookieOptions(options: CookieOptions): CookieOptions {
  const maxAge =
    options.maxAge != null
      ? Math.max(options.maxAge, MIN_SESSION_COOKIE_MAX_AGE)
      : MIN_SESSION_COOKIE_MAX_AGE
  return {
    ...options,
    path: options.path ?? '/',
    sameSite: options.sameSite ?? 'lax',
    secure: options.secure ?? process.env.NODE_ENV === 'production',
    maxAge,
  }
}

export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // perf-static (2026-09-11): the old `NEXT_PHASE === 'phase-production-build'`
    // short-circuit is gone on purpose. It hid the cookies() call from the
    // build, so once the layout tree became static-capable every gated page
    // (pro dashboard, messages, settings, admin…) was prerendered as a GUEST
    // shell and served from the CDN for a year. Calling cookies() during the
    // build is exactly how Next learns that a route is dynamic.
    if (!url || !key) {
        return createServerClient(
            url || 'http://localhost:54321',
            key || 'dummy-key',
            { cookies: { get: () => undefined, set: () => {}, remove: () => {} } }
        )
    }

    const cookieStore = cookies()

    return createServerClient(
        url,
        key,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...mergeSessionCookieOptions(options) })
                    } catch {
                        // Server Component context
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options })
                    } catch {
                        // Server Component context
                    }
                },
            },
        }
    )
}

/**
 * perf-static (2026-09-11): cookie-less anon client for public, cacheable
 * reads (static / ISR pages: home, /services, /pros/[slug], sitemap…).
 *
 * `createClient()` above calls `cookies()`, and any call to it during a
 * render opts the whole route into per-request rendering — which is exactly
 * what kept every public page of the site out of the CDN. This one carries
 * no session, so it sees precisely what an anonymous visitor sees (RLS as
 * `anon`) and can run at build time and inside ISR regeneration.
 */
export function createPublicClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-key'
    return createSupabaseClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
}

export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
        // Fail loud in production: a missing service-role key there is an operator
        // misconfig. Silently returning a dead-localhost client masks it as opaque
        // connection-refused 500s / silent cron no-ops. Keep the localhost fallback
        // only for local dev/test (matches supabase/service-role.ts).
        if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
            throw new Error(
                'SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required in production',
            )
        }
        return createSupabaseClient('http://localhost:54321', 'dummy-key')
    }

    return createSupabaseClient(
        url,
        key,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}
