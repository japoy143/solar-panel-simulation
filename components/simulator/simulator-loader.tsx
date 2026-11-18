"use client";

import dynamic from "next/dynamic";
import { SimulatorSkeleton } from "./skeleton";

// three.js needs the browser (WebGL, window), so skip server rendering.
// `ssr: false` is only allowed inside a Client Component in Next 16.
const Simulator = dynamic(() => import("./simulator"), {
  ssr: false,
  loading: () => <SimulatorSkeleton />,
});

export function SimulatorLoader() {
  return <Simulator />;
}
