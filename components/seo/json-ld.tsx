/**
 * Renders schema.org structured data. `<` is escaped so a value can't close the script tag
 * (see node_modules/next/dist/docs/01-app/02-guides/json-ld.md).
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c"),
      }}
    />
  );
}
