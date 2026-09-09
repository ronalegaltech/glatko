import { describe, expect, it } from "vitest";
import { classifyConfirmFailure, resolveConfirmNext } from "./confirm";

const SITE = "https://glatko.app";

describe("classifyConfirmFailure", () => {
  it("treats GoTrue's expired/invalid link message as routine", () => {
    // The exact shape supabase-js hands back for a dead token_hash — this is
    // the Sentry issue the classifier exists to demote.
    expect(
      classifyConfirmFailure({
        name: "AuthApiError",
        message: "Email link is invalid or has expired",
        status: 403,
        code: "otp_expired",
      }),
    ).toBe("expired-or-used");
  });

  it("matches on message alone when no code is set", () => {
    expect(
      classifyConfirmFailure({ message: "Token has expired or is invalid" }),
    ).toBe("expired-or-used");
  });

  it("keeps unexpected failures at error severity", () => {
    expect(classifyConfirmFailure({ message: "fetch failed" })).toBe(
      "verify-failed",
    );
    expect(classifyConfirmFailure(new Error("Database is unavailable"))).toBe(
      "verify-failed",
    );
    expect(classifyConfirmFailure(null)).toBe("verify-failed");
    expect(classifyConfirmFailure(undefined)).toBe("verify-failed");
  });
});

describe("resolveConfirmNext", () => {
  it("unwraps the absolute /auth/callback url supabase-js sends", () => {
    // register/page.tsx: emailRedirectTo = `${origin}/auth/callback?next=…`
    expect(
      resolveConfirmNext(
        `${SITE}/auth/callback?next=${encodeURIComponent("/tr/become-a-pro")}`,
        SITE,
      ),
    ).toBe("/tr/become-a-pro");
  });

  it("drops a callback url with no inner next", () => {
    expect(resolveConfirmNext(`${SITE}/auth/callback`, SITE)).toBeNull();
  });

  it("keeps a plain same-origin path", () => {
    expect(resolveConfirmNext(`${SITE}/tr/pro/dashboard`, SITE)).toBe(
      "/tr/pro/dashboard",
    );
  });

  it("still accepts a relative redirect_to", () => {
    expect(resolveConfirmNext("/me/requests", SITE)).toBe("/me/requests");
  });

  it("rejects another origin", () => {
    expect(resolveConfirmNext("https://evil.example/steal", SITE)).toBeNull();
    expect(
      resolveConfirmNext(
        `https://evil.example/auth/callback?next=${encodeURIComponent("/tr")}`,
        SITE,
      ),
    ).toBeNull();
  });

  it("rejects open-redirect shapes inside the inner next", () => {
    expect(
      resolveConfirmNext(
        `${SITE}/auth/callback?next=${encodeURIComponent("//evil.example")}`,
        SITE,
      ),
    ).toBeNull();
    expect(
      resolveConfirmNext(
        `${SITE}/auth/callback?next=${encodeURIComponent("/\\evil.example")}`,
        SITE,
      ),
    ).toBeNull();
    expect(resolveConfirmNext("//evil.example", SITE)).toBeNull();
  });

  it("returns null for missing or unparseable input", () => {
    expect(resolveConfirmNext(undefined, SITE)).toBeNull();
    expect(resolveConfirmNext("", SITE)).toBeNull();
    expect(resolveConfirmNext("not a url", SITE)).toBeNull();
  });
});
