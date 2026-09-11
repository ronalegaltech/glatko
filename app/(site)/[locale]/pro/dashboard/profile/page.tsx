"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { User, DollarSign, Camera, Layers, Save } from "lucide-react";
import { toast } from "sonner";
import { ProgressBar } from "@tremor/react";
import { getProfileAction, updateProfileAction, getProfileCompletenessAction } from "../actions";

type Tab = "personal" | "pricing" | "portfolio" | "services";

interface ProfileData {
  business_name: string | null;
  bio: string | null;
  phone: string | null;
  location_city: string | null;
  languages: string[];
  years_experience: number | null;
  hourly_rate_min: number | null;
  hourly_rate_max: number | null;
  portfolio_images: string[];
}

const LANGUAGES = ["tr", "en", "de", "it", "ru", "uk", "sr", "me", "ar"];

export default function ProfileEditPage() {
  const t = useTranslations();
  const [tab, setTab] = useState<Tab>("personal");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [completeness, setCompleteness] = useState<{ score: number; missing: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [langs, setLangs] = useState<string[]>([]);
  const [exp, setExp] = useState("");
  const [rateMin, setRateMin] = useState("");
  const [rateMax, setRateMax] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        getProfileAction(),
        getProfileCompletenessAction(),
      ]);
      if (p) {
        setProfile(p as ProfileData);
        setName(p.business_name || "");
        setBio(p.bio || "");
        setPhone(p.phone || "");
        setCity(p.location_city || "");
        setLangs(p.languages || []);
        setExp(p.years_experience != null ? String(p.years_experience) : "");
        setRateMin(p.hourly_rate_min != null ? String(p.hourly_rate_min) : "");
        setRateMax(p.hourly_rate_max != null ? String(p.hourly_rate_max) : "");
      }
      setCompleteness(c);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {};
      if (tab === "personal") {
        updates.business_name = name || undefined;
        updates.bio = bio || undefined;
        updates.phone = phone || undefined;
        updates.location_city = city || undefined;
        updates.languages = langs;
        updates.years_experience = exp ? parseInt(exp, 10) : undefined;
      } else if (tab === "pricing") {
        updates.hourly_rate_min = rateMin ? parseFloat(rateMin) : undefined;
        updates.hourly_rate_max = rateMax ? parseFloat(rateMax) : undefined;
      }
      await updateProfileAction(updates as Parameters<typeof updateProfileAction>[0]);
      toast.success(t("proProfile.saved"));
      const c = await getProfileCompletenessAction();
      setCompleteness(c);
    } catch {
      toast.error("Error");
    } finally {
      setSaving(false);
    }
  }

  const tabs: { key: Tab; icon: typeof User; label: string }[] = [
    { key: "personal", icon: User, label: t("proProfile.personalInfo") },
    { key: "pricing", icon: DollarSign, label: t("proProfile.pricing") },
    { key: "portfolio", icon: Camera, label: t("proProfile.portfolio") },
    { key: "services", icon: Layers, label: t("proProfile.serviceAreas") },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-2xl text-gray-900 dark:text-white md:text-3xl">
          {t("proProfile.title")}
        </h1>
        {completeness && (
          <div className="w-48">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-white/40">{t("proAnalytics.profileCompleteness")}</span>
              <span className="text-teal-600 dark:text-teal-400">{completeness.score}%</span>
            </div>
            <ProgressBar value={completeness.score} color="teal" />
          </div>
        )}
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto">
        {tabs.map((tb) => {
          const Icon = tb.icon;
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                tab === tb.key
                  ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30"
                  : "border border-gray-200 text-gray-500 hover:text-gray-700 dark:border-white/[0.06] dark:text-white/40 dark:hover:text-white/60"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tb.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-gray-200/50 bg-white/70 p-6 backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
        {tab === "personal" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-white/40">Business Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-teal-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-white/40">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-teal-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs text-gray-500 dark:text-white/40">{t("proAnalytics.addPhone")}</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-teal-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500 dark:text-white/40">{t("proAnalytics.addCity")}</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-teal-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-white/40">{t("proAnalytics.addExperience")}</label>
              <input
                type="number"
                value={exp}
                onChange={(e) => setExp(e.target.value)}
                className="w-32 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-teal-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs text-gray-500 dark:text-white/40">{t("proAnalytics.addLanguages")}</label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((l) => (
                  <button
                    key={l}
                    onClick={() =>
                      setLangs((prev) =>
                        prev.includes(l)
                          ? prev.filter((x) => x !== l)
                          : [...prev, l]
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      langs.includes(l)
                        ? "border-teal-500/50 bg-teal-500/10 text-teal-400"
                        : "border-gray-200 text-gray-400 hover:text-gray-600 dark:border-white/[0.08] dark:text-white/40 dark:hover:text-white/60"
                    }`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "pricing" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-white/50">{t("proProfile.pricing")}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs text-gray-500 dark:text-white/40">Min (€/hr)</label>
                <input
                  type="number"
                  value={rateMin}
                  onChange={(e) => setRateMin(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-teal-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500 dark:text-white/40">Max (€/hr)</label>
                <input
                  type="number"
                  value={rateMax}
                  onChange={(e) => setRateMax(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-teal-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {tab === "portfolio" && (
          <div className="text-center py-8">
            <Camera className="mx-auto mb-3 h-10 w-10 text-teal-500/30" />
            <p className="text-sm text-gray-500 dark:text-white/50">{t("proProfile.portfolio")}</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-white/30">
              {profile?.portfolio_images?.length || 0} photos
            </p>
          </div>
        )}

        {tab === "services" && (
          <div className="text-center py-8">
            <Layers className="mx-auto mb-3 h-10 w-10 text-teal-500/30" />
            <p className="text-sm text-gray-500 dark:text-white/50">{t("proProfile.serviceAreas")}</p>
          </div>
        )}

        {(tab === "personal" || tab === "pricing") && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-teal-500/20 disabled:opacity-50"
            >
              {saving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t("common.save")}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
