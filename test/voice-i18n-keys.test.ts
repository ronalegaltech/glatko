import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * G-VOICE-1 — deep i18n key-existence (DoD #9). Every t("...") key referenced by
 * the 4 voice components MUST exist (non-empty string) in ALL 9 locale
 * dictionaries under pro.voice. A missing key = a runtime throw (no EN fallback)
 * that breaks /become-a-pro — this test closes that risk directly.
 */

const ROOT = path.resolve(__dirname, "..");
const LOCALES = ["tr", "en", "de", "it", "me", "ru", "sr", "ar", "uk"] as const;
const COMPONENT_FILES = ["ProOnboardingTabs", "VoiceFlow", "VoiceOnboarding", "OnboardingReview"].map(
  (f) => path.join(ROOT, "components/glatko/pro-voice", `${f}.tsx`),
);

// All four components scope to useTranslations("pro.voice"), so keys are relative.
function referencedKeys(): string[] {
  const keys = new Set<string>();
  const re = /\bt\(\s*"([^"]+)"/g;
  for (const file of COMPONENT_FILES) {
    const src = readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) keys.add(m[1]);
  }
  return Array.from(keys).sort();
}

function loadDict(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(ROOT, "dictionaries", `${locale}.json`), "utf8"));
}

function resolve(dict: Record<string, unknown>, dottedKey: string): unknown {
  let node: unknown = dict;
  for (const part of ["pro", "voice", ...dottedKey.split(".")]) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

describe("voice i18n keys exist in all 9 locales", () => {
  const keys = referencedKeys();

  it("extracts a non-trivial key set from the components", () => {
    expect(keys.length).toBeGreaterThanOrEqual(40);
  });

  for (const locale of LOCALES) {
    it(`${locale}: every referenced pro.voice.* key is a non-empty string`, () => {
      const dict = loadDict(locale);
      const missing: string[] = [];
      for (const key of keys) {
        const val = resolve(dict, key);
        if (typeof val !== "string" || val.trim() === "") missing.push(key);
      }
      expect(missing, `Missing/empty in ${locale}.json: ${missing.join(", ")}`).toEqual([]);
    });
  }

  it("all 9 locales expose the same pro.voice leaf-key set (parity)", () => {
    function leaves(obj: unknown, prefix = ""): string[] {
      if (typeof obj !== "object" || obj === null) return [prefix];
      return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
        leaves(v, prefix ? `${prefix}.${k}` : k),
      );
    }
    const sets = LOCALES.map((l) => {
      const pro = loadDict(l).pro as Record<string, unknown>;
      const voice = pro.voice as Record<string, unknown>;
      return leaves(voice).sort().join("|");
    });
    expect(new Set(sets).size, "all locales must share one identical leaf-key set").toBe(1);
  });
});
