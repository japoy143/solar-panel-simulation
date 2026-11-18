import type { Metadata } from "next";
import { CatalogProvider } from "@/components/catalog-provider";
import { SimulatorLoader } from "@/components/simulator/simulator-loader";
import { getProducts } from "@/lib/data/products";

export const metadata: Metadata = {
  title: "Simulator · Solar Layout Simulator",
  description: "Drag and drop solar panels, inverters, and batteries onto a 3D building.",
};

export default async function SimulatorPage() {
  const products = await getProducts();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-12">
      <div className="mb-8 max-w-2xl space-y-3">
        <p className="eyebrow text-primary-strong">Simulator</p>
        <h1 className="text-3xl font-semibold text-balance sm:text-4xl">Design your solar layout</h1>
        <p className="text-muted-foreground">
          Pick a building, drag panels onto the roof and equipment onto the wall, and rearrange
          until it fits. Your layout is saved in this browser.
        </p>
      </div>
      <CatalogProvider products={products}>
        <SimulatorLoader />
      </CatalogProvider>
    </div>
  );
}
