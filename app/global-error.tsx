"use client";

import "./globals.css";
import { ErrorFallback } from "@/components/error-fallback";

/** Replaces the root layout when it fails, so it brings its own <html>/<body>. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-svh items-center justify-center bg-background text-foreground">
        <ErrorFallback error={error} retry={retry} />
      </body>
    </html>
  );
}
