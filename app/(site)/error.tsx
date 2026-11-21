"use client";

import { ErrorFallback } from "@/components/error-fallback";

export default function SiteError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorFallback error={error} retry={retry} />;
}
