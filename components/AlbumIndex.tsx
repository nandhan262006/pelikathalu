"use client";

import Link from "next/link";
import type { AlbumRow } from "@/lib/albums";

export default function AlbumIndex({
  eyebrow,
  title,
  sub,
  base,
  albums,
  emptyHint,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  base: "portraits" | "weddings";
  albums: AlbumRow[];
  emptyHint: string;
}) {
  return (
    <section className="portfolio">
      <div className="portfolio-head">
        <div>
          <p className="script recent-script">{eyebrow}</p>
          <h1 className="recent-title">{title}</h1>
          <p className="portfolio-sub">{sub}</p>
        </div>
        <Link href="/" className="view-all">
          Home
        </Link>
      </div>

      {albums.length === 0 ? (
        <p className="portfolio-sub">{emptyHint}</p>
      ) : (
        <div className="albums-grid">
          {albums.map((a) => (
            <Link key={a.slug} href={`/${base}/${a.slug}`} className="album-card">
              <div
                className="album-cover"
                style={a.cover ? { backgroundImage: `url("${a.cover}")` } : undefined}
                role="img"
                aria-label={`${a.title} cover`}
              >
                {a.featured && <span className="album-badge">Featured</span>}
                <span className="album-count">
                  {a.count} {a.count === 1 ? "frame" : "frames"}
                </span>
              </div>
              <div className="album-body">
                <h2 className="album-title">{a.title}</h2>
                {a.description ? <p className="album-desc">{a.description}</p> : null}
                <span className="album-open">
                  Open gallery <span aria-hidden>→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
