import { ImageResponse } from "next/og";
import { getCategoryBySlug } from "@/lib/supabase/glatko.server";
import { getFontsForLocale } from "@/lib/seo/og-fonts";

export const runtime = "edge";
export const alt = "Glatko Service Category";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND_BG = "linear-gradient(135deg, #0b1f23 0%, #0a1a18 50%, #0b1f23 100%)";
const TEAL = "#14B8A6";

function pickName(name: Record<string, string> | null, locale: string, slug: string) {
  if (!name) return slug;
  return name[locale] || name.en || slug;
}

/**
 * Per-category dynamic OG. Brand-tinted gradient + radial glow as the
 * canvas, category name in the user's locale, glatko.app domain +
 * optional seasonal pill at the bottom.
 *
 * Latin + Cyrillic locales render with Satori's default font. The ar
 * locale gets a Noto Sans Arabic buffer loaded via getFontsForLocale —
 * no English fallback (memory item 25: 9 dil eksiksiz).
 */
export default async function CategoryOG({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  const category = await getCategoryBySlug(params.slug);
  const isRTL = params.locale === "ar";

  const title = category
    ? pickName(category.name, params.locale, category.slug)
    : "Glatko";
  const seasonal = category?.seasonal ?? null;
  const fonts = await getFontsForLocale(params.locale);
  // Override fontFamily only for ar; Latin/Cyrillic locales inherit
  // Satori's bundled font from the outer div (passing an explicit value
  // makes Satori's lookup miss and silently emit 0-byte PNGs).
  const titleFontFamily = isRTL ? '"Noto Sans Arabic"' : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BRAND_BG,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 70% 50% at 50% 35%, rgba(20,184,166,0.22), transparent 70%)",
          }}
        />

        {/* Foreground content */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 80,
            direction: isRTL ? "rtl" : "ltr",
          }}
        >
          {/* Top: Glatko brand (Latin glyphs — inherit Satori default) */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              style={{
                color: "white",
                fontSize: 44,
                fontWeight: 700,
                letterSpacing: -1,
              }}
            >
              Glatko
            </span>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: TEAL,
                marginTop: 6,
              }}
            />
          </div>

          {/* Middle: localized category name (Arabic font when ar, else inherit). */}
          <div
            style={{
              display: "flex",
              color: "white",
              fontSize: 92,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: isRTL ? 0 : -1.5,
              maxWidth: 980,
              textShadow: "0 4px 32px rgba(0,0,0,0.6)",
              ...(titleFontFamily ? { fontFamily: titleFontFamily } : {}),
            }}
          >
            {title}
          </div>

          {/* Bottom: domain + seasonal pill (both Latin — inherit) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: 28,
                fontWeight: 500,
                letterSpacing: 0.2,
              }}
            >
              glatko.app
            </span>
            {seasonal ? (
              <div
                style={{
                  display: "flex",
                  padding: "10px 22px",
                  borderRadius: 999,
                  background: "rgba(20,184,166,0.18)",
                  border: "1px solid rgba(20,184,166,0.45)",
                  color: "#5EEAD4",
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: 0.4,
                }}
              >
                {seasonal === "summer" ? "🌊" : seasonal === "winter" ? "❄️" : "•"}{" "}
                {seasonal.toUpperCase()}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    fonts.length > 0 ? { ...size, fonts } : { ...size },
  );
}
