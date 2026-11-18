"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * A table row that opens `href` when clicked anywhere. Links and controls inside it (email,
 * status select) keep their own behaviour, and selecting text doesn't navigate. Put a real link
 * in the first cell for keyboard users, so the row itself isn't a tab stop.
 */
export function ClickableRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <TableRow
      className={cn("cursor-pointer", className)}
      onMouseEnter={() => router.prefetch(href)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, select, input, textarea, label")) return;
        if (window.getSelection()?.toString()) return;
        if (e.metaKey || e.ctrlKey) window.open(href, "_blank", "noopener");
        else router.push(href);
      }}
      onAuxClick={(e) => {
        // Middle-click opens a new tab, like a normal link.
        if (e.button !== 1 || (e.target as HTMLElement).closest("a, button, select")) return;
        window.open(href, "_blank", "noopener");
      }}
    >
      {children}
    </TableRow>
  );
}
