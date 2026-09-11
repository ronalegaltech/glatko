"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useModal } from "@/components/aceternity/modal";
import { submitQuote } from "@/app/(site)/[locale]/pro/dashboard/leads/actions";
import type { Lead } from "./LeadsList";

type PricingModel = "hourly" | "fixed" | "per_unit" | "estimate";
const PRICING_MODELS: PricingModel[] = [
  "hourly",
  "fixed",
  "per_unit",
  "estimate",
];

const MIN_MESSAGE = 10;
const MAX_MESSAGE = 5000;

interface Props {
  lead: Lead;
}

export function QuoteSendForm({ lead }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const { setOpen } = useModal();

  const [price, setPrice] = useState<string>("");
  const [pricingModel, setPricingModel] = useState<PricingModel>("fixed");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedMessage = message.trim();
  const messageLen = trimmedMessage.length;
  const numericPrice = price === "" ? NaN : Number(price);
  const validPrice = Number.isFinite(numericPrice) && numericPrice > 0;
  const validMessage =
    messageLen >= MIN_MESSAGE && messageLen <= MAX_MESSAGE;
  const canSubmit = validPrice && validMessage && !submitting;

  async function handleSubmit() {
    if (!validPrice) {
      setError(t("pro.leads.priceRequired"));
      return;
    }
    if (!validMessage) {
      setError(t("pro.leads.messageMinError"));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await submitQuote({
        request_id: lead.request_id,
        notification_id: lead.id,
        price_amount: numericPrice,
        pricing_model: pricingModel,
        message: trimmedMessage,
      });

      if (!result.success) {
        setError(result.error ?? t("pro.leads.submitError"));
        setSubmitting(false);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("pro.leads.submitError"),
      );
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        {t("pro.leads.sendQuoteTitle")}
      </h2>
      <p className="text-sm text-gray-600 dark:text-neutral-400 mb-6">
        {lead.glatko_service_requests.title}
      </p>

      {lead.glatko_service_requests.description && (
        <div className="rounded-lg bg-gray-50 dark:bg-neutral-800/50 p-4 mb-6">
          <p className="text-sm text-gray-700 dark:text-neutral-300 whitespace-pre-wrap">
            {lead.glatko_service_requests.description}
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label
            htmlFor="quote-price"
            className="block text-sm font-medium mb-2 text-gray-900 dark:text-white"
          >
            {t("pro.leads.priceLabel")} <span aria-hidden>*</span>
          </label>
          <input
            id="quote-price"
            type="number"
            min="1"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={submitting}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="50"
          />
        </div>

        <div>
          <label
            htmlFor="quote-pricing-model"
            className="block text-sm font-medium mb-2 text-gray-900 dark:text-white"
          >
            {t("pro.leads.pricingModelLabel")} <span aria-hidden>*</span>
          </label>
          <select
            id="quote-pricing-model"
            value={pricingModel}
            onChange={(e) =>
              setPricingModel(e.target.value as PricingModel)
            }
            disabled={submitting}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {PRICING_MODELS.map((pm) => (
              <option key={pm} value={pm}>
                {t(`pro.leads.pricingModel.${pm}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="quote-message"
            className="block text-sm font-medium mb-2 text-gray-900 dark:text-white"
          >
            {t("pro.leads.messageLabel")} <span aria-hidden>*</span>
          </label>
          <textarea
            id="quote-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={submitting}
            rows={6}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder={t("pro.leads.messagePlaceholder")}
          />
          <p
            className={`text-xs mt-1 ${
              messageLen < MIN_MESSAGE
                ? "text-red-500 dark:text-red-400"
                : "text-gray-500 dark:text-neutral-500"
            }`}
          >
            {messageLen} / {MIN_MESSAGE} {t("pro.leads.messageMin")}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={submitting}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
          >
            {t("pro.leads.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg disabled:opacity-50 hover:from-blue-700 hover:to-indigo-700"
          >
            {submitting
              ? t("pro.leads.submitting")
              : t("pro.leads.submitQuote")}
          </button>
        </div>
      </div>
    </div>
  );
}
