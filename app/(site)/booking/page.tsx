import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CatalogProvider } from "@/components/catalog-provider";
import { BookingForm } from "@/components/site/booking-form";
import { getProducts } from "@/lib/data/products";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl, organizationJsonLd, pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Book a Free Solar Site Assessment",
  description:
    "Book a free, no-obligation solar site assessment. An installer checks your roof, wiring, and shading, then gives you a fixed solar installation quote based on your layout.",
  path: "/booking",
});

const serviceJsonLd = {
  "@type": "Service",
  name: "Free solar site assessment",
  serviceType: "Solar panel installation assessment",
  url: absoluteUrl("/booking"),
  description:
    "An on-site check of your roof, wiring, and shading, followed by a fixed quote for your solar installation.",
  provider: organizationJsonLd,
  offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
};

const nextSteps = [
  "We confirm your preferred date by email.",
  "An installer visits to check your roof and wiring.",
  "You receive a fixed quote based on your layout.",
];

export default async function BookingPage() {
  const products = await getProducts();
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-5 md:py-24">
      <JsonLd data={serviceJsonLd} />
      <div className="space-y-6 md:col-span-2">
        <div className="space-y-3">
          <p className="eyebrow text-primary-strong">Booking</p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance">
            Book a free site assessment
          </h1>
          <p className="text-muted-foreground">
            Tell us where and when. It takes about a minute.
          </p>
        </div>

        <ol className="space-y-4 border-t pt-6">
          {nextSteps.map((step, i) => (
            <li key={step} className="flex gap-4 text-sm">
              <span className="font-mono text-primary-strong">
                {String(i + 1).padStart(2, "0")}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <Card className="md:col-span-3">
        <CardHeader>
          <p className="eyebrow text-primary-strong">Assessment request</p>
          <CardTitle className="text-xl font-semibold">Your details</CardTitle>
          <CardDescription>We&apos;ll only use these to arrange your visit.</CardDescription>
        </CardHeader>
        <CardContent>
          <CatalogProvider products={products}>
            <BookingForm />
          </CatalogProvider>
        </CardContent>
      </Card>
    </section>
  );
}
