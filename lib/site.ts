// Site-wide SEO settings: name, copy, keywords, and the absolute URL used for canonical links,
// the sitemap, and Open Graph images.

import type { Metadata } from "next";

export const siteConfig = {
  name: "Solar Layout Simulator",
  shortName: "SolarLayout",
  tagline: "Free 3D Solar Panel Layout Planner",
  description:
    "Plan your solar roof in 3D for free. Drag solar panels, inverters, and batteries onto a model of your building, see how many panels fit and the system size you get, then book a free site assessment.",
  keywords: [
    "solar panel layout planner",
    "free solar panel layout tool",
    "3D solar panel simulator",
    "solar roof design tool",
    "design your solar system",
    "solar panel placement",
    "roof solar panel layout",
    "how many solar panels do I need",
    "solar system size calculator",
    "solar panels",
    "hybrid inverter",
    "home battery storage",
    "free solar site assessment",
    "solar installation quote",
  ],
  /** Brand colors for generated images (Satori can't read the CSS tokens in globals.css). */
  colors: { green: "#5d866c", greenStrong: "#4a6b56", black: "#0a0a0a", white: "#ffffff" },
} as const;

function resolveSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  // Tolerate a bare domain ("example.com"): `new URL()` would throw on it and take down every page.
  if (explicit) return (/^https?:\/\//i.test(explicit) ? explicit : `https://${explicit}`).replace(/\/+$/, "");
  // Set automatically on Vercel; lets SEO URLs work before a custom domain is configured.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/** Absolute origin of the site, without a trailing slash. */
export const siteUrl = resolveSiteUrl();

export const absoluteUrl = (path = "/") => new URL(path, siteUrl).toString();

/** Rendered by app/opengraph-image.tsx. */
const ogImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${siteConfig.name}: ${siteConfig.tagline}`,
};

/**
 * Per-page metadata. Child `openGraph`/`twitter` objects replace the root ones rather than merge
 * (which also drops the file-based OG image), so each page gets complete social tags with its own
 * title, description, canonical URL, and the shared image.
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  /** Skip the "| Solar Layout Simulator" title template. */
  absoluteTitle?: boolean;
}): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${siteConfig.name}`;
  const images = [ogImage];
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      locale: "en_US",
      url: path,
      title: fullTitle,
      description,
      images,
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images },
  };
}

export const organizationJsonLd = {
  "@type": "Organization",
  "@id": absoluteUrl("/#organization"),
  name: siteConfig.name,
  url: absoluteUrl("/"),
  logo: absoluteUrl("/icon"),
};

export function webApplicationJsonLd(path: string) {
  return {
    "@type": "WebApplication",
    "@id": absoluteUrl(`${path}#app`),
    name: siteConfig.name,
    url: absoluteUrl(path),
    description: siteConfig.description,
    applicationCategory: "DesignApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript and WebGL.",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
    featureList: [
      "3D models of residential houses and a commercial building",
      "Drag-and-drop solar panels, inverters, and batteries",
      "Live panel count, system size (kWp), estimated yearly output (kWh), and battery storage",
      "Layout saved in your browser",
    ],
    publisher: { "@id": organizationJsonLd["@id"] },
  };
}
