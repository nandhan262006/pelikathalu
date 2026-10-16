import Link from "next/link";
import { Arrow } from "@/components/Icons";
import PortfolioGallery from "@/components/PortfolioGallery";

export default function AlbumDetail({
  eyebrow,
  title,
  description,
  count,
  photos,
  backHref,
  backLabel,
}: {
  eyebrow: string;
  title: string;
  description: string | null;
  count: number;
  photos: string[];
  backHref: string;
  backLabel: string;
}) {
  return (
    <section className="portfolio">
      <div className="portfolio-head">
        <div>
          <p className="script recent-script">{eyebrow}</p>
          <h1 className="recent-title">{title}</h1>
          <p className="portfolio-sub">
            {description ? `${description} — ` : ""}
            {count} {count === 1 ? "frame" : "frames"}, every image shown whole.
          </p>
        </div>
      </div>

      {photos.length === 0 ? (
        <p className="portfolio-sub">No photos in this gallery yet — check back soon.</p>
      ) : (
        <PortfolioGallery photos={photos} />
      )}

      <div className="portfolio-foot">
        <Link href={backHref} className="pill portfolio-back">
          <Arrow dir="left" className="pill-arrow" /> {backLabel}
        </Link>
      </div>
    </section>
  );
}
