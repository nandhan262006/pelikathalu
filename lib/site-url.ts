/** Canonical site origin — every SEO surface (metadataBase, sitemap, JSON-LD, Open Graph) derives from this. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://pellikathalu.co").replace(/\/+$/, "");

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const SITE_NAME = "Pelli Kathalu by Prem & Pavan";
export const SITE_TAGLINE = "Wedding photography & films in Hyderabad — captured the way they feel.";
