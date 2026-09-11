import { ImageResponse } from "next/og";
import { getFontsForLocale } from "@/lib/seo/og-fonts";

export const runtime = "edge";
export const alt = "Glatko Provider Profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

interface ProviderOG {
  id: string;
  business_name: string | null;
  location_city: string | null;
  is_founding_provider: boolean | null;
  founding_provider_number: number | null;
  avg_rating: number | null;
  completed_jobs: number | null;
  avatar_url: string | null;
}

/**
 * G-PRO-2 Faz 1 — Pro public profile dynamic OG.
 *
 * Hibrit render branches on `is_founding_provider`:
 *   - Founding pros get the dark/gold founding card with crown icon
 *     and #N/50 ordinal — the upsell to other pros + customers.
 *   - Regular approved pros get the clean white card with optional
 *     verified badge (inspiration: SoftGradientProfileCards).
 *
 * Inspirations: components/aceternity/profile-cards.tsx style for the
 * standard card layout (NOT used directly — Satori can't render React
 * client components, so we rebuild a static visual analogue).
 *
 * Constraint: SparklesCore (canvas) cannot run inside Edge ImageResponse
 * — gold gradient + crown emoji is the static-only equivalent for
 * founding cards.
 *
 * Avatar fetch: pro avatars live on the `profiles` table (nested via
 * the public profile page join). Edge runtime → direct REST query to
 * Supabase with the anon key.
 */
export default async function ProviderOGImage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const profile = await fetchProviderForOG(params.id);
  const fonts = await getFontsForLocale(params.locale);
  const isRTL = params.locale === "ar";

  if (!profile) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            background: "#0b1f23",
            alignItems: "center",
            justifyContent: "center",
            color: "#5EEAD4",
            fontSize: 60,
            fontWeight: 700,
          }}
        >
          Glatko · glatko.app
        </div>
      ),
      fonts.length > 0 ? { ...size, fonts } : { ...size },
    );
  }

  if (profile.is_founding_provider) {
    return renderFoundingCard(profile, fonts, isRTL);
  }
  return renderStandardCard(profile, fonts, isRTL);
}

async function fetchProviderForOG(id: string): Promise<ProviderOG | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const proRes = await fetch(
      `${SUPABASE_URL}/rest/v1/glatko_professional_profiles?id=eq.${id}&select=id,business_name,location_city,is_founding_provider,founding_provider_number,avg_rating,completed_jobs,verification_status&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        cache: "no-store",
      },
    );
    if (!proRes.ok) return null;
    const proRows = (await proRes.json()) as Array<{
      id: string;
      business_name: string | null;
      location_city: string | null;
      is_founding_provider: boolean | null;
      founding_provider_number: number | null;
      avg_rating: number | null;
      completed_jobs: number | null;
      verification_status: string | null;
    }>;
    const pro = proRows[0];
    if (!pro || pro.verification_status !== "approved") return null;

    const avatarRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=avatar_url&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        cache: "no-store",
      },
    );
    let avatarUrl: string | null = null;
    if (avatarRes.ok) {
      const avatarRows = (await avatarRes.json()) as Array<{
        avatar_url: string | null;
      }>;
      avatarUrl = avatarRows[0]?.avatar_url ?? null;
    }

    return {
      id: pro.id,
      business_name: pro.business_name,
      location_city: pro.location_city,
      is_founding_provider: pro.is_founding_provider,
      founding_provider_number: pro.founding_provider_number,
      avg_rating: pro.avg_rating,
      completed_jobs: pro.completed_jobs,
      avatar_url: avatarUrl,
    };
  } catch {
    return null;
  }
}

function renderFoundingCard(
  profile: ProviderOG,
  fonts: Awaited<ReturnType<typeof getFontsForLocale>>,
  isRTL: boolean,
) {
  const titleFont = isRTL ? '"Noto Sans Arabic"' : undefined;
  const businessName = profile.business_name ?? "Glatko Pro";
  const city = profile.location_city ?? "";
  const number = profile.founding_provider_number ?? 0;
  const rating = profile.avg_rating ?? 0;
  const jobs = profile.completed_jobs ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1e293b 0%, #0b1f23 50%, #1a1004 100%)",
          padding: 60,
          position: "relative",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background:
              "linear-gradient(90deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 60% 40% at 30% 30%, rgba(245,158,11,0.18), transparent 70%)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            direction: isRTL ? "rtl" : "ltr",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              alignSelf: "flex-start",
              padding: "10px 22px",
              borderRadius: 999,
              background:
                "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
              boxShadow: "0 12px 24px -8px rgba(245,158,11,0.45)",
              marginBottom: 36,
            }}
          >
            <span style={{ fontSize: 32 }}>👑</span>
            <span
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#1f1003",
                letterSpacing: 0.4,
                textTransform: "uppercase",
                ...(titleFont ? { fontFamily: titleFont } : {}),
              }}
            >
              Founding Provider · #{number} / 50
            </span>
          </div>

          <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                width={160}
                height={160}
                style={{
                  borderRadius: "50%",
                  border: "4px solid #fbbf24",
                  boxShadow: "0 8px 32px rgba(245,158,11,0.35)",
                }}
                alt=""
              />
            ) : (
              <div
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: "50%",
                  border: "4px solid #fbbf24",
                  background:
                    "linear-gradient(135deg, rgba(245,158,11,0.30), rgba(245,158,11,0.10))",
                  color: "#fbbf24",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 56,
                  fontWeight: 800,
                }}
              >
                {initials(businessName)}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h1
                style={{
                  fontSize: 56,
                  fontWeight: 800,
                  color: "#fff",
                  margin: 0,
                  lineHeight: 1.1,
                  textShadow: "0 4px 32px rgba(0,0,0,0.6)",
                  ...(titleFont ? { fontFamily: titleFont } : {}),
                }}
              >
                {businessName}
              </h1>
              {city && (
                <p
                  style={{
                    fontSize: 26,
                    color: "#cbd5e1",
                    margin: 0,
                    ...(titleFont ? { fontFamily: titleFont } : {}),
                  }}
                >
                  {city} · Glatko
                </p>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 48,
              marginTop: "auto",
              paddingTop: 32,
              borderTop: "2px solid rgba(251,191,36,0.30)",
            }}
          >
            {rating > 0 && (
              <StatBlock
                value={`★ ${rating.toFixed(1)}`}
                label="Rating"
                color="#fbbf24"
              />
            )}
            {jobs > 0 && (
              <StatBlock value={String(jobs)} label="Completed jobs" color="#fbbf24" />
            )}
            <span
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                fontSize: 30,
                fontWeight: 800,
                color: "#fff",
                letterSpacing: -0.5,
              }}
            >
              glatko.app
            </span>
          </div>
        </div>
      </div>
    ),
    fonts.length > 0 ? { ...size, fonts } : { ...size },
  );
}

function renderStandardCard(
  profile: ProviderOG,
  fonts: Awaited<ReturnType<typeof getFontsForLocale>>,
  isRTL: boolean,
) {
  const titleFont = isRTL ? '"Noto Sans Arabic"' : undefined;
  const businessName = profile.business_name ?? "Glatko Pro";
  const city = profile.location_city ?? "";
  const rating = profile.avg_rating ?? 0;
  const jobs = profile.completed_jobs ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#ffffff",
          padding: 60,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 32,
            direction: isRTL ? "rtl" : "ltr",
          }}
        >
          <div
            style={{
              width: 8,
              height: 32,
              background: "#14B8A6",
              borderRadius: 4,
            }}
          />
          <span
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: "#64748b",
              letterSpacing: 0.4,
              ...(titleFont ? { fontFamily: titleFont } : {}),
            }}
          >
            Glatko · Verified Provider
          </span>
        </div>

        <div
          style={{
            display: "flex",
            gap: 32,
            alignItems: "center",
            direction: isRTL ? "rtl" : "ltr",
          }}
        >
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              width={140}
              height={140}
              style={{
                borderRadius: 24,
                border: "2px solid #e2e8f0",
                boxShadow: "0 8px 24px rgba(15,23,42,0.10)",
              }}
              alt=""
            />
          ) : (
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: 24,
                background: "linear-gradient(135deg, #14B8A6, #0EA5E9)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 56,
                fontWeight: 800,
              }}
            >
              {initials(businessName)}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h1
              style={{
                fontSize: 52,
                fontWeight: 700,
                color: "#0f172a",
                margin: 0,
                lineHeight: 1.1,
                ...(titleFont ? { fontFamily: titleFont } : {}),
              }}
            >
              {businessName}
            </h1>
            {city && (
              <p
                style={{
                  fontSize: 26,
                  color: "#475569",
                  margin: 0,
                  ...(titleFont ? { fontFamily: titleFont } : {}),
                }}
              >
                📍 {city}
              </p>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 48,
            marginTop: "auto",
            paddingTop: 32,
            borderTop: "1px solid #e2e8f0",
          }}
        >
          {rating > 0 && (
            <StatBlock value={`★ ${rating.toFixed(1)}`} label="Rating" color="#0EA5E9" />
          )}
          {jobs > 0 && (
            <StatBlock value={String(jobs)} label="Jobs" color="#0EA5E9" />
          )}
          <span
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              fontSize: 28,
              fontWeight: 700,
              color: "#0f172a",
              letterSpacing: -0.5,
            }}
          >
            glatko.app
          </span>
        </div>
      </div>
    ),
    fonts.length > 0 ? { ...size, fonts } : { ...size },
  );
}

function StatBlock({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span
        style={{
          fontSize: 36,
          fontWeight: 700,
          color,
          letterSpacing: -0.5,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 18,
          color: "#94a3b8",
          marginTop: 4,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "G";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
