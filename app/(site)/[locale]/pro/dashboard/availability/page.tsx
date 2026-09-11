"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Clock, CalendarDays, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import {
  getProAvailabilityAction,
  updateProAvailabilityAction,
  upsertAvailabilityExceptionAction,
} from "../actions";

interface WeeklySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface ExceptionSlot {
  id: string;
  date: string;
  is_available: boolean;
  note: string | null;
}

const DEFAULT_SLOTS: WeeklySlot[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  start_time: "09:00",
  end_time: "18:00",
  is_available: i < 5,
}));

export default function AvailabilityPage() {
  const t = useTranslations();
  const [weekly, setWeekly] = useState<WeeklySlot[]>(DEFAULT_SLOTS);
  const [exceptions, setExceptions] = useState<ExceptionSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [excDate, setExcDate] = useState("");
  const [excAvailable, setExcAvailable] = useState(false);
  const [excNote, setExcNote] = useState("");

  const dayLabels = [
    t("availability.monday"),
    t("availability.tuesday"),
    t("availability.wednesday"),
    t("availability.thursday"),
    t("availability.friday"),
    t("availability.saturday"),
    t("availability.sunday"),
  ];

  const load = useCallback(async () => {
    try {
      const data = await getProAvailabilityAction();
      if (data.weekly.length > 0) {
        const merged = DEFAULT_SLOTS.map((def) => {
          const found = data.weekly.find(
            (w: WeeklySlot) => w.day_of_week === def.day_of_week
          );
          return found || def;
        });
        setWeekly(merged);
      }
      setExceptions(data.exceptions as ExceptionSlot[]);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveDay(day: number) {
    const slot = weekly.find((w) => w.day_of_week === day);
    if (!slot) return;
    setSaving(day);
    try {
      await updateProAvailabilityAction(
        day,
        slot.start_time,
        slot.end_time,
        slot.is_available
      );
      toast.success(t("availability.saved"));
    } catch {
      toast.error("Error");
    } finally {
      setSaving(null);
    }
  }

  async function handleAddException() {
    if (!excDate) return;
    try {
      await upsertAvailabilityExceptionAction(
        excDate,
        excAvailable,
        excNote || undefined
      );
      toast.success(t("availability.saved"));
      setExcDate("");
      setExcNote("");
      load();
    } catch {
      toast.error("Error");
    }
  }

  function updateSlot(day: number, field: keyof WeeklySlot, value: string | boolean) {
    setWeekly((prev) =>
      prev.map((s) =>
        s.day_of_week === day ? { ...s, [field]: value } : s
      )
    );
  }

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
      <h1 className="mb-8 font-serif text-2xl text-gray-900 dark:text-white md:text-3xl">
        {t("availability.title")}
      </h1>

      <div className="mb-8 rounded-2xl border border-gray-200/50 bg-white/70 dark:border-white/[0.08] dark:bg-white/[0.03] p-6 backdrop-blur-sm">
        <h2 className="mb-4 flex items-center gap-2 font-serif text-lg text-gray-900 dark:text-white">
          <Clock className="h-5 w-5 text-teal-500 dark:text-teal-400" />
          {t("availability.weeklySchedule")}
        </h2>
        <div className="space-y-3">
          {weekly.map((slot) => (
            <div
              key={slot.day_of_week}
              className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/50 dark:border-white/[0.06] dark:bg-white/[0.02] p-4 sm:flex-row sm:items-center"
            >
              <span className="w-24 text-sm font-medium text-gray-900 dark:text-white">
                {dayLabels[slot.day_of_week]}
              </span>
              <button
                onClick={() =>
                  updateSlot(slot.day_of_week, "is_available", !slot.is_available)
                }
                className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  slot.is_available
                    ? "bg-teal-500/15 text-teal-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                <div
                  className={`h-2 w-2 rounded-full ${
                    slot.is_available ? "bg-teal-400" : "bg-red-400"
                  }`}
                />
                {slot.is_available
                  ? t("availability.available")
                  : t("availability.unavailable")}
              </button>
              {slot.is_available && (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={slot.start_time}
                    onChange={(e) =>
                      updateSlot(slot.day_of_week, "start_time", e.target.value)
                    }
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-900 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                  />
                  <span className="text-xs text-gray-400 dark:text-white/30">—</span>
                  <input
                    type="time"
                    value={slot.end_time}
                    onChange={(e) =>
                      updateSlot(slot.day_of_week, "end_time", e.target.value)
                    }
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-900 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                  />
                </div>
              )}
              <button
                onClick={() => handleSaveDay(slot.day_of_week)}
                disabled={saving === slot.day_of_week}
                className="ml-auto flex items-center gap-1 rounded-lg border border-teal-500/30 px-3 py-1.5 text-xs font-medium text-teal-400 transition-colors hover:bg-teal-500/10 disabled:opacity-50"
              >
                {saving === slot.day_of_week ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                {t("common.save")}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/50 bg-white/70 dark:border-white/[0.08] dark:bg-white/[0.03] p-6 backdrop-blur-sm">
        <h2 className="mb-4 flex items-center gap-2 font-serif text-lg text-gray-900 dark:text-white">
          <CalendarDays className="h-5 w-5 text-teal-500 dark:text-teal-400" />
          {t("availability.exceptions")}
        </h2>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="mb-1 block text-xs text-gray-500 dark:text-white/40">
              {t("availability.exceptions")}
            </label>
            <input
              type="date"
              value={excDate}
              onChange={(e) => setExcDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-teal-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500 dark:text-white/40">
              {t("availability.exceptionNote")}
            </label>
            <input
              type="text"
              value={excNote}
              onChange={(e) => setExcNote(e.target.value)}
              placeholder={t("availability.exceptionNote")}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/20"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-white/50">
            <input
              type="checkbox"
              checked={excAvailable}
              onChange={(e) => setExcAvailable(e.target.checked)}
              className="accent-teal-500"
            />
            {t("availability.available")}
          </label>
          <button
            onClick={handleAddException}
            disabled={!excDate}
            className="flex items-center gap-1 rounded-lg bg-teal-500/10 px-4 py-2 text-xs font-medium text-teal-400 transition-colors hover:bg-teal-500/20 disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
            {t("availability.addException")}
          </button>
        </div>
        {exceptions.length > 0 && (
          <div className="space-y-2">
            {exceptions.map((exc) => (
              <div
                key={exc.id || exc.date}
                className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 dark:border-white/[0.04] dark:bg-white/[0.02] px-4 py-2"
              >
                <span className="text-sm text-gray-900 dark:text-white">{exc.date}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    exc.is_available
                      ? "bg-teal-500/15 text-teal-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {exc.is_available
                    ? t("availability.available")
                    : t("availability.unavailable")}
                </span>
                {exc.note && (
                  <span className="text-xs text-gray-400 dark:text-white/30">{exc.note}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
