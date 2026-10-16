"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type PreviewPhoto = { id: number; url: string; caption?: string | null };

/**
 * Full-screen photo popup for the admin panel.
 * Rendered via portal so it sits above the album editor modal.
 * Browse with arrows / swipe / filmstrip, click or button to zoom, Esc to close.
 */
export default function PhotoPreview({
  photos,
  index,
  coverUrl,
  coverBusy,
  onIndex,
  onClose,
  onSetCover,
  onDelete,
}: {
  photos: PreviewPhoto[];
  index: number;
  coverUrl?: string | null;
  coverBusy?: boolean;
  onIndex: (i: number) => void;
  onClose: () => void;
  onSetCover?: (url: string) => void;
  onDelete?: (id: number) => void;
}) {
  const total = photos.length;
  const safe = total === 0 ? 0 : ((index % total) + total) % total;
  const photo = photos[safe];
  const [zoom, setZoom] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // Reset zoom + loading spinner whenever the photo changes.
  useEffect(() => {
    setZoom(false);
    setLoaded(false);
  }, [safe, photo?.url]);

  const prev = useCallback(() => onIndex((safe - 1 + total) % total), [onIndex, safe, total]);
  const next = useCallback(() => onIndex((safe + 1) % total), [onIndex, safe, total]);

  // Global keys — reliable even when focus sits in an input behind the popup.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [prev, next, onClose]);

  // Lock background scroll while the popup is open (album modal already does,
  // but this keeps it locked if preview outlives it).
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Preload neighbours so arrow/swipe browsing feels instant.
  useEffect(() => {
    if (!total) return;
    for (const d of [1, -1, 2, -2]) {
      const img = new Image();
      img.src = photos[(((safe + d) % total) + total) % total]?.url ?? "";
    }
  }, [safe, total, photos]);

  // Keep the active filmstrip thumb in view.
  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>("[data-on='1']")?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [safe]);

  if (!photo || !total) return null;

  const isCover = !!coverUrl && photo.url === coverUrl;

  return createPortal(
    <div
      className="db-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${safe + 1} of ${total} — full preview`}
      onClick={onClose}
      onTouchStart={(e) => {
        touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        if (!touch.current) return;
        const dx = e.changedTouches[0].clientX - touch.current.x;
        const dy = e.changedTouches[0].clientY - touch.current.y;
        touch.current = null;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          if (dx < 0) next();
          else prev();
        }
      }}
    >
      {/* Top bar */}
      <div className="db-lightbox-bar" onClick={(e) => e.stopPropagation()}>
        <span className="db-lightbox-count">
          {safe + 1} / {total}
        </span>
        <span className="db-lightbox-tools">
          <button
            type="button"
            className={`db-btn db-btn-sm${zoom ? " db-btn-active" : ""}`}
            onClick={() => setZoom((z) => !z)}
            title={zoom ? "Zoom out (or click photo)" : "Zoom in 2× (or click photo)"}
          >
            {zoom ? "⤢ 1×" : "⤢ 2×"}
          </button>
          {onSetCover && (
            <button
              type="button"
              className={`db-btn db-btn-sm${isCover ? " db-btn-active" : ""}`}
              disabled={!!coverBusy}
              onClick={() => void onSetCover(photo.url)}
              title={isCover ? "This is the gallery cover" : "Set as gallery cover"}
            >
              {isCover ? "★ Cover" : "☆ Cover"}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="db-btn db-btn-sm db-mini-del"
              onClick={() => onDelete(photo.id)}
              title="Delete this photo"
            >
              Delete
            </button>
          )}
          <button type="button" className="db-lightbox-close" onClick={onClose} aria-label="Close full preview">
            ✕
          </button>
        </span>
      </div>

      {/* Arrows */}
      {total > 1 && (
        <>
          <button
            type="button"
            className="db-lightbox-nav db-lightbox-prev"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            type="button"
            className="db-lightbox-nav db-lightbox-next"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Next photo"
          >
            ›
          </button>
        </>
      )}

      {/* Stage */}
      <figure className="db-lightbox-stage" onClick={(e) => e.stopPropagation()}>
        {!loaded && <span className="db-lightbox-loading" aria-label="Loading full photo" />}
        <img
          key={photo.url}
          src={photo.url}
          alt={`Full preview — photo ${safe + 1} of ${total}`}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onClick={() => setZoom((z) => !z)}
          className={zoom ? "db-lightbox-img db-lightbox-zoom" : "db-lightbox-img"}
          title={zoom ? "Click to zoom out" : "Click to zoom 2×"}
        />
        <figcaption className="db-lightbox-hint">
          {zoom ? "Zoomed 2× — click photo to zoom out" : "Click photo to zoom · ← → to browse · swipe on mobile · Esc to close"}
        </figcaption>
      </figure>

      {/* Filmstrip */}
      {total > 1 && (
        <div className="db-lightbox-strip" ref={stripRef} onClick={(e) => e.stopPropagation()}>
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              data-on={i === safe ? "1" : "0"}
              className={`db-lightbox-thumb${i === safe ? " db-lightbox-thumb-on" : ""}`}
              onClick={() => onIndex(i)}
              aria-label={`Go to photo ${i + 1}`}
            >
              <img src={p.url} alt="" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
