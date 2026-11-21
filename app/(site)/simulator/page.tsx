import type { Metadata } from "next";
import { CatalogProvider } from "@/components/catalog-provider";
import { SimulatorLoader } from "@/components/simulator/simulator-loader";
import { getProducts } from "@/lib/data/products";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata, webApplicationJsonLd } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "3D Solar Panel Layout Planner",
  description:
    "Free 3D solar panel simulator. Drag panels, inverters, and batteries onto a house or commercial building to see how many solar panels fit, your system size, and estimated yearly output.",
  path: "/simulator",
});

export default async function SimulatorPage() {
  const products = await getProducts();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-12">
      <JsonLd data={webApplicationJsonLd("/simulator")} />
      <div className="mb-8 max-w-2xl space-y-3">
        <p className="eyebrow text-primary-strong">Simulator</p>
        <h1 className="text-3xl font-semibold text-balance sm:text-4xl">Design your solar panel layout in 3D</h1>
        <p className="text-muted-foreground">
          Pick a building, drag solar panels onto the roof and equipment onto the wall, and
          rearrange until it fits. See how many panels you need, your system size, and expected
          output as you go. Your layout is saved in this browser.
        </p>
      </div>
      <CatalogProvider products={products}>
        <SimulatorLoader />
      </CatalogProvider>
    </div>
  );
}
