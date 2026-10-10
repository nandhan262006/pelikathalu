import Link from "next/link";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Arrow, WhatsApp } from "@/components/Icons";
import PortfolioGallery from "@/components/PortfolioGallery";

const WHATSAPP_URL = "https://wa.me/";
const INSTAGRAM_URL = "https://www.instagram.com/portraits.by_pellikathalu/";

// Everything in /public/images except decorative UI assets.
// Newest shoots sort first; curated recent-* highlights stay on top.
function getPhotos(): string[] {
  const dir = join(process.cwd(), "public", "images");
  const files = readdirSync(dir).filter((f) => /\.(jpe?g|webp|png)$/i.test(f));
  const decorative = /^(leaf-|greentexture)/i;
  const photos = files.filter((f) => !decorative.test(f));
  const highlights = photos.filter((f) => /^recent-/i.test(f)).sort();
  const rest = photos.filter((f) => !/^recent-/i.test(f)).sort().reverse();
  return [...highlights, ...rest].map((f) => `/images/${f}`);
}

const photos = getPhotos();

export default function PortfolioPage() {
  return (
    <div className="shell">
      <main className="page">
        <header className="header">
          <Link href="/" className="logo" aria-label="Portraits by Pelli Kathalu">
            <span className="logo-by">Portraits by</span>
            <span className="logo-name">Pelli Kathalu</span>
            <span className="logo-sub">PREM &amp; PAVAN</span>
          </Link>
          <nav className="desktop-nav" aria-label="Primary">
            <Link href="/">Home</Link>
            <Link href="/portfolio">Portfolio</Link>
            <Link href="/#reviews">Reviews</Link>
            <Link href="/#story">Our Story</Link>
          </nav>
          <a className="book-btn" href={WHATSAPP_URL} target="_blank" rel="noreferrer">
            <WhatsApp className="book-ico" />
            Book a Shoot
          </a>
        </header>

        <section className="portfolio">
          <div className="portfolio-head">
            <div>
              <p className="script recent-script">Full frames</p>
              <h1 className="recent-title">Portfolio</h1>
              <p className="portfolio-sub">
                {photos.length} photos — every image shown whole, nothing cropped.
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
              <div className="logo" aria-label="Portraits by Pelli Kathalu">
                <span className="logo-by">Portraits by</span>
                <span className="logo-name">Pelli Kathalu</span>
                <span className="logo-sub">PREM &amp; PAVAN</span>
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
