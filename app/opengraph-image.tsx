import { ImageResponse } from "next/og";
import { SunMark } from "@/components/seo/sun-mark";
import { siteConfig } from "@/lib/site";

export const alt = `${siteConfig.name}: ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const { green, black, white } = siteConfig.colors;

// Shared by every route that doesn't define its own opengraph-image.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: white,
          color: black,
          padding: 72,
          gap: 56,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32, fontWeight: 700 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 56,
                height: 56,
                borderRadius: 12,
                background: green,
              }}
            >
              <SunMark size={34} color={white} />
            </div>
            {siteConfig.name}
          </div>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
            Free 3D solar panel layout planner
          </div>
          <div style={{ fontSize: 28, lineHeight: 1.4, color: "#4a4a4a" }}>
            See how many panels fit your roof, the system size you get, and book a free site
            assessment.
          </div>
        </div>

        {/* Stylised roof with a panel array */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            width: 360,
            gap: 10,
            padding: 24,
            borderRadius: 24,
            background: black,
          }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              style={{
                width: 96,
                height: 128,
                borderRadius: 6,
                background: green,
                border: `3px solid ${i % 5 === 0 ? white : "#3d5a48"}`,
              }}
            />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
