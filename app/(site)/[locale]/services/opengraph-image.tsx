import { ImageResponse } from "next/og";
import { getFontsForLocale } from "@/lib/seo/og-fonts";

export const runtime = "edge";
export const alt = "Glatko Services";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND_BG = "linear-gradient(135deg, #0b1f23 0%, #0a1a18 50%, #0b1f23 100%)";
const TEAL = "#14B8A6";

const HEADINGS: Record<string, string> = {
  me: "Sve usluge",
  sr: "Sve usluge",
  en: "All services",
  tr: "Tüm hizmetler",
  de: "Alle Dienstleistungen",
  it: "Tutti i servizi",
  ru: "Все услуги",
  ar: "جميع الخدمات",
  uk: "Всі послуги",
};

const SUBLINES: Record<string, string> = {
  me: "Premium servisna platforma Crne Gore",
  sr: "Premium servisna platforma Crne Gore",
  en: "Premium service marketplace for Montenegro",
  tr: "Karadağ'ın premium hizmet platformu",
  de: "Premium-Service-Plattform für Montenegro",
  it: "Piattaforma di servizi premium per il Montenegro",
  ru: "Премиум-платформа услуг для Черногории",
  ar: "منصة خدمات متميزة للجبل الأسود",
  uk: "Преміум-платформа послуг для Чорногорії",
};

export default async function ServicesOG({
  params,
}: {
  params: { locale: string };
}) {
  const isRTL = params.locale === "ar";
  const heading = HEADINGS[params.locale] || HEADINGS.en;
  const subline = SUBLINES[params.locale] || SUBLINES.en;
  const fonts = await getFontsForLocale(params.locale);
  // Override fontFamily only for ar; Latin/Cyrillic inherit Satori default
  // (passing an explicit value makes Satori's lookup miss and silently
  // emit 0-byte PNGs).
  const localizedFontFamily = isRTL ? '"Noto Sans Arabic"' : undefined;

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
                background: TEAL,
                marginTop: 6,
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                display: "flex",
                color: "white",
                fontSize: 96,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: isRTL ? 0 : -2,
                ...(localizedFontFamily ? { fontFamily: localizedFontFamily } : {}),
              }}
            >
              {heading}
            </div>
            <div
              style={{
                display: "flex",
                color: "rgba(255,255,255,0.65)",
                fontSize: 30,
                fontWeight: 500,
                letterSpacing: 0.2,
                maxWidth: 880,
                ...(localizedFontFamily ? { fontFamily: localizedFontFamily } : {}),
              }}
            >
              {subline}
            </div>
          </div>

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
        </div>
      </div>
    ),
    fonts.length > 0 ? { ...size, fonts } : { ...size },
  );
}
