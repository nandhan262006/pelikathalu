"use client";

import { useCallback, useEffect, useState } from "react";
import { Arrow, Menu } from "@/components/Icons";
import Reels from "@/components/Reels";
import PaletteVars from "@/components/PaletteVars";
import type { SiteContent } from "@/lib/content";

const MENU_HREFS: Record<string, string> = {
  "New-age Films": "#films",
  "About Us": "#duo",
  "Our Story": "#our-story",
  "The Little Things": "#little-things",
  "Modern Romance": "#romance",
  Documentary: "#documentary",
  Portraits: "/portraits",
  Weddings: "/weddings",
  Gallery: "/portfolio",
};

type AlbumCard = {
  slug: string;
  title: string;
  count: number;
  cover: string | null;
  category?: string;
  featured?: boolean;
};

export default function SiteRenderer({
  content: serverContent,
  allowLive = false,
}: {
  content: SiteContent;
  allowLive?: boolean;
}) {
  const [c, setC] = useState(serverContent);
  const [slide, setSlide] = useState(0);
  const [review, setReview] = useState(0);
  const [menu, setMenu] = useState(false);
  const [albums, setAlbums] = useState<AlbumCard[]>([]);
  const [featuredPortraits, setFeaturedPortraits] = useState<AlbumCard[]>([]);

  useEffect(() => setC(serverContent), [serverContent]);

  // Live preview: the dashboard pushes draft content into this same-origin iframe.
  useEffect(() => {
    if (!allowLive) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; content?: SiteContent };
      if (data?.type === "pk-preview" && data.content) setC(data.content);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [allowLive]);

  // Arrange mode: the dashboard toggles free drag-placement of theater reels in the preview.
  const [arrange, setArrange] = useState(false);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; on?: boolean };
      if (data?.type === "pk-edit") setArrange(!!data.on);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  const moveReel = useCallback(
    (i: number, pos: { x: number; y: number; w: number; h: number }) => {
      window.parent.postMessage({ type: "pk-reel-pos", index: i, ...pos }, window.location.origin);
    },
    []
  );
  const snapshotReels = useCallback(
    (items: { i: number; x: number; y: number; w: number; h: number }[], boxH: number, ratio: number) => {
      window.parent.postMessage({ type: "pk-reel-snap", items, boxH, ratio }, window.location.origin);
    },
    []
  );

  useEffect(() => {
    fetch("/api/albums?category=wedding&nonempty=1")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setAlbums(d.albums))
      .catch(() => setAlbums([]));
    // Featured portrait albums appear in the Gallery slideshow on home.
    fetch("/api/albums?category=portrait&featured=1&nonempty=1")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setFeaturedPortraits(d.albums))
      .catch(() => setFeaturedPortraits([]));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % c.hero.slides.length), 4000);
    return () => clearInterval(t);
  }, [c.hero.slides.length]);

  useEffect(() => {
    const els = Array.from(document.querySelectorAll("[data-reveal]"));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in-view");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [c, albums, featuredPortraits]);

  const r = c.reviews[review % c.reviews.length];
  const move = (d: number) => setReview((i) => (i + d + c.reviews.length) % c.reviews.length);

  return (
    <div className="shell">
      <PaletteVars id={c.theme?.paletteId} />
      <main className="page">
        {/* Header — VOWS style: hamburger left, logo center, underlined CTA right */}
        <header className="header">
          <button className="menu-btn" aria-label="Open menu" onClick={() => setMenu(true)}>
            <Menu className="menu-ico" />
          </button>
          <a href="#" className="logo" aria-label={c.branding.ariaName}>
            <span className="logo-name">{c.branding.logoName}</span>
            <span className="logo-sub">{c.branding.logoSub}</span>
          </a>
          <a className="book-cta" href={c.links.whatsapp} target="_blank" rel="noreferrer">
            {c.hero.cta}
          </a>
        </header>
        {menu && (
          <div className="menu-overlay" role="dialog" aria-modal="true" aria-label="Menu">
            <button className="menu-close" aria-label="Close menu" onClick={() => setMenu(false)}>
              ✕
            </button>
            {c.menu.map((label) => (
              <a key={label} href={MENU_HREFS[label] ?? "#"} onClick={() => setMenu(false)}>
                {label}
              </a>
            ))}
          </div>
        )}

        {/* Hero */}
        <section className="v-hero">
          <div
            key={`img-${slide}`}
            className="hero-img"
            style={{ backgroundImage: `url("${c.hero.slides[slide].img}")`, ...(c.hero.slides[slide].imgCrop ? { backgroundPosition: c.hero.slides[slide].imgCrop } : {}) }}
          />
          <div className="hero-fade" />
          <div className="hero-content">
            <p className="eyebrow">{c.hero.eyebrow}</p>
            <h1 key={`title-${slide}`} className="hero-title hero-title-swap">
              {c.hero.slides[slide].title} <em>by</em>
              <br />
              {c.branding.logoName}
            </h1>
            <p className="hero-sub">{c.hero.sub}</p>
            <div className="hero-ctas">
              <a href={c.links.whatsapp} target="_blank" rel="noreferrer" className="v-underline-cta">
                {c.hero.cta}
              </a>
            </div>
            <p className="hero-names">{c.hero.names}</p>
            <div className="progress">
              {c.hero.slides.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Slide ${i + 1}`}
                  className={`bar ${i === slide ? "on" : ""}`}
                  onClick={() => setSlide(i)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Duo */}
        <section className="v-duo" id="duo">
          <div className="v-duo-inner">
            <div className="v-team-photo" role="img" aria-label="Prem and Pavan photo coming soon">
              <span className="v-team-ph">Prem &amp; Pavan photo</span>
              <span className="v-team-sub">Drop file at /images/team.jpg to replace</span>
            </div>
            <div className="v-duo-text">
              <p className="script v-script">{c.duo.scriptLine}</p>
              <h2 className="v-big">
                {c.duo.headingBefore} <span className="v-amp">{c.duo.headingHighlight}</span>
                <span className="v-bang">.</span>
              </h2>
              <p className="v-copy">{c.duo.copy}</p>
              <a href="#our-story" className="v-underline-cta">{c.duo.cta}</a>
              <p className="v-hand">{c.duo.hand}</p>
            </div>
          </div>
        </section>

        {/* The little things */}
        <section className="v-little" id="little-things">
          <p className="script v-little-script">{c.littleThings.script}</p>
          <h2 className="v-big" data-reveal>
            {c.littleThings.headingLine1}
            <br />
            {c.littleThings.headingLine2}
          </h2>
          <div className="v-little-strip">
            {c.littleThings.items.map((item, i) => (
              <figure key={item.cap} className="v-little-cell" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
                <div className="v-little-img" style={{ backgroundImage: `url("${item.img}")`, ...(item.imgCrop ? { backgroundPosition: item.imgCrop } : {}) }} />
                <figcaption className="v-little-cap">{item.cap}</figcaption>
              </figure>
            ))}
          </div>
          <p className="v-little-note" data-reveal>
            {c.littleThings.note}
          </p>
        </section>

        {/* Our Story */}
        <section className="v-story-sec" id="our-story">
          <p className="v-eyebrow v-eyebrow-inv">{c.story.eyebrow}</p>
          <h2 className="v-big v-big-inv">
            {c.story.headingLine1}
            <br />
            {c.story.headingLine2}
          </h2>
          <div className="v-chapters">
            {c.story.chapters1.map((ch, i) => (
              <article key={ch.n} className="v-chapter" data-reveal style={{ transitionDelay: `${i * 120}ms` }}>
                <span className="v-chapter-n">{ch.n}</span>
                <h3 className="v-chapter-h">{ch.h}</h3>
                <p className="v-chapter-p">{ch.p}</p>
              </article>
            ))}
          </div>
          <blockquote className="v-pullquote" data-reveal>
            <span className="script v-pull-script">{c.story.pullquote.script}</span>
            {c.story.pullquote.line1}
            <br />
            {c.story.pullquote.line2Before}
            <em>{c.story.pullquote.line2Em}</em>
          </blockquote>
          <div className="v-chapters v-chapters-2">
            {c.story.chapters2.map((ch, i) => (
              <article key={ch.n} className="v-chapter" data-reveal style={{ transitionDelay: `${i * 120}ms` }}>
                <span className="v-chapter-n">{ch.n}</span>
                <h3 className="v-chapter-h">{ch.h}</h3>
                <p className="v-chapter-p">{ch.p}</p>
                {ch.cta && (
                  <a href="#portraits" className="v-underline-cta v-cta-inv">{ch.cta}</a>
                )}
              </article>
            ))}
          </div>
          <p className="v-story-close" data-reveal>
            {c.story.close}
          </p>
          <p className="v-hand v-hand-inv">{c.story.hand}</p>
        </section>

        {/* Moral */}
        <section className="v-moral">
          <p className="script v-moral-script" data-reveal>{c.moral.script}</p>
          <h2 className="v-moral-line" data-reveal style={{ transitionDelay: "120ms" }}>
            {c.moral.line1}
            <br />
            <em>{c.moral.line2Em}</em>
          </h2>
        </section>

        {/* Experience */}
        <section className="v-exp">
          <h2 className="v-big" data-reveal>{c.experience.heading}</h2>
          <p className="v-copy" data-reveal style={{ transitionDelay: "100ms" }}>
            {c.experience.copy}
          </p>
          <a href="#work" className="v-underline-cta">{c.experience.cta}</a>
        </section>

        {/* Modern Romance */}
        <section className="v-grid-sec" id="romance">
          <div className="v-grid">
            {c.romance.grid.map((src) => (
              <div key={src} className="v-tile" style={{ backgroundImage: `url("${src}")` }} />
            ))}
          </div>
          <a href="/portfolio" className="v-underline-cta">{c.romance.cta}</a>
          <p className="v-hand">{c.romance.hand}</p>
        </section>

        {/* Documentary */}
        <section className="v-grid-sec" id="documentary">
          <h2 className="v-banner">{c.documentary.banner}</h2>
          <div className="v-grid">
            {c.documentary.grid.map((src) => (
              <div key={src} className="v-tile" style={{ backgroundImage: `url("${src}")` }} />
            ))}
          </div>
          <a href="/portfolio" className="v-underline-cta">{c.documentary.cta}</a>
        </section>

        {/* Portraits & personalities */}
        <section
          className="v-portraits"
          id="portraits"
          style={{
            ...(c.portraits.bg ? { backgroundImage: `url("${c.portraits.bg}")` } : {}),
            ...(c.portraits.bgCrop ? { backgroundPosition: c.portraits.bgCrop } : {}),
          }}
        >
          <div className="v-portraits-inner">
            <p className="script v-portraits-script" data-reveal>{c.portraits.script}</p>
            <h2 className="v-big v-big-inv" data-reveal style={{ transitionDelay: "80ms" }}>
              {c.portraits.heading}
            </h2>
            <p className="v-portraits-copy" data-reveal style={{ transitionDelay: "160ms" }}>
              {c.portraits.copy}
            </p>
            <p className="v-portraits-proof" data-reveal style={{ transitionDelay: "220ms" }}>
              {c.portraits.proof}
            </p>
            {/* Decorative only — portrait albums now live in the Gallery section below. */}
            {(c.portraits.grid ?? []).length > 0 && (
              <div className="v-tease-scroll" data-reveal style={{ transitionDelay: "240ms" }}>
                {(c.portraits.grid ?? []).slice(0, 6).map((src) => (
                  <a key={src} href="/portraits" className="v-tease-card">
                    <div className="v-tease-img" style={{ backgroundImage: `url("${src}")` }} />
                  </a>
                ))}
              </div>
            )}
            <div data-reveal style={{ transitionDelay: "280ms" }}>
              <a href="/portraits" className="v-underline-cta v-cta-inv">
                {c.portraits.cta}
              </a>
            </div>
          </div>
        </section>

        {/* Weddings — album gallery from Turso + R2 */}
        <section className="v-dest" id="weddings">
          <h2 className="v-big">{c.weddings.heading}</h2>
          <p className="v-small">{c.weddings.sub}</p>
          <div className="v-tease-scroll">
            {albums.map((a) => (
              <a key={a.slug} href={`/weddings/${a.slug}`} className="v-tease-card" data-reveal>
                <div className="v-tease-img" style={a.cover ? { backgroundImage: `url("${a.cover}")` } : undefined} />
                <h3 className="v-names">{a.title}</h3>
              </a>
            ))}
          </div>
          <a href="/weddings" className="v-underline-cta">View all weddings</a>
          <br />
          <a href="#films" className="v-underline-cta">Enter Pelli Kathalu Theater</a>
        </section>

        {/* Theater */}
        <section className="v-theater" id="films">
          <div className="recent-head">
            <div>
              <p className="script recent-script">{c.theater.script}</p>
              <h2 className="recent-title">{c.theater.title}</h2>
            </div>
            <span className="cine-hint">{c.theater.cineHint}</span>
          </div>
          <div className={`theater-box${arrange ? " arranging" : ""}`}>
            <Reels reels={c.theater.reels} edit={arrange} onMove={moveReel} onSnapshot={snapshotReels} canvasH={c.theater.canvasH} canvasRatio={c.theater.canvasRatio} />
            {arrange && <p className="arrange-hint">Drag reels to move · corner handle to resize — releases autosave</p>}
          </div>
          <p className="v-hand">{c.theater.hand}</p>
        </section>

        {/* Gallery slideshow — featured PORTRAIT albums (weddings have their own section above) */}
        <section className="v-tease" id="work">
          <h2 className="v-big">{c.gallery.heading}</h2>
          <p className="v-small">{c.gallery.small}</p>
          <div className="v-tease-scroll">
            {featuredPortraits.length > 0
              ? featuredPortraits
                  .slice(0, 6)
                  .map((g) => (
                    <a key={g.slug} href={`/portraits/${g.slug}`} className="v-tease-card">
                      <div
                        className="v-tease-img"
                        style={g.cover ? { backgroundImage: `url("${g.cover}")` } : undefined}
                      />
                      <h3 className="v-names">{g.title}</h3>
                    </a>
                  ))
              : c.gallery.items.map((g) => (
                  <a key={g.names} href="/portraits" className="v-tease-card">
                    <div className="v-tease-img" style={{ backgroundImage: `url("${g.img}")`, ...(g.imgCrop ? { backgroundPosition: g.imgCrop } : {}) }} />
                    <h3 className="v-names">{g.names}</h3>
                  </a>
                ))}
          </div>
          <a href="/portraits" className="v-underline-cta">{c.gallery.cta}</a>
        </section>

        {/* Reviews */}
        <section className="testi" id="reviews">
          <button className="circle-btn left" onClick={() => move(-1)} aria-label="Previous review">
            <Arrow dir="left" className="circle-arrow" />
          </button>
          <div className="avatar" style={{ backgroundImage: `url("${r.img}")`, ...(r.imgCrop ? { backgroundPosition: r.imgCrop } : {}) }} />
          <div className="quote">
            <span className="qmark">“</span>
            <p className="quote-text">
              {r.text.map((t) => (
                <span key={t}>
                  {t}
                  <br />
                </span>
              ))}
            </p>
            <p className="quote-name">— {r.name}</p>
            <div className="dots">
              {c.reviews.map((_, i) => (
                <button
                  key={i}
                  className={`dot ${i === review ? "on" : ""}`}
                  onClick={() => setReview(i)}
                  aria-label={`Review ${i + 1}`}
                />
              ))}
            </div>
          </div>
          <button className="circle-btn right" onClick={() => move(1)} aria-label="Next review">
            <Arrow className="circle-arrow" />
          </button>
        </section>

        {/* Book */}
        <section className="book" id="book">
          <div className="book-img" style={{ backgroundImage: `url("${c.book.img}")`, ...(c.book.imgCrop ? { backgroundPosition: c.book.imgCrop } : {}) }} />
          <div className="book-text">
            <p className="book-eyebrow">{c.book.eyebrow}</p>
            <h2 className="book-title">{c.book.title}</h2>
            <p className="book-copy">
              {c.book.copyLines.map((line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
            </p>
            <div className="hero-ctas">
              <a href={c.links.whatsapp} target="_blank" rel="noreferrer" className="pill hero-btn">
                {c.book.primaryCta} <Arrow className="pill-arrow" />
              </a>
              <a href="/portfolio" className="ghost ghost-dark">
                {c.book.secondaryCta}
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="site-footer green-texture">
          <div className="foot-top">
            <div className="foot-brand">
              <div className="logo" aria-label={c.branding.ariaName}>
                <span className="logo-name">{c.branding.logoName}</span>
                <span className="logo-sub">{c.branding.logoSub}</span>
              </div>
              <p className="foot-tag">{c.footer.tagline}</p>
            </div>
            <nav className="foot-col" aria-label="Explore">
              <p className="foot-h">EXPLORE</p>
              <div className="foot-links">
                {c.footer.explore.map((l) => (
                  <a key={l.label} href={l.href}>{l.label}</a>
                ))}
              </div>
            </nav>
            <div className="foot-col">
              <p className="foot-h">CONTACT</p>
              <div className="foot-links">
                {c.footer.contact.map((l) => (
                  <a
                    key={l.label}
                    href={l.href === "whatsapp" ? c.links.whatsapp : c.links.instagram}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div className="foot-bottom">
            <span>{c.footer.copyright}</span>
            <span>{c.footer.right}</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
