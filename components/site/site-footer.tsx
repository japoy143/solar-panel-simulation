import Link from "next/link";
import { Logo } from "@/components/site/logo";

const links = [
  { href: "/products", label: "Products" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/simulator", label: "Simulator" },
  { href: "/booking", label: "Booking" },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:flex-row sm:justify-between sm:px-6">
        <div className="max-w-xs space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">
            Solar layout planning and installation.
          </p>
        </div>
        <nav aria-label="Footer" className="space-y-3">
          <p className="eyebrow text-primary-strong">Explore</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
