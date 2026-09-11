import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { getFontsForLocale } from "@/lib/seo/og-fonts";

export const runtime = "edge";
export const alt = "Glatko Founding Provider";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND_BG =
  "linear-gradient(135deg, #0b1f23 0%, #1a1004 50%, #0b1f23 100%)";
const AMBER = "#F59E0B";

/**
 * G-LAUNCH-1 — Founding Provider landing OG. Amber-tinted gradient
 * (matching the in-page hero) with localized title + Founding Program
 * eyebrow. Arabic fonts via getFontsForLocale, no EN fallback.
 */
export default async function FoundingProviderOG({
  params,
}: {
  params: { locale: string };
}) {
  const isRTL = params.locale === "ar";
  const t = await getTranslations({
    locale: params.locale,
    namespace: "founding.pro",
  });
  const eyebrow = t("hero.eyebrow");
  const title = t("hero.title");

  const fonts = await getFontsForLocale(params.locale);
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
              "radial-gradient(ellipse 70% 50% at 50% 35%, rgba(245,158,11,0.28), transparent 70%)",
          }}
        />

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
                background: "#14B8A6",
                marginTop: 6,
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                display: "flex",
                alignSelf: isRTL ? "flex-end" : "flex-start",
                padding: "8px 20px",
                borderRadius: 999,
                background: "rgba(245,158,11,0.18)",
                border: `1px solid ${AMBER}66`,
                color: "#FCD34D",
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase",
                ...(titleFontFamily ? { fontFamily: titleFontFamily } : {}),
              }}
            >
              {eyebrow}
            </div>
            <div
              style={{
                display: "flex",
                color: "white",
                fontSize: 88,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: isRTL ? 0 : -1.5,
                maxWidth: 1040,
                textShadow: "0 4px 32px rgba(0,0,0,0.6)",
                ...(titleFontFamily ? { fontFamily: titleFontFamily } : {}),
              }}
            >
              {title}
            </div>
          </div>

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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 22px",
                borderRadius: 999,
                background:
                  "linear-gradient(90deg, rgba(245,158,11,0.85), rgba(252,211,77,0.85))",
                color: "#1f1003",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 0.4,
              }}
            >
              50 / 50
            </div>
          </div>
        </div>
      </div>
    ),
    fonts.length > 0 ? { ...size, fonts } : { ...size },
  );
}
