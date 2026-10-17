import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site-url";

/**
 * JSON-LD structured data for rich results (Google Knowledge Graph / local pack /
 * AI-search citation). Kept claim-light: no fake street address, no fake phone —
 * only verifiable facts (name, region, links, Instagram).
 */
export default function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["LocalBusiness", "ProfessionalService"],
        "@id": `${SITE_URL}/#business`,
        name: SITE_NAME,
        alternateName: ["Pelli Kathalu", "Portraits by Pelli Kathalu"],
        description: SITE_TAGLINE,
        slogan: "Captured the way they feel.",
        url: SITE_URL,
        image: `${SITE_URL}/images/hero2.jpg`,
        logo: `${SITE_URL}/images/hero2.jpg`,
        address: {
          "@type": "PostalAddress",
          addressLocality: "Hyderabad",
          addressRegion: "Telangana",
          addressCountry: "IN",
        },
        areaServed: { "@type": "City", name: "Hyderabad" },
        sameAs: ["https://www.instagram.com/portraits.by_pellikathalu/"],
        founder: [
          { "@type": "Person", "@id": `${SITE_URL}/#prem`, name: "Prem Chandra", jobTitle: "Co-Founder & Photographer" },
          { "@type": "Person", "@id": `${SITE_URL}/#pavan`, name: "Pavan", jobTitle: "Co-Founder & Filmmaker" },
        ],
        knowsAbout: ["wedding photography", "wedding cinematography", "pre-wedding shoots", "portrait photography", "documentary wedding photography"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        publisher: { "@id": `${SITE_URL}/#business` },
        inLanguage: "en-IN",
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
