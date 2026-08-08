import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * G-VOICE-1 — POST /api/pro-onboarding/voice handler tests (DoD #2/#3/#4/#8).
 * Supabase, storage, OpenAI pipeline, drafts are ALL mocked — no real call, no
 * real insert. Validation boundaries (size/count/mime — DoD #4 helpers) are
 * exercised black-box through the handler (the validators are inline; we do not
 * add exports to app code).
 */

const h = vi.hoisted(() => ({
  state: {
    user: { id: "u1" } as { id: string } | null,
    existingPro: null as null | { id: string },
    flagOn: true,
  },
  uploadVoiceAudio: vi.fn(),
  uploadVoicePhoto: vi.fn(),
  deleteVoiceAudio: vi.fn(),
  transcribeAudio: vi.fn(),
  summarizePhotos: vi.fn(),
  extractProfile: vi.fn(),
  getRootCategorySlugs: vi.fn(),
  insertDraft: vi.fn(),
}));

vi.mock("@/lib/pro-voice/flags", () => ({ isVoiceOnboardingEnabled: () => h.state.flagOn }));
vi.mock("@/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: h.state.user } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.state.existingPro }) }) }),
    }),
  }),
  createAdminClient: () => ({}),
}));
vi.mock("@/lib/pro-voice/storage", () => ({
  uploadVoiceAudio: h.uploadVoiceAudio,
  uploadVoicePhoto: h.uploadVoicePhoto,
  deleteVoiceAudio: h.deleteVoiceAudio,
}));
vi.mock("@/lib/pro-voice/openai", () => ({
  transcribeAudio: h.transcribeAudio,
  summarizePhotos: h.summarizePhotos,
  extractProfile: h.extractProfile,
}));
vi.mock("@/lib/pro-voice/categories", () => ({ getRootCategorySlugs: h.getRootCategorySlugs }));
vi.mock("@/lib/pro-voice/drafts", () => ({ insertDraft: h.insertDraft }));

import { POST } from "@/app/api/pro-onboarding/voice/route";

const VALID_PROFILE = {
  display_name: "Marko",
  category_slug: "boat-services",
  sub_services: ["motor"],
  bio: "Tekne bakımı.",
  service_areas: ["Budva"],
  experience_years: 15,
};

function audio(type = "audio/webm", bytes = 1000): File {
  return new File([new Uint8Array(bytes)], "voice.webm", { type });
}
function photo(type = "image/jpeg", bytes = 1000): File {
  return new File([new Uint8Array(bytes)], "p.jpg", { type });
}
function req(fd: FormData): Request {
  return new Request("http://localhost/api/pro-onboarding/voice", { method: "POST", body: fd });
}

beforeEach(() => {
  h.state.user = { id: "u1" };
  h.state.existingPro = null;
  h.state.flagOn = true;
  for (const k of ["uploadVoiceAudio", "uploadVoicePhoto", "deleteVoiceAudio", "transcribeAudio", "summarizePhotos", "extractProfile", "getRootCategorySlugs", "insertDraft"] as const) {
    h[k].mockReset();
  }
  // happy-path defaults (individual tests override)
  h.uploadVoiceAudio.mockResolvedValue("u1/d/audio.webm");
  h.uploadVoicePhoto.mockImplementation(async (_u: string, _d: string, _f: File, i: number) => `https://cdn/p${i}.jpg`);
  h.deleteVoiceAudio.mockResolvedValue(undefined);
  h.transcribeAudio.mockResolvedValue({ text: "merhaba ben tekneci", language: "tr" });
  h.summarizePhotos.mockResolvedValue("tekne işleri");
  h.extractProfile.mockResolvedValue(VALID_PROFILE);
  h.getRootCategorySlugs.mockResolvedValue(["boat-services", "home-cleaning"]);
  h.insertDraft.mockResolvedValue(undefined);
});

describe("guards", () => {
  it("flag off → 404", async () => {
    h.state.flagOn = false;
    const fd = new FormData();
    fd.append("audio", audio());
    expect((await POST(req(fd))).status).toBe(404);
  });

  it("no session → 401", async () => {
    h.state.user = null;
    const fd = new FormData();
    fd.append("audio", audio());
    expect((await POST(req(fd))).status).toBe(401);
  });

  it("already a pro → 409", async () => {
    h.state.existingPro = { id: "u1" };
    const fd = new FormData();
    fd.append("audio", audio());
    expect((await POST(req(fd))).status).toBe(409);
  });
});

describe("input validation", () => {
  it("no audio field → 400 no_audio", async () => {
    const res = await POST(req(new FormData()));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "no_audio" });
  });

  it("non-audio mime → 400 no_audio", async () => {
    const fd = new FormData();
    fd.append("audio", audio("application/pdf"));
    expect((await POST(req(fd))).status).toBe(400);
  });

  it("oversize audio (20MB+1) → 413", async () => {
    const fd = new FormData();
    fd.append("audio", audio("audio/webm", 20 * 1024 * 1024 + 1));
    const res = await POST(req(fd));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "audio_too_large" });
  });

  it(">5 photos → 400 too_many_photos", async () => {
    const fd = new FormData();
    fd.append("audio", audio());
    for (let i = 0; i < 6; i++) fd.append("photos", photo());
    const res = await POST(req(fd));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "too_many_photos" });
  });

  it("bad photo mime → 400 invalid_file_type", async () => {
    const fd = new FormData();
    fd.append("audio", audio());
    fd.append("photos", photo("image/gif"));
    const res = await POST(req(fd));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_file_type" });
  });

  it("photo too large (>10MB) → 413 photo_too_large", async () => {
    const fd = new FormData();
    fd.append("audio", audio());
    fd.append("photos", photo("image/jpeg", 10 * 1024 * 1024 + 1));
    expect((await POST(req(fd))).status).toBe(413);
  });

  it("boundary: exactly 5 photos accepted → 200", async () => {
    const fd = new FormData();
    fd.append("audio", audio());
    for (let i = 0; i < 5; i++) fd.append("photos", photo());
    expect((await POST(req(fd))).status).toBe(200);
  });
});

describe("happy path", () => {
  it("200 + inserts draft with correct payload + cleans temp audio", async () => {
    const fd = new FormData();
    fd.append("audio", audio());
    fd.append("photos", photo());
    fd.append("photos", photo());
    const res = await POST(req(fd));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      profile: VALID_PROFILE,
      transcript: "merhaba ben tekneci",
      detectedLanguage: "tr",
      photoUrls: ["https://cdn/p0.jpg", "https://cdn/p1.jpg"],
    });
    expect(typeof body.draftId).toBe("string");

    expect(h.insertDraft).toHaveBeenCalledOnce();
    const draftArg = h.insertDraft.mock.calls[0][0];
    expect(draftArg).toMatchObject({
      userId: "u1",
      detectedLanguage: "tr",
      transcript: "merhaba ben tekneci",
      extracted: VALID_PROFILE,
      photoUrls: ["https://cdn/p0.jpg", "https://cdn/p1.jpg"],
      audioPath: null,
    });
    expect(typeof draftArg.id).toBe("string");
    // whisper + vision both invoked (route runs them in parallel)
    expect(h.transcribeAudio).toHaveBeenCalledOnce();
    expect(h.summarizePhotos).toHaveBeenCalledOnce();
    // temp audio removed after success
    expect(h.deleteVoiceAudio).toHaveBeenCalled();
  });
});

describe("pipeline failure → graceful 503 (no fake data, audio cleaned)", () => {
  it("whisper null → 503 pipeline_failed", async () => {
    h.transcribeAudio.mockResolvedValue(null);
    const fd = new FormData();
    fd.append("audio", audio());
    const res = await POST(req(fd));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "pipeline_failed" });
    expect(h.insertDraft).not.toHaveBeenCalled();
    expect(h.deleteVoiceAudio).toHaveBeenCalled();
  });

  it("extraction null → 503 pipeline_failed", async () => {
    h.extractProfile.mockResolvedValue(null);
    const fd = new FormData();
    fd.append("audio", audio());
    expect((await POST(req(fd))).status).toBe(503);
    expect(h.insertDraft).not.toHaveBeenCalled();
  });

  it("vision null but transcript ok → still 200 (vision optional)", async () => {
    h.summarizePhotos.mockResolvedValue(null);
    const fd = new FormData();
    fd.append("audio", audio());
    expect((await POST(req(fd))).status).toBe(200);
  });
});
