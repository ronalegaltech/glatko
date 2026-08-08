// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

/**
 * G-VOICE-1 — component render tests (DoD #1/#2/#10), the RUNTIME proof of the
 * two guarantees that matter most: (a) flag OFF → the wrapper renders ONLY the
 * manual slot (non-regression, stronger than git-diff), and (b) switching tabs
 * keeps the manual slot MOUNTED (no state loss / no unmount).
 *
 * jsdom env via the docblock above (node tests elsewhere are unaffected). The
 * heavy server subtree pulled transitively by OnboardingReview is mocked so the
 * render stays a pure client-UI check.
 */

vi.mock("@/lib/actions/phone", () => ({
  startPhoneVerification: vi.fn(),
  confirmPhoneOtp: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { ProOnboardingTabs } from "@/components/glatko/pro-voice/ProOnboardingTabs";
import { OnboardingReview } from "@/components/glatko/pro-voice/OnboardingReview";
import type { VoiceDraftResult } from "@/lib/pro-voice/types";
import type { ServiceCategory } from "@/types/glatko";

const messages = JSON.parse(
  readFileSync(path.resolve(__dirname, "../dictionaries/tr.json"), "utf8"),
);
const el = React.createElement;
const wrap = (node: React.ReactNode) =>
  el(NextIntlClientProvider, { locale: "tr", messages, children: node });

afterEach(cleanup);

describe("ProOnboardingTabs — flag gating + non-regression (DoD #1/#10)", () => {
  function renderTabs(voiceEnabled: boolean) {
    return render(
      wrap(
        el(ProOnboardingTabs, {
          voiceEnabled,
          categories: [],
          manualSlot: el("div", { "data-testid": "manual" }, "MANUAL WIZARD"),
        }),
      ),
    );
  }

  it("flag OFF → ONLY the manual slot, no tab bar at all", () => {
    renderTabs(false);
    expect(screen.getByTestId("manual")).toBeTruthy();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("flag ON → two tabs + manual content + 'daha kolay' badge", () => {
    renderTabs(true);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByTestId("manual")).toBeTruthy();
    expect(screen.getByText("daha kolay")).toBeTruthy();
  });

  it("tab switch → manual STAYS MOUNTED (same DOM node, no unmount)", () => {
    renderTabs(true);
    const manualBefore = screen.getByTestId("manual");
    fireEvent.click(screen.getAllByRole("tab")[1]); // → voice tab
    const manualAfter = screen.getByTestId("manual");
    expect(manualAfter).toBe(manualBefore); // identical node = never remounted
  });

  it("flag ON → voice capture renders the audio-file fallback input (DoD #2)", () => {
    renderTabs(true);
    expect(screen.getByText("Ses dosyası yükle")).toBeTruthy();
    // record button exposes its name via aria-label (icon-only button)
    expect(screen.getByLabelText("Kaydı başlat")).toBeTruthy();
  });
});

describe("OnboardingReview — pre-fill + editable (DoD #7 UI)", () => {
  const draft: VoiceDraftResult = {
    draftId: "d1",
    profile: {
      display_name: "Marko",
      category_slug: "boat-services",
      sub_services: ["motor"],
      bio: "Tekne bakımı yapıyorum.",
      service_areas: ["Budva"],
      experience_years: 15,
    },
    photoUrls: [],
    transcript: "...",
    detectedLanguage: "sr",
  };
  const cats: ServiceCategory[] = [
    {
      id: "c1",
      parent_id: null,
      slug: "boat-services",
      name: { tr: "Tekne hizmetleri", en: "Boat services" },
      description: null,
      icon: null,
      sort_order: 1,
      is_active: true,
    },
  ];

  it("pre-fills fields from the draft and lets them be edited", () => {
    render(
      wrap(
        el(OnboardingReview, {
          draft,
          categories: cats,
          onBack: vi.fn(),
          onFallbackToManual: vi.fn(),
        }),
      ),
    );
    const nameInput = screen.getByDisplayValue("Marko") as HTMLInputElement;
    expect(nameInput).toBeTruthy();
    expect(screen.getByDisplayValue("Tekne bakımı yapıyorum.")).toBeTruthy();
    expect(screen.getByDisplayValue("15")).toBeTruthy();
    // editable
    fireEvent.change(nameInput, { target: { value: "Marko Marković" } });
    expect(screen.getByDisplayValue("Marko Marković")).toBeTruthy();
    // confirm disabled until phone verified (OTP gate UI)
    const confirmBtn = screen.getByText("Tamam, bu benim").closest("button") as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });
});
