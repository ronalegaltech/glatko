"use client";

import { GlatkoRouteError } from "@/components/glatko/errors/GlatkoRouteError";

export default function NotificationSettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <GlatkoRouteError error={error} reset={reset} />;
}
