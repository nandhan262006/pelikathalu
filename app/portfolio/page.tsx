import type { Metadata } from "next";
import Link from "next/link";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Arrow } from "@/components/Icons";
import PortfolioGallery from "@/components/PortfolioGallery";
import SiteHeader from "@/components/SiteHeader";
import PaletteVars from "@/components/PaletteVars";
import FontVars from "@/components/FontVars";
import StructuredData from "@/components/StructuredData";
import { getSiteContent } from "@/lib/sites";

const WHATSAPP_URL = "https://wa.me/";
const INSTAGRAM_URL = "https://www.instagram.com/portraits.by_pellikathalu/";

// Curated archive: only dated shoot batches. UI assets (hero, categories,
// book-shoot, recent-*) stay on the homepage, not in the archive.
function getPhotos(): string[] {
  const dir = join(process.cwd(), "public", "images");
  const files = readdirSync(dir).filter((f) => /\.(jpe?g|webp|png)$/i.test(f));
  const isShoot = /^\d{4}-\d{2}-\d{2}_/i;
  const photos = files.filter((f) => isShoot.test(f));
  return photos.sort().reverse().map((f) => `/images/${f}`);
}

const photos = getPhotos();

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolio — Full Frames Archive",
  description: "The complete Pelli Kathalu archive — unposed, documentary frames from real weddings and shoots, newest first.",
  alternates: { canonical: "/portfolio" },
};

export default async function PortfolioPage() {
  const content = await getSiteContent("home", false);
  return (
    <div className="shell">
      <PaletteVars id={content?.theme?.paletteId} />
      <FontVars id={content?.theme?.fontId} />
      <StructuredData />
      <main className="page">
        <SiteHeader whatsapp={WHATSAPP_URL} solid />

        <section className="portfolio">
          <div className="portfolio-head">
            <div>
              <p className="script recent-script">Full frames</p>
              <h1 className="recent-title">Portfolio</h1>
              <p className="portfolio-sub">
                {photos.length} selected frames — every image shown whole, nothing cropped.
              </p>
            </div>
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="view-all">
              Instagram <Arrow className="va-arrow" />
            </a>
          </div>

          <PortfolioGallery photos={photos} />

          <div className="portfolio-foot">
            <Link href="/" className="pill portfolio-back">
              <Arrow dir="left" className="pill-arrow" /> Back to Home
            </Link>
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="pill portfolio-cta">
              Book a Shoot <Arrow className="pill-arrow" />
            </a>
          </div>
        </section>

        <footer className="site-footer green-texture">
          <div className="foot-top">
            <div className="foot-brand">
              <div className="logo" aria-label="Pelli Kathalu by Prem and Pavan">
                <span className="logo-name">Pelli Kathalu</span>
                <span className="logo-sub">BY PREM &amp; PAVAN</span>
              </div>
              <p className="foot-tag">Captured the way they feel.</p>
            </div>
            <nav className="foot-col" aria-label="Explore">
              <p className="foot-h">EXPLORE</p>
              <div className="foot-links">
                <Link href="/">Home</Link>
                <Link href="/portfolio">Portfolio</Link>
                <Link href="/#reviews">Reviews</Link>
                <Link href="/#story">Our Story</Link>
              </div>
            </nav>
            <div className="foot-col">
              <p className="foot-h">CONTACT</p>
              <div className="foot-links">
                <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                  Book a Shoot
                </a>
                <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
                  Instagram
                </a>
              </div>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 PORTRAITS BY PELLI KATHALU</span>
            <span>PREM &amp; PAVAN</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
