import { Suspense } from "react";
import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Manrope } from "next/font/google";
import { FlashToast } from "@/components/flash-toast";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Heading
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

// Subheading
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// Body
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Solar Layout Simulator",
  description: "Plan and book solar panel installations",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${plexMono.variable} ${plexSans.variable} h-full`}
    >
      {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) inject
          attributes on <body> before hydration; ignore those mismatches. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <ConfirmProvider>{children}</ConfirmProvider>
        <Toaster />
        {/* Toasts queued by Server Actions that redirect (sign in / sign out). */}
        <Suspense fallback={null}>
          <FlashToast />
        </Suspense>
      </body>
    </html>
  );
}
