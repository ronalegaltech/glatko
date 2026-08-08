import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * G-VOICE-1 — POST /api/pro-onboarding/confirm handler tests (DoD #7). Proves
 * the OTP gate (412 unless phone_verified), ownership/expiry enforcement, bio→TR
 * translation, and the glatko_admin_create_provider payload shape. Supabase,
 * drafts, categories, translation are mocked — no real RPC, no prod write.
 */

const h = vi.hoisted(() => ({
  state: {
    user: { id: "u1" } as { id: string } | null,
    existingPro: null as null | { id: string },
    profile: { phone: "+38267123456", phone_verified: true, full_name: "Marko M", preferred_locale: "tr" } as
      | { phone: string | null; phone_verified: boolean; full_name: string | null; preferred_locale: string | null }
      | null,
    flagOn: true,
  },
  rpc: vi.fn(),
  getOwnedDraft: vi.fn(),
  markDraftConfirmed: vi.fn(),
  getRootCategories: vi.fn(),
  resolveCategoryId: vi.fn(),
  translateMessage: vi.fn(),
}));

vi.mock("@/lib/pro-voice/flags", () => ({ isVoiceOnboardingEnabled: () => h.state.flagOn }));
vi.mock("@/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: h.state.user } }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: table === "profiles" ? h.state.profile : h.state.existingPro }),
        }),
      }),
    }),
  }),
  createAdminClient: () => ({ rpc: h.rpc }),
}));
vi.mock("@/lib/pro-voice/drafts", () => ({
  getOwnedDraft: h.getOwnedDraft,
  markDraftConfirmed: h.markDraftConfirmed,
}));
vi.mock("@/lib/pro-voice/categories", () => ({
  getRootCategories: h.getRootCategories,
  resolveCategoryId: h.resolveCategoryId,
}));
vi.mock("@/lib/ai/translate-message", () => ({ translateMessage: h.translateMessage }));

import { POST } from "@/app/api/pro-onboarding/confirm/route";

const EDITS = {
  display_name: "Marko",
  category_slug: "boat-services",
  sub_services: ["motor"],
  bio: "Original bio in Serbian",
  service_areas: ["Budva", "Tivat"],
  experience_years: 15,
};
const DRAFT = {
  id: "d1",
  user_id: "u1",
  status: "draft",
  detected_language: "sr",
  transcript: "...",
  extracted: EDITS,
  photo_urls: ["https://cdn/p0.jpg"],
  audio_url: null,
  phone: null,
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
};

function req(body: unknown): Request {
  return new Request("http://localhost/api/pro-onboarding/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  h.state.user = { id: "u1" };
  h.state.existingPro = null;
  h.state.profile = { phone: "+38267123456", phone_verified: true, full_name: "Marko M", preferred_locale: "tr" };
  h.state.flagOn = true;
  h.rpc.mockReset().mockResolvedValue({ data: { success: true, provider_id: "u1", slug: "marko-ab12" }, error: null });
  h.getOwnedDraft.mockReset().mockResolvedValue(DRAFT);
  h.markDraftConfirmed.mockReset().mockResolvedValue(undefined);
  h.getRootCategories.mockReset().mockResolvedValue([]);
  h.resolveCategoryId.mockReset().mockReturnValue("cat-uuid");
  h.translateMessage.mockReset().mockResolvedValue({ translatedContent: "TR bio", detectedLocale: "sr" });
});

describe("guards", () => {
  it("flag off → 404", async () => {
    h.state.flagOn = false;
    expect((await POST(req({ draftId: "d1", edits: EDITS }))).status).toBe(404);
  });
  it("no session → 401", async () => {
    h.state.user = null;
    expect((await POST(req({ draftId: "d1", edits: EDITS }))).status).toBe(401);
  });
  it("invalid payload (no draftId) → 400", async () => {
    expect((await POST(req({ edits: EDITS }))).status).toBe(400);
  });
  it("invalid payload (bad edits) → 400", async () => {
    expect((await POST(req({ draftId: "d1", edits: { display_name: 5 } }))).status).toBe(400);
  });
  it("already a pro → 409", async () => {
    h.state.existingPro = { id: "u1" };
    expect((await POST(req({ draftId: "d1", edits: EDITS }))).status).toBe(409);
  });
});

describe("OTP gate (DoD #7)", () => {
  it("phone NOT verified → 412, no RPC", async () => {
    h.state.profile = { phone: null, phone_verified: false, full_name: "Marko", preferred_locale: "tr" };
    const res = await POST(req({ draftId: "d1", edits: EDITS }));
    expect(res.status).toBe(412);
    expect(await res.json()).toEqual({ error: "phone_not_verified" });
    expect(h.rpc).not.toHaveBeenCalled();
  });
});

describe("ownership / expiry", () => {
  it("draft not found / not owned → 404", async () => {
    h.getOwnedDraft.mockResolvedValue({ error: "not_found" });
    expect((await POST(req({ draftId: "d1", edits: EDITS }))).status).toBe(404);
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it("expired draft → 410", async () => {
    h.getOwnedDraft.mockResolvedValue({ error: "expired" });
    expect((await POST(req({ draftId: "d1", edits: EDITS }))).status).toBe(410);
  });
});

describe("category resolution", () => {
  it("unknown slug → 422, no RPC", async () => {
    h.resolveCategoryId.mockReturnValue(null);
    expect((await POST(req({ draftId: "d1", edits: EDITS }))).status).toBe(422);
    expect(h.rpc).not.toHaveBeenCalled();
  });
});

describe("happy path → provider creation", () => {
  it("200 + correct RPC payload + bio translated + draft confirmed", async () => {
    const res = await POST(req({ draftId: "d1", edits: EDITS }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, providerId: "u1" });

    expect(h.rpc).toHaveBeenCalledOnce();
    const [fnName, args] = h.rpc.mock.calls[0];
    expect(fnName).toBe("glatko_admin_create_provider");
    const payload = (args as { payload: Record<string, unknown> }).payload;
    expect(payload).toMatchObject({
      user_id: "u1",
      phone: "+38267123456",
      bio: "TR bio", // translated, not the original
      business_name: "Marko",
      full_name: "Marko",
      is_verified: false,
      verification_status: "pending",
      is_active: true,
      portfolio_images: ["https://cdn/p0.jpg"],
      languages: ["sr"], // from draft.detected_language
      years_experience: "15",
      services: [{ category_id: "cat-uuid", is_primary: true }],
      city_display: "Budva",
    });
    expect(typeof payload.slug).toBe("string");
    expect(payload.slug as string).toMatch(/^marko-[a-z0-9]{4}$/);

    expect(h.markDraftConfirmed).toHaveBeenCalledWith("d1", "+38267123456");
  });

  it("translation unavailable → keeps original bio (graceful)", async () => {
    h.translateMessage.mockResolvedValue(null);
    await POST(req({ draftId: "d1", edits: EDITS }));
    const payload = (h.rpc.mock.calls[0][1] as { payload: Record<string, unknown> }).payload;
    expect(payload.bio).toBe("Original bio in Serbian");
  });

  it("DUPLICATE_PRO from RPC → 409", async () => {
    h.rpc.mockResolvedValue({ data: { success: false, code: "DUPLICATE_PRO" }, error: null });
    expect((await POST(req({ draftId: "d1", edits: EDITS }))).status).toBe(409);
  });
});
