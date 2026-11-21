"use client";

import { ErrorFallback } from "@/components/error-fallback";

export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorFallback error={error} retry={retry} title="This admin page couldn't load" homeHref="/admin" />
  );
}
