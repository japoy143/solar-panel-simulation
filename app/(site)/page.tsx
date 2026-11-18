import Link from "next/link";
import {
  ArrowRightIcon,
  ClipboardCheckIcon,
  ReceiptIcon,
  RulerIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeroVisual } from "@/components/site/hero-visual";
import { ProductCard } from "@/components/site/product-card";
import { getProducts } from "@/lib/data/products";
import { buildings } from "@/lib/simulator/buildings";
import { buildingIcons } from "@/components/simulator/building-icons";
import { cn } from "@/lib/utils";


const highlights = [
  { icon: RulerIcon, label: "3D roof layout" },
  { icon: ClipboardCheckIcon, label: "Free site assessment" },
  { icon: ReceiptIcon, label: "Transparent quotes" },
];

const steps = [
  {
    title: "Design your layout",
    description:
      "Place panels on a 3D model of your roof and see the system size and output you can expect.",
  },
  {
    title: "Book an assessment",
    description:
      "Pick a date and our team visits to check your roof, wiring, and shading on site.",
  },
  {
    title: "We install",
    description:
      "You get a fixed quote based on your layout, then our installers handle the rest.",
  },
];

export default async function HomePage() {
  const featuredProducts = (await getProducts()).filter((p) => p.featured);
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
        <div className="space-y-8">
          <Badge variant="outline" className="h-7 gap-2 px-3 font-mono tracking-wider uppercase">
            <span className="size-1.5 rounded-full bg-primary" />
            Residential &amp; commercial solar
          </Badge>

          <div className="space-y-5">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Plan your solar roof before a single panel goes up.
            </h1>
            <p className="max-w-md text-lg text-pretty text-muted-foreground">
              Lay out panels on a 3D model of your roof, see the output you can
              expect, and book a free assessment with our installers.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/booking" className={cn(buttonVariants(), "h-11 px-5")}>
              Book a free assessment
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
            <Link
              href="/simulator"
              className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5")}
            >
              Try the simulator
            </Link>
          </div>

          <ul className="flex flex-wrap gap-x-6 gap-y-3 border-t pt-6 text-sm text-muted-foreground">
            {highlights.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="size-4 text-primary" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <HeroVisual />
      </section>

      {/* Products */}
      <section id="products" className="scroll-mt-16 border-t">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl space-y-3">
              <p className="eyebrow text-primary-strong">Products</p>
              <h2 className="text-3xl font-semibold tracking-tight text-balance">
                Equipment we install
              </h2>
            </div>
            <Link
              href="/products"
              className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}
            >
              View all products
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProducts.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-16 border-t bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-xl space-y-3">
            <p className="eyebrow text-primary-strong">How it works</p>
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              From roof to power in three steps
            </h2>
          </div>

          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title}>
                <Card className="h-full">
                  <CardHeader>
                    <span className="eyebrow text-primary-strong">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <CardTitle className="text-lg font-semibold">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {step.description}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Simulator */}
      <section id="simulator" className="scroll-mt-16 border-t">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl space-y-3">
              <p className="eyebrow text-primary-strong">Simulator</p>
              <h2 className="text-3xl font-semibold tracking-tight text-balance">
                See your layout in 3D
              </h2>
              <p className="text-muted-foreground">
                Pick a building, then drag panels, inverters, and batteries into place.
              </p>
            </div>
            <Link href="/simulator" className={cn(buttonVariants(), "h-10 px-4")}>
              Open simulator
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </div>

          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {buildings.map((b) => {
              const Icon = buildingIcons[b.id];
              return (
                <li key={b.id}>
                  <Link
                    href={`/simulator?building=${b.id}`}
                    className="group flex h-full flex-col gap-6 rounded-xl border bg-card p-5 transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    <span className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-6" />
                    </span>
                    <span className="space-y-1">
                      <span className="eyebrow block text-muted-foreground">{b.kind}</span>
                      <span className="block font-heading text-lg font-semibold">{b.name}</span>
                      <span className="block text-sm text-muted-foreground">{b.dimensions}</span>
                    </span>
                    <span className="mt-auto flex items-center gap-1 text-sm font-medium text-primary-strong">
                      Try it
                      <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="flex flex-col items-start gap-6 rounded-2xl bg-foreground px-6 py-12 text-background sm:px-12 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to see what your roof can do?
            </h2>
            <p className="text-background/70">
              Book a free, no-obligation site assessment.
            </p>
          </div>
          <Link
            href="/booking"
            className={cn(buttonVariants(), "h-11 px-5")}
          >
            Book assessment
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </div>
      </section>
    </>
  );
}
