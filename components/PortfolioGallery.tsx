"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Arrow } from "@/components/Icons";

export default function PortfolioGallery({ photos }: { photos: string[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);

  const close = useCallback(() => setIndex(null), []);
  const step = useCallback(
    (d: number) => setIndex((i) => (i === null ? i : (i + d + photos.length) % photos.length)),
    [photos.length]
  );

  // Keyboard: arrows + escape. Lock body scroll while open.
  useEffect(() => {
    if (index === null) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [index, close, step]);

  // Preload neighbours so arrow/swipe feels instant.
  useEffect(() => {
    if (index === null) return;
    for (const d of [1, -1, 2, -2]) {
      const img = new Image();
      img.src = photos[(index + d + photos.length) % photos.length];
    }
  }, [index, photos]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
    touchY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null || touchY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    const dy = e.changedTouches[0].clientY - touchY.current;
    touchX.current = touchY.current = null;
    // Horizontal swipe wins over vertical scroll.
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) step(dx < 0 ? 1 : -1);
  };

  return (
    <>
      <div className="portfolio-grid">
        {photos.map((src, i) => (
          <figure
            key={src}
            className="portfolio-item"
            onClick={() => setIndex(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIndex(i);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`Open photo ${i + 1} of ${photos.length}`}
          >
            <img src={src} alt="Portfolio photograph by Pelli Kathalu" loading="lazy" draggable={false} />
          </figure>
        ))}
      </div>

      {index !== null && (
        <div
          className="lb"
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${index + 1} of ${photos.length}`}
          onClick={close}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button className="lb-close" onClick={close} aria-label="Close viewer">
            ✕
          </button>
          <span className="lb-count">
            {index + 1} / {photos.length}
          </span>

          <button
            className="lb-nav lb-prev"
            aria-label="Previous photo"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
          >
            <Arrow dir="left" className="lb-arrow" />
          </button>

          <figure className="lb-stage" onClick={(e) => e.stopPropagation()}>
            <img
              key={photos[index]}
              src={photos[index]}
              alt={`Portfolio photograph ${index + 1} by Pelli Kathalu`}
              className="lb-img"
              draggable={false}
            />
          </figure>

          <button
            className="lb-nav lb-next"
            aria-label="Next photo"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
          >
            <Arrow className="lb-arrow" />
          </button>
        </div>
      )}
    </>
  );
}
