import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BEYOND — Explore What Lies Beyond", template: "%s" },
  applicationName: "BEYOND",
  keywords: ["universe", "space", "3D", "solar system", "galaxy", "NASA", "astronomy"],
  openGraph: {
    title: "BEYOND — Explore What Lies Beyond",
    description: "Fly through a 3D universe, browse a 2D cosmic map and read the science behind every object.",
    type: "website",
    siteName: "BEYOND",
  },
  twitter: { card: "summary", title: "BEYOND — Explore What Lies Beyond" },
  description:
    "An interactive universe exploration platform: 3D space, 2D cosmic maps and the science behind every celestial object.",
};

export const viewport: Viewport = { themeColor: "#02030a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
