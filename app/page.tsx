"use client";

import { useEffect, useState } from "react";
import { Arrow, Heart, Home, Menu, Portfolio, WhatsApp } from "@/components/Icons";
import Reels from "@/components/Reels";

const WHATSAPP_URL = "https://wa.me/"; // add the studio number, e.g. https://wa.me/91XXXXXXXXXX
const INSTAGRAM_URL = "https://www.instagram.com/portraits.by_pellikathalu/";

const heroes = [
  { img: "/images/hero1.webp", title: "Portraits" },
  { img: "/images/hero2.jpg", title: "Portraits" },
  { img: "/images/hero3.webp", title: "Weddings" },
];

const categories = [
  { label: ["Portraits"], img: "/images/portraits.jpg", pos: "50% 30%" },
  { label: ["Weddings"], img: "/images/weddings.jpg", pos: "50% 10%" },
  { label: ["Pre", "Weddings"], img: "/images/pre-weddings.jpg", pos: "50% 25%" },
  { label: ["Events"], img: "/images/events.jpg", pos: "50% 20%" },
];

// Compact highlights — full archive lives on /portfolio.
const recent = [
  { img: "/images/recent-1.jpg", pos: "50% 15%" },
  { img: "/images/recent-2.jpg", pos: "50% 25%" },
  { img: "/images/recent-3.jpg", pos: "50% 5%" },
  { img: "/images/recent-4.jpg", pos: "50% 20%" },
  { img: "/images/2026-10-03_11-44-48_UTC_1.jpg", pos: "50% 20%" },
  { img: "/images/2026-10-03_11-44-48_UTC_2.jpg", pos: "50% 20%" },
];

// Wedding highlights — verified wedding-shoot frames.
const weddings = [
  { img: "/images/weddings.jpg", pos: "50% 15%" },
  { img: "/images/2026-03-19_04-10-36_UTC_5.webp", pos: "50% 20%" },
  { img: "/images/2026-03-19_04-10-36_UTC_2.webp", pos: "50% 20%" },
  { img: "/images/2026-03-19_04-10-36_UTC_3.webp", pos: "50% 30%" },
  { img: "/images/2026-03-19_04-10-36_UTC_6.webp", pos: "50% 30%" },
  { img: "/images/2026-03-19_04-10-36_UTC_4.webp", pos: "50% 15%" },
];

// Cinematics — drop these 4 files into /public/reels/.
// Tiles auto-detect vertical vs horizontal from the video itself.
const reels = [
  { src: "/reels/portrait-1.mp4", poster: "/reels/poster-portrait-1.jpg", label: "Portraits" },
  { src: "/reels/portrait-2.mp4", poster: "/reels/poster-portrait-2.jpg", label: "Portraits" },
  { src: "/reels/wedding-1.mp4", poster: "/reels/poster-wedding-1.jpg", label: "Weddings" },
  { src: "/reels/wedding-2.mp4", poster: "/reels/poster-wedding-2.jpg", label: "Weddings" },
];

const reviews = [
  {
    name: "ASHIKA R.",
    img: "/images/ashika.jpg",
    text: [
      "Their work is full of emotion and so natural.",
      "They made the entire shoot feel so comfortable.",
      "The pictures are just magical! ♡",
    ],
  },
  {
    name: "SIMRAN",
    img: "/images/recent-3.jpg",
    text: ["Every frame felt like a memory.", "Prem & Pavan are so easy to work with.", "Absolutely loved it! ♡"],
  },
  {
    name: "MEGHALEKHA",
    img: "/images/weddings.jpg",
    text: ["They captured exactly how I felt that day.", "Calm, patient and so creative.", "Highly recommend! ♡"],
  },
  {
    name: "ANANYA",
    img: "/images/pre-weddings.jpg",
    text: ["Beautiful light, beautiful stories.", "Our pre-wedding shoot was a dream.", "Thank you both! ♡"],
  },
];

export default function Page() {
  const [slide, setSlide] = useState(0);
  const [review, setReview] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % heroes.length), 4000);
    return () => clearInterval(t);
  }, []);

  const r = reviews[review];
  const move = (d: number) => setReview((i) => (i + d + reviews.length) % reviews.length);

  return (
    <div className="shell">
      <main className="page">
        {/* Header */}
        <header className="header">
          <a href="#" className="logo" aria-label="Portraits by Pelli Kathalu">
            <span className="logo-by">Portraits by</span>
            <span className="logo-name">Pelli Kathalu</span>
            <span className="logo-sub">PREM &amp; PAVAN</span>
          </a>
          <nav className="desktop-nav" aria-label="Primary">
            <a href="#">Home</a>
            <a href="/portfolio">Portfolio</a>
            <a href="#reviews">Reviews</a>
            <a href="#story">Our Story</a>
          </nav>
          <a className="book-btn" href={WHATSAPP_URL} target="_blank" rel="noreferrer">
            <WhatsApp className="book-ico" />
            Book a Shoot
          </a>
          <button className="menu-btn" aria-label="Open menu">
            <Menu className="menu-ico" />
          </button>
        </header>

        {/* Hero */}
        <section className="hero">
          <div key={`img-${slide}`} className="hero-img" style={{ backgroundImage: `url(${heroes[slide].img})` }} />
          <div className="hero-fade" />
          <div className="hero-content">
            <p className="eyebrow">PEOPLE · EMOTIONS · STORIES</p>
            <h1 key={`title-${slide}`} className="hero-title hero-title-swap">
              {heroes[slide].title} <em>by</em>
              <br />
              Pelli Kathalu
            </h1>
            <p className="hero-sub">Captured the way they feel.</p>
            <div className="hero-ctas">
              <a href="#work" className="pill hero-btn">
                View Our Work <Arrow className="pill-arrow" />
              </a>
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="ghost hero-ghost">
                Book a Shoot
              </a>
            </div>
            <p className="hero-names">PREM &amp; PAVAN</p>
            <div className="progress">
              {heroes.map((_, i) => (
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

        {/* Categories */}
        <section className="cats">
          {categories.map((c) => (
            <a key={c.label.join(" ")} href="#work" className="cat">
              <div className="cat-img" style={{ backgroundImage: `url(${c.img})`, backgroundPosition: c.pos }} />
              <span className="cat-label">
                {c.label.map((l) => (
                  <span key={l}>{l}</span>
                ))}
                <i className="cat-line" />
              </span>
            </a>
          ))}
        </section>

        {/* About */}
        <section className="about">
          <div className="about-collage" role="img" aria-label="Prem and Pavan portrait polaroids">
            <div className="pol pol-back">
              <div className="pol-img" style={{ backgroundImage: "url(/images/hero1.webp)" }} />
            </div>
            <div className="pol pol-front">
              <div className="pol-img" style={{ backgroundImage: "url(/images/portraits.jpg)", backgroundPosition: "50% 20%" }} />
            </div>
            <span className="pol-tape" />
          </div>
          <div className="about-text">
            <p className="script about-script">About us</p>
            <h2 className="about-title">
              More than
              <br />
              just photographs.
            </h2>
            <p className="about-copy">
              We are Prem &amp; Pavan, the duo behind
              <br />
              Portraits by Pelli Kathalu. We love
              <br />
              capturing real people, real emotions
              <br />
              and the little stories that make
              <br />
              your journey special.
            </p>
            <a href="#story" className="pill about-btn">
              Know Our Story <Arrow className="pill-arrow" />
            </a>
          </div>
          <img className="leaf leaf-about" src="/images/leaf-about.png" alt="" />
        </section>

        {/* Why us */}
        <section className="why">
          <div className="why-inner">
            <p className="script why-script">Why us</p>
            <h2 className="why-title">
              We&apos;re your next stop
              <br />
              for every photoshoot.
            </h2>
            <p className="why-copy">
              Portraits, pre-weddings, weddings — if there&apos;s a story to tell,
              Prem &amp; Pavan are the best at telling it. Creative to the core,
              obsessed with real emotion, and magically easy to shoot with.
            </p>
            <div className="why-points">
              <div className="why-point">
                <span className="why-num">01</span>
                <div>
                  <p className="why-h">Simply the best</p>
                  <p className="why-p">Frames clients call “magical” — natural, emotional, timeless.</p>
                </div>
              </div>
              <div className="why-point">
                <span className="why-num">02</span>
                <div>
                  <p className="why-h">Creative to the core</p>
                  <p className="why-p">Fresh ideas, dreamy light, stories that feel like you.</p>
                </div>
              </div>
              <div className="why-point">
                <span className="why-num">03</span>
                <div>
                  <p className="why-h">Zero awkwardness</p>
                  <p className="why-p">Camera-shy? They make every shoot fun, calm and effortless.</p>
                </div>
              </div>
            </div>
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="pill why-btn">
              Book a Shoot <Arrow className="pill-arrow" />
            </a>
          </div>
        </section>

        {/* Recent work */}
        <section className="recent" id="work">
          <div className="recent-head">
            <div>
              <p className="script recent-script">Featured</p>
              <h2 className="recent-title">Our Recent Work</h2>
            </div>
            <a href="/portfolio" className="view-all">
              View More <Arrow className="va-arrow" />
            </a>
          </div>
          <div className="recent-grid">
            {recent.map((p) => (
              <div key={p.img} className="recent-item" style={{ backgroundImage: `url(${p.img})`, backgroundPosition: p.pos }} />
            ))}
          </div>

          {/* Weddings strip */}
          <div className="wed-block">
            <div className="wed-head">
              <div>
                <p className="script recent-script">Weddings</p>
                <h3 className="recent-title">Straight From Our Weddings</h3>
              </div>
              <a href="/portfolio" className="view-all">
                Full Portfolio <Arrow className="va-arrow" />
              </a>
            </div>
            <div className="recent-grid">
              {weddings.map((p) => (
                <div key={p.img} className="recent-item" style={{ backgroundImage: `url(${p.img})`, backgroundPosition: p.pos }} />
              ))}
            </div>
          </div>
        </section>

        {/* Cinematics — muted autoplay, tap any reel for sound */}
        <section className="cine">
          <div className="recent-head">
            <div>
              <p className="script recent-script">Motion</p>
              <h2 className="recent-title">Cinematics &amp; Reels</h2>
            </div>
            <span className="cine-hint">Tap a video for sound</span>
          </div>
          <Reels reels={reels} />
        </section>

        {/* Testimonial */}
        <section className="testi" id="reviews">
          <button className="circle-btn left" onClick={() => move(-1)} aria-label="Previous review">
            <Arrow dir="left" className="circle-arrow" />
          </button>
          <div className="avatar" style={{ backgroundImage: `url(${r.img})` }} />
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
              {reviews.map((_, i) => (
                <button key={i} className={`dot ${i === review ? "on" : ""}`} onClick={() => setReview(i)} aria-label={`Review ${i + 1}`} />
              ))}
            </div>
          </div>
          <img className="leaf leaf-testi" src="/images/leaf-testimonial.png" alt="" />
          <button className="circle-btn right" onClick={() => move(1)} aria-label="Next review">
            <Arrow className="circle-arrow" />
          </button>
        </section>

        {/* Book */}
        <section className="book" id="story">
          <div className="book-img" style={{ backgroundImage: "url(/images/book-shoot.jpg)" }} />
          <div className="book-text">
            <p className="book-eyebrow">LET’S CREATE YOUR STORY</p>
            <h2 className="book-title">Book Your Shoot</h2>
            <p className="book-copy">
              Portraits, pre-weddings, weddings or
              <br />
              just you — we’d love to be a part of
              <br />
              your story.
            </p>
          </div>
          <img className="leaf leaf-book" src="/images/leaf-book.png" alt="" />
        </section>

        {/* Footer */}
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
                <a href="#">Home</a>
                <a href="/portfolio">Portfolio</a>
                <a href="#reviews">Reviews</a>
                <a href="#story">Our Story</a>
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

      {/* Bottom nav */}
      <nav className="bottom-nav">
        <a href="#" className="nav-item active">
          <Home className="nav-ico" />
          <span>Home</span>
          <i className="nav-dot" />
        </a>
        <a href="/portfolio" className="nav-item">
          <Portfolio className="nav-ico" />
          <span>Portfolio</span>
        </a>
        <a href="#reviews" className="nav-item">
          <Heart className="nav-ico" />
          <span>Reviews</span>
        </a>
        <a href="#story" className="nav-item">
          <WhatsApp className="nav-ico" />
          <span>Contact</span>
        </a>
      </nav>
    </div>
  );
}
