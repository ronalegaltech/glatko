import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * G-VOICE-1 — behaviour tests for the OpenAI pipeline (DoD #4/#8). The `openai`
 * SDK is FULLY mocked (no real API call, no key needed). Every failure mode is
 * proven by behaviour, not code-read: throw / timeout / malformed / out-of-enum
 * all degrade to null so the route can fall back to the manual form, with no
 * unhandled rejection.
 */

const { mockTranscribe, mockChat } = vi.hoisted(() => ({
  mockTranscribe: vi.fn(),
  mockChat: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class {
    audio = { transcriptions: { create: mockTranscribe } };
    chat = { completions: { create: mockChat } };
  },
}));
vi.mock("@/lib/sentry/glatko-capture", () => ({ glatkoCaptureException: vi.fn() }));

import { transcribeAudio, summarizePhotos, extractProfile } from "./openai";

const fakeAudio = new File(["audio-bytes"], "voice.webm", { type: "audio/webm" });
const SLUGS = ["boat-services", "home-cleaning", "renovation-construction"];

beforeEach(() => {
  process.env.OPENAI_API_KEY = "sk-test-key";
  mockTranscribe.mockReset();
  mockChat.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("transcribeAudio (Whisper)", () => {
  it("happy path → returns text + language", async () => {
    mockTranscribe.mockResolvedValue({ text: "merhaba ben tekneci", language: "tr" });
    const r = await transcribeAudio(fakeAudio);
    expect(r).toEqual({ text: "merhaba ben tekneci", language: "tr" });
    expect(mockTranscribe).toHaveBeenCalledOnce();
  });

  it("no API key → null without calling the SDK", async () => {
    process.env.OPENAI_API_KEY = "";
    const r = await transcribeAudio(fakeAudio);
    expect(r).toBeNull();
    expect(mockTranscribe).not.toHaveBeenCalled();
  });

  it("throw → null (graceful, no unhandled rejection)", async () => {
    mockTranscribe.mockRejectedValue(new Error("network down"));
    await expect(transcribeAudio(fakeAudio)).resolves.toBeNull();
  });

  it("timeout → null", async () => {
    vi.useFakeTimers();
    mockTranscribe.mockImplementation(() => new Promise(() => {})); // never resolves
    const p = transcribeAudio(fakeAudio);
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(p).resolves.toBeNull();
  });
});

describe("summarizePhotos (Vision, optional)", () => {
  it("empty list → null, no SDK call", async () => {
    const r = await summarizePhotos([]);
    expect(r).toBeNull();
    expect(mockChat).not.toHaveBeenCalled();
  });

  it("throw → null (vision is optional, must not break the pipeline)", async () => {
    mockChat.mockRejectedValue(new Error("vision 500"));
    await expect(summarizePhotos(["https://x/y.jpg"])).resolves.toBeNull();
  });

  it("happy path → returns summary text", async () => {
    mockChat.mockResolvedValue({ choices: [{ message: { content: "tekne motoru tamiri" } }] });
    const r = await summarizePhotos(["https://x/y.jpg"]);
    expect(r).toBe("tekne motoru tamiri");
  });
});

describe("extractProfile (strict structured extraction)", () => {
  const valid = {
    display_name: "Marko",
    category_slug: "boat-services",
    sub_services: ["motor tamiri"],
    bio: "Tekne bakımı yapıyorum.",
    service_areas: ["Budva"],
    experience_years: 15,
  };

  it("happy path → parsed profile", async () => {
    mockChat.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(valid) } }] });
    const r = await extractProfile("transcript", "vision", SLUGS);
    expect(r).toEqual(valid);
  });

  it("runs on transcript even when vision summary is null", async () => {
    mockChat.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(valid) } }] });
    const r = await extractProfile("transcript", null, SLUGS);
    expect(r).toEqual(valid);
    expect(mockChat).toHaveBeenCalledOnce();
  });

  it("empty slug list → null without SDK call (no enum = unsafe)", async () => {
    const r = await extractProfile("t", null, []);
    expect(r).toBeNull();
    expect(mockChat).not.toHaveBeenCalled();
  });

  it("malformed JSON → null (graceful)", async () => {
    mockChat.mockResolvedValue({ choices: [{ message: { content: "{not json" } }] });
    await expect(extractProfile("t", null, SLUGS)).resolves.toBeNull();
  });

  it("out-of-enum category → null (defense-in-depth)", async () => {
    mockChat.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ ...valid, category_slug: "made-up-slug" }) } }],
    });
    await expect(extractProfile("t", null, SLUGS)).resolves.toBeNull();
  });

  it("throw → null", async () => {
    mockChat.mockRejectedValue(new Error("extract 429"));
    await expect(extractProfile("t", null, SLUGS)).resolves.toBeNull();
  });

  it("injects the live slugs as the schema enum", async () => {
    mockChat.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(valid) } }] });
    await extractProfile("t", null, SLUGS);
    const callArg = mockChat.mock.calls[0][0];
    expect(callArg.response_format.type).toBe("json_schema");
    expect(callArg.response_format.json_schema.strict).toBe(true);
    expect(callArg.response_format.json_schema.schema.properties.category_slug.enum).toEqual(SLUGS);
    expect(callArg.response_format.json_schema.schema.additionalProperties).toBe(false);
  });
});
