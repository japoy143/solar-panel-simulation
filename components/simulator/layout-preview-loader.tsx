"use client";

import dynamic from "next/dynamic";
import type { LayoutPreviewProps } from "./layout-preview";

function PreviewSkeleton() {
  return (
    <div className="flex size-full animate-pulse items-center justify-center bg-muted">
      <p className="eyebrow text-muted-foreground">Loading 3D preview…</p>
    </div>
  );
}

// three.js needs the browser (WebGL, window), so skip server rendering.
const LayoutPreview = dynamic(() => import("./layout-preview"), {
  ssr: false,
  loading: () => <PreviewSkeleton />,
});

export function LayoutPreviewLoader(props: LayoutPreviewProps) {
  return <LayoutPreview {...props} />;
}
