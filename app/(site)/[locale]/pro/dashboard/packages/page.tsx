"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Package, Plus, Pencil, Trash2, X, Check, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  getProPackagesAction,
  createProPackageAction,
  updateProPackageAction,
  deleteProPackageAction,
} from "../actions";

interface ServicePackage {
  id: string;
  name: string;
  description: string | null;
  price: number;
  price_type: string;
  estimated_duration_hours: number | null;
  includes: string[] | null;
  category?: { id: string; slug: string; name: Record<string, string>; icon: string | null } | null;
}

interface FormState {
  name: string;
  description: string;
  price: string;
  priceType: "fixed" | "starting_at";
  duration: string;
  includes: string[];
}

const emptyForm: FormState = {
  name: "",
  description: "",
  price: "",
  priceType: "fixed",
  duration: "",
  includes: [],
};

export default function PackagesPage() {
  const t = useTranslations();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [includeInput, setIncludeInput] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getProPackagesAction();
      setPackages(data as ServicePackage[]);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(pkg: ServicePackage) {
    setForm({
      name: pkg.name,
      description: pkg.description || "",
      price: String(pkg.price),
      priceType: pkg.price_type as "fixed" | "starting_at",
      duration: pkg.estimated_duration_hours ? String(pkg.estimated_duration_hours) : "",
      includes: pkg.includes || [],
    });
    setEditId(pkg.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name || !form.price) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        price: parseFloat(form.price),
        price_type: form.priceType as "fixed" | "starting_at",
        estimated_duration_hours: form.duration
          ? parseFloat(form.duration)
          : undefined,
        includes: form.includes.length > 0 ? form.includes : undefined,
      };

      if (editId) {
        await updateProPackageAction(editId, payload);
      } else {
        await createProPackageAction(payload);
      }
      toast.success(t("packages.saved"));
      setShowForm(false);
      load();
    } catch {
      toast.error("Error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("packages.deleteConfirm"))) return;
    try {
      await deleteProPackageAction(id);
      toast.success(t("packages.saved"));
      load();
    } catch {
      toast.error("Error");
    }
  }

  function addInclude() {
    if (!includeInput.trim()) return;
    setForm((prev) => ({
      ...prev,
      includes: [...prev.includes, includeInput.trim()],
    }));
    setIncludeInput("");
  }

  function removeInclude(idx: number) {
    setForm((prev) => ({
      ...prev,
      includes: prev.includes.filter((_, i) => i !== idx),
    }));
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
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-serif text-2xl text-gray-900 dark:text-white md:text-3xl">
          {t("packages.title")}
        </h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-teal-500/20"
        >
          <Plus className="h-4 w-4" />
          {t("packages.create")}
        </button>
      </div>

      {packages.length === 0 && !showForm && (
        <div className="rounded-2xl border border-gray-200/50 bg-white/70 p-12 text-center backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <Package className="mx-auto mb-4 h-12 w-12 text-teal-500/30" />
          <p className="text-sm font-medium text-gray-900 dark:text-white">{t("packages.empty")}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-white/40">{t("packages.emptyDesc")}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {packages.map((pkg, i) => (
          <motion.div
            key={pkg.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-gray-200/50 bg-white/70 p-6 backdrop-blur-sm transition-colors hover:border-teal-500/20 dark:border-white/[0.08] dark:bg-white/[0.03]"
          >
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{pkg.name}</h3>
            {pkg.description && (
              <p className="mt-1 text-xs text-gray-500 dark:text-white/40">{pkg.description}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-2xl font-bold text-teal-500">
                €{pkg.price}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-white/[0.06] dark:text-white/50">
                {pkg.price_type === "fixed"
                  ? t("packages.fixed")
                  : t("packages.startingAt")}
              </span>
              {pkg.estimated_duration_hours && (
                <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-white/40">
                  <Clock className="h-3 w-3" />~{pkg.estimated_duration_hours}h
                </span>
              )}
            </div>
            {pkg.includes && pkg.includes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {pkg.includes.map((item, idx) => (
                  <span
                    key={idx}
                    className="flex items-center gap-1 rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] text-teal-400"
                  >
                    <Check className="h-2.5 w-2.5" />
                    {item}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => openEdit(pkg)}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:border-teal-500/30 hover:text-teal-600 dark:border-white/[0.08] dark:text-white/60 dark:hover:text-teal-400"
              >
                <Pencil className="h-3 w-3" />
                {t("packages.edit")}
              </button>
              <button
                onClick={() => handleDelete(pkg.id)}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-red-400/60 transition-colors hover:border-red-500/30 hover:text-red-400 dark:border-white/[0.06]"
              >
                <Trash2 className="h-3 w-3" />
                {t("packages.delete")}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowForm(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/[0.1] dark:bg-[#0c0c0c]"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-serif text-lg text-gray-900 dark:text-white">
                  {editId ? t("packages.edit") : t("packages.create")}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white"
                  aria-label={t("common.close")}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500 dark:text-white/40">
                    {t("packages.name")}
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500 dark:text-white/40">
                    {t("packages.description")}
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, description: e.target.value }))
                    }
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500 dark:text-white/40">
                      {t("packages.price")}
                    </label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, price: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-teal-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500 dark:text-white/40">
                      {t("packages.priceType")}
                    </label>
                    <div className="flex gap-2">
                      {(["fixed", "starting_at"] as const).map((pt) => (
                        <button
                          key={pt}
                          onClick={() =>
                            setForm((p) => ({ ...p, priceType: pt }))
                          }
                          className={`flex-1 rounded-lg border px-2 py-2 text-[11px] font-medium transition-all ${
                            form.priceType === pt
                              ? "border-teal-500/50 bg-teal-500/10 text-teal-400"
                              : "border-gray-200 text-gray-400 dark:border-white/[0.08] dark:text-white/40"
                          }`}
                        >
                          {pt === "fixed"
                            ? t("packages.fixed")
                            : t("packages.startingAt")}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500 dark:text-white/40">
                    {t("packages.duration")}
                  </label>
                  <input
                    type="number"
                    value={form.duration}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, duration: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-teal-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500 dark:text-white/40">
                    {t("packages.includes")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={includeInput}
                      onChange={(e) => setIncludeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addInclude();
                        }
                      }}
                      className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/20"
                    />
                    <button
                      type="button"
                      onClick={addInclude}
                      className="rounded-lg bg-teal-500/10 px-3 py-2 text-xs text-teal-400"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {form.includes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {form.includes.map((item, idx) => (
                        <span
                          key={idx}
                          className="flex items-center gap-1 rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] text-teal-400"
                        >
                          {item}
                          <button
                            onClick={() => removeInclude(idx)}
                            className="text-teal-400/50 hover:text-red-400"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-600 dark:border-white/[0.08] dark:text-white/60"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name || !form.price}
                  className="flex-1 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 py-2 text-sm font-medium text-white shadow-lg shadow-teal-500/20 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    t("common.save")
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
