import { ImageResponse } from "next/og";
import { SunMark } from "@/components/seo/sun-mark";
import { siteConfig } from "@/lib/site";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 14,
        }}
      >
        <SunMark size={40} color={siteConfig.colors.white} />
      </div>
    ),
    size,
  );
}
