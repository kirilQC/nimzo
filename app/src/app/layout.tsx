import type { Metadata, Viewport } from "next";
import { Manrope, Mulish, Barlow_Condensed, Instrument_Serif, Anton } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-manrope", display: "swap" });
const mulish = Mulish({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-mulish", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: ["400"], style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });
const anton = Anton({ subsets: ["latin"], weight: ["400"], variable: "--font-anton", display: "swap" });
const barlowC = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-barlow-c", display: "swap" });

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Nimzo", template: "%s · Nimzo" },
  description: "A personal chess coach.",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0d241b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${manrope.variable} ${mulish.variable} ${barlowC.variable} ${instrument.variable} ${anton.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
