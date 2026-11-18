"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { refreshCatalog } from "@/app/admin/(dashboard)/products/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Pushes database changes made outside the admin (e.g. the Supabase SQL editor) to the site now. */
export function RefreshCatalogButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      className="h-9 px-4"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const result = await refreshCatalog();
            if (!result.ok) return void toast.error(result.error);
            router.refresh();
            toast.success("Catalog refreshed", { description: "The site and simulator now show the latest products." });
          } catch (err) {
            console.error("refreshCatalog failed", err);
            toast.error("Couldn't reach the server. Check your connection and try again.");
          }
        })
      }
    >
      <RefreshCwIcon data-icon="inline-start" className={cn(pending && "animate-spin")} />
      Refresh catalog
    </Button>
  );
}
