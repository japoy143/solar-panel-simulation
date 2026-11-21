import { ImageResponse } from "next/og";
import { SunMark } from "@/components/seo/sun-mark";
import { siteConfig } from "@/lib/site";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS rounds the corners itself, so the background is a full square.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: siteConfig.colors.green,
        }}
      >
        <SunMark size={110} color={siteConfig.colors.white} />
      </div>
    ),
    size,
  );
}
