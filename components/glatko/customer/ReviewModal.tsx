"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Star, X } from "lucide-react";
import { submitReview } from "@/app/(site)/[locale]/messages/actions";

interface Props {
  quoteId: string;
  proName: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export function ReviewModal({
  quoteId,
  proName,
  onClose,
  onSubmitted,
}: Props) {
  const t = useTranslations();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (rating === 0) {
      setError(t("customer.review.ratingRequired"));
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await submitReview({
      quote_id: quoteId,
      rating,
      comment: comment.trim() || undefined,
    });

    if (!result.success) {
      setError(result.error ?? t("customer.review.submitError"));
      setSubmitting(false);
      return;
    }

    onSubmitted();
  }

  const activeRating = hoveredRating || rating;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-lg w-full p-8 shadow-2xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t("customer.review.title")}
            </h2>
            <p className="text-sm text-gray-600 dark:text-neutral-400 mt-1">
              {proName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label={t("customer.review.cancel")}
            className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-neutral-300" />
          </button>
        </div>

        <div className="flex justify-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              disabled={submitting}
              aria-label={`${star} ${t("customer.review.starsAria")}`}
              className="transition-transform hover:scale-110 disabled:opacity-50"
            >
              <Star
                className={`h-12 w-12 ${
                  activeRating >= star
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-gray-300 dark:text-neutral-600"
                }`}
              />
            </button>
          ))}
        </div>

        {activeRating > 0 && (
          <p className="text-center mb-6 font-medium text-gray-700 dark:text-neutral-300">
            {t(`customer.review.ratingLabel.${activeRating}`)}
          </p>
        )}

        <div className="mb-4">
          <label
            htmlFor="review-comment"
            className="block text-sm font-medium mb-2 text-gray-900 dark:text-white"
          >
            {t("customer.review.commentLabel")}{" "}
            <span className="text-gray-500 font-normal">
              ({t("customer.review.optional")})
            </span>
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value.substring(0, 1000))}
            disabled={submitting}
            rows={4}
            placeholder={t("customer.review.commentPlaceholder")}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">
            {comment.length} / 1000
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400 mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
          >
            {t("customer.review.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg disabled:opacity-50 font-medium"
          >
            {submitting
              ? t("customer.review.submitting")
              : t("customer.review.submitReview")}
          </button>
        </div>
      </div>
    </div>
  );
}
