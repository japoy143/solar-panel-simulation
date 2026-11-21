import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

// Public pages only; /admin is excluded here and in robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/simulator"), changeFrequency: "monthly", priority: 0.9 },
    { url: absoluteUrl("/products"), changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/booking"), changeFrequency: "yearly", priority: 0.7 },
  ];
}
