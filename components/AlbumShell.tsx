import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import PaletteVars from "@/components/PaletteVars";
import FontVars from "@/components/FontVars";
import StructuredData from "@/components/StructuredData";

const WHATSAPP_URL = "https://wa.me/";
const INSTAGRAM_URL = "https://www.instagram.com/portraits.by_pellikathalu/";

export default function AlbumShell({
  paletteId,
  fontId,
  whatsapp,
  children,
}: {
  paletteId?: string;
  fontId?: string;
  whatsapp?: string;
  children: React.ReactNode;
}) {
  const wa = whatsapp ?? WHATSAPP_URL;
  return (
    <div className="shell">
      <PaletteVars id={paletteId} />
      <FontVars id={fontId} />
      <StructuredData />
      <main className="page">
        <SiteHeader whatsapp={wa} solid />
        {children}
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
                <Link href="/portraits">Portraits</Link>
                <Link href="/weddings">Weddings</Link>
                <Link href="/portfolio">Portfolio</Link>
              </div>
            </nav>
            <div className="foot-col">
              <p className="foot-h">CONTACT</p>
              <div className="foot-links">
                <a href={wa} target="_blank" rel="noreferrer">
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
