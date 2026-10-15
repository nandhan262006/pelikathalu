"use client";

import { useState } from "react";
import { Menu } from "@/components/Icons";

export default function SiteHeader({
  whatsapp,
  solid = false,
}: {
  whatsapp: string;
  solid?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <>
      <header className={`header${solid ? " header-solid" : ""}`}>
        <button className="menu-btn" aria-label="Open menu" onClick={() => setMenu(true)}>
          <Menu className="menu-ico" />
        </button>
        <a href="/" className="logo" aria-label="Pelli Kathalu by Prem and Pavan">
          <span className="logo-name">Pelli Kathalu</span>
          <span className="logo-sub">BY PREM &amp; PAVAN</span>
        </a>
        <a className="book-cta" href={whatsapp} target="_blank" rel="noreferrer">
          Book your wedding
        </a>
      </header>
      {menu && (
        <div className="menu-overlay" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="menu-close" aria-label="Close menu" onClick={() => setMenu(false)}>
            ✕
          </button>
          <a href="/#films" onClick={() => setMenu(false)}>New-age Films</a>
          <a href="/#podcast" onClick={() => setMenu(false)}>Podcast</a>
          <a href="/#duo" onClick={() => setMenu(false)}>About Us</a>
          <a href="/#romance" onClick={() => setMenu(false)}>Modern Romance</a>
          <a href="/#documentary" onClick={() => setMenu(false)}>Documentary</a>
          <a href="/#weddings" onClick={() => setMenu(false)}>Weddings</a>
          <a href="/portfolio" onClick={() => setMenu(false)}>Gallery</a>
        </div>
      )}
    </>
  );
}
