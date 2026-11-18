import Link from "next/link";
import { cacheLife } from "next/cache";
import { ArrowRightIcon, ArrowUpIcon } from "lucide-react";
import { Logo } from "@/components/site/logo";

const links = [
  { href: "/products", label: "Products" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/simulator", label: "Simulator" },
];

/** The year for the copyright line. Cached so the footer stays static under Cache Components. */
async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

/**
 * Minimal two-row footer: brand + tagline and a single row of links on top, a quiet legal line
 * with "Back to top" underneath. It matches the header's links and the site's muted tones.
 */
export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-8 py-12 md:flex-row md:items-end md:justify-between">
          <div className="max-w-sm space-y-3">
            <Logo />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Plan your solar layout in 3D, see what it saves, then book a free site assessment.
            </p>
          </div>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/booking"
                  className="group inline-flex items-center gap-1 font-medium text-primary-strong"
                >
                  Book an assessment
                  <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="flex flex-col gap-3 border-t py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © <CurrentYear /> SolarLayout. Estimates are indicative; we confirm real figures on site.
          </p>
          <a
            href="#"
            className="inline-flex w-fit items-center gap-1 transition-colors hover:text-foreground"
          >
            Back to top
            <ArrowUpIcon className="size-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
