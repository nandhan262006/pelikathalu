import Link from "next/link";
import { notFound } from "next/navigation";
import { Arrow } from "@/components/Icons";
import PortfolioGallery from "@/components/PortfolioGallery";
import SiteHeader from "@/components/SiteHeader";
import PaletteVars from "@/components/PaletteVars";
import { getAlbumBySlug, listPhotos } from "@/lib/albums";
import { getSiteContent } from "@/lib/sites";

export const dynamic = "force-dynamic";

export default async function WeddingAlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const album = await getAlbumBySlug(slug);
  if (!album) notFound();
  const photos = (await listPhotos(slug)).map((p) => p.url);
  const content = await getSiteContent("home", false);

  return (
    <div className="shell">
      <PaletteVars id={content?.theme?.paletteId} />
      <main className="page">
        <SiteHeader whatsapp={content?.links.whatsapp ?? "https://wa.me/"} solid />

        <section className="portfolio">
          <div className="portfolio-head">
            <div>
              <p className="script recent-script">Weddings</p>
              <h1 className="recent-title">{album.title}</h1>
              <p className="portfolio-sub">
                {album.description ? `${album.description} — ` : ""}
                {photos.length} frames, every image shown whole.
              </p>
            </div>
          </div>

          <PortfolioGallery photos={photos} />

          <div className="portfolio-foot">
            <Link href="/#weddings" className="pill portfolio-back">
              <Arrow dir="left" className="pill-arrow" /> All Weddings
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
