import Link from "next/link";
import { SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 font-heading font-bold tracking-tight", className)}
    >
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <SunIcon className="size-4" />
      </span>
      SolarLayout
    </Link>
  );
}
