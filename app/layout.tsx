import type { Metadata, Viewport } from "next";
import "@fontsource/bodoni-moda/400.css";
import "@fontsource/bodoni-moda/400-italic.css";
import "@fontsource/bodoni-moda/500.css";
import "@fontsource/mrs-saint-delafield/400.css";
import "@fontsource/work-sans/400.css";
import "@fontsource/work-sans/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portraits by Pelli Kathalu — Prem & Pavan",
  description:
    "Portraits, pre-weddings, weddings and events. Captured the way they feel.",
};

export const viewport: Viewport = {
  themeColor: "#4b7742",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
