"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Error id that matches the server log (`digest` in the "unhandled server error" line). */
export function errorReference(error: unknown) {
  if (typeof error === "object" && error !== null && "digest" in error) return String(error.digest);
  return null;
}

/** Shared UI for error.tsx boundaries. */
export function ErrorFallback({
  error,
  retry,
  title = "Something went wrong",
  homeHref = "/",
}: {
  error: unknown;
  retry: () => void;
  title?: string;
  homeHref?: string;
}) {
  const ref = errorReference(error);

  useEffect(() => {
    // Server details stay in the server log (search for the reference); this helps client-side bugs.
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlertIcon className="size-6" />
      </span>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          This page couldn&apos;t load. Try again, and if it keeps happening, let us know the reference below.
        </p>
      </div>
      {ref && (
        <p className="rounded-md bg-muted px-3 py-1 font-mono text-xs text-muted-foreground">Reference: {ref}</p>
      )}
      <div className="flex gap-2">
        <Button className="h-9 px-4" onClick={() => retry()}>
          <RotateCcwIcon data-icon="inline-start" />
          Try again
        </Button>
        <Link href={homeHref} className={cn(buttonVariants({ variant: "outline" }), "h-9 px-4")}>
          Go back home
        </Link>
      </div>
    </div>
  );
}
