import type { Metadata, Viewport } from "next";
import { SITE_NAME, SITE_TAGLINE, SITE_URL, absoluteUrl } from "@/lib/site-url";
import "@fontsource/bodoni-moda/400.css";
import "@fontsource/bodoni-moda/400-italic.css";
import "@fontsource/bodoni-moda/500.css";
import "@fontsource/dancing-script/400.css";
import "@fontsource/dancing-script/600.css";
import "@fontsource/work-sans/400.css";
import "@fontsource/work-sans/500.css";
// Font-kit options selectable in the admin Theme section (see lib/fonts.ts).
// @font-face rules are cheap; font files only download when a kit actually uses them.
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/400-italic.css";
import "@fontsource/playfair-display/500.css";
import "@fontsource/great-vibes/400.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/parisienne/400.css";
import "@fontsource/raleway/400.css";
import "@fontsource/raleway/500.css";
import "@fontsource/libre-baskerville/400.css";
import "@fontsource/libre-baskerville/400-italic.css";
import "@fontsource/sacramento/400.css";
import "@fontsource/karla/400.css";
import "@fontsource/karla/500.css";
import "@fontsource/dm-serif-display/400.css";
import "@fontsource/dm-serif-display/400-italic.css";
import "@fontsource/pacifico/400.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/eb-garamond/400.css";
import "@fontsource/eb-garamond/400-italic.css";
import "@fontsource/eb-garamond/500.css";
import "@fontsource/pinyon-script/400.css";
import "@fontsource/nunito-sans/400.css";
import "@fontsource/nunito-sans/500.css";
import "@fontsource/prata/400.css";
import "@fontsource/caveat/400.css";
import "@fontsource/caveat/600.css";
import "@fontsource/jost/400.css";
import "@fontsource/jost/500.css";
import "@fontsource/marcellus/400.css";
import "@fontsource/satisfy/400.css";
import "@fontsource/mulish/400.css";
import "@fontsource/mulish/500.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Wedding Photography & Films Hyderabad`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_TAGLINE,
  keywords: [
    "pellikathalu",
    "pelli kathalu",
    "Pelli Kathalu",
    "wedding photographer Hyderabad",
    "wedding photography Hyderabad",
    "wedding cinematography Hyderabad",
    "pre wedding photographer Hyderabad",
    "portrait photographer Hyderabad",
    "best wedding photographers in Hyderabad",
    "candid wedding photography Hyderabad",
    "Prem and Pavan photography",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_IN",
    url: SITE_URL,
    title: `${SITE_NAME} — Wedding Photography & Films Hyderabad`,
    description: SITE_TAGLINE,
    // photography arriving soon · hero2.jpg
    images: [{ url: absoluteUrl("/images/hero2.jpg"), width: 1200, height: 800, alt: `${SITE_NAME} — wedding story frames` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Wedding Photography & Films Hyderabad`,
    description: SITE_TAGLINE,
    images: [absoluteUrl("/images/hero2.jpg")],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  category: "photography",
  authors: [{ name: "Prem Chandra", url: SITE_URL }, { name: "Pavan", url: SITE_URL }],
  publisher: SITE_NAME,
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
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
