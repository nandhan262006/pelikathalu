"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Arrow } from "@/components/Icons";

export type Reel = { src: string; poster: string; label: string };

const SpeakerOff = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 5 6.5 9H3v6h3.5L11 19V5z" fill="currentColor" stroke="none" />
    <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
  </svg>
);

const SpeakerOn = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 5 6.5 9H3v6h3.5L11 19V5z" fill="currentColor" stroke="none" />
    <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
  </svg>
);

export default function Reels({ reels }: { reels: Reel[] }) {
  const [unmuted, setUnmuted] = useState<number | null>(null);
  // Tall (9:16) until metadata proves otherwise — tiles adapt per video.
  const [tall, setTall] = useState<boolean[]>(() => reels.map(() => true));
  // Fullscreen viewer index (double-tap), null when closed.
  const [full, setFull] = useState<number | null>(null);
  const [fullMuted, setFullMuted] = useState(true);
  const vids = useRef<(HTMLVideoElement | null)[]>([]);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);

  const syncOrientation = (i: number, v: HTMLVideoElement) => {
    if (v.videoWidth > 0) {
      const isTall = v.videoHeight >= v.videoWidth;
      setTall((t) => (t[i] === isTall ? t : t.map((x, j) => (j === i ? isTall : x))));
    }
  };

  // Pause off-screen reels, resume muted autoplay when back in view.
  useEffect(() => {
    const els = vids.current.filter(Boolean) as HTMLVideoElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        }
      },
      { threshold: 0.25 }
    );
    els.forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, []);

  const muteAllGrid = useCallback(() => {
    vids.current.forEach((el) => {
      if (el) el.muted = true;
    });
    setUnmuted(null);
  }, []);

  const toggle = (i: number) => {
    setUnmuted((cur) => {
      const next = cur === i ? null : i;
      vids.current.forEach((el, j) => {
        if (el) el.muted = j !== next;
      });
      return next;
    });
    vids.current[i]?.play().catch(() => {});
  };

  const openFull = useCallback(
    (i: number) => {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      muteAllGrid();
      setFullMuted(false); // explicit gesture — start with sound
      setFull(i);
    },
    [muteAllGrid]
  );

  const closeFull = useCallback(() => setFull(null), []);

  const stepFull = useCallback(
    (d: number) => setFull((f) => (f === null ? f : (f + d + reels.length) % reels.length)),
    [reels.length]
  );

  // Single tap = mute toggle, double tap = fullscreen.
  const onTap = (i: number) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      openFull(i);
    } else {
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
        toggle(i);
      }, 300);
    }
    lastTap.current = now;
  };

  // Clear any pending single-tap on unmount.
  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    []
  );

  // Fullscreen: arrows + escape, lock body scroll.
  useEffect(() => {
    if (full === null) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFull();
      if (e.key === "ArrowRight") stepFull(1);
      if (e.key === "ArrowLeft") stepFull(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [full, closeFull, stepFull]);

  return (
    <>
      <div className="reels-grid">
        {reels.map((r, i) => (
          <figure
            key={r.src}
            className={`reel ${tall[i] ? "reel-v" : "reel-h"}`}
            onClick={() => onTap(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggle(i);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`${r.label} reel ${i + 1} — tap for sound, double-tap for fullscreen`}
          >
            <video
              ref={(el) => {
                vids.current[i] = el;
                if (el) {
                  el.defaultMuted = true;
                  el.muted = unmuted !== i;
                  // Metadata may already be loaded before hydration — sync now.
                  if (el.readyState >= 1) syncOrientation(i, el);
                }
              }}
              src={r.src}
              poster={r.poster}
              muted
              loop
              playsInline
              autoPlay
              preload="metadata"
              disablePictureInPicture
              onLoadedMetadata={(e) => syncOrientation(i, e.currentTarget)}
            />
            <span className="reel-tag">{r.label}</span>
            <span className={`reel-badge ${unmuted === i ? "on" : ""}`} aria-hidden>
              {unmuted === i ? <SpeakerOn /> : <SpeakerOff />}
            </span>
          </figure>
        ))}
      </div>

      {full !== null && (
        <div className="lb" role="dialog" aria-modal="true" aria-label={`${reels[full].label} reel fullscreen`} onClick={closeFull}>
          <button className="lb-close" onClick={closeFull} aria-label="Close fullscreen viewer">
            ✕
          </button>
          <span className="lb-count">
            {full + 1} / {reels.length}
          </span>

          <button
            className="lb-nav lb-prev"
            aria-label="Previous reel"
            onClick={(e) => {
              e.stopPropagation();
              stepFull(-1);
            }}
          >
            <Arrow dir="left" className="lb-arrow" />
          </button>

          <figure
            className="lb-stage"
            onClick={(e) => {
              e.stopPropagation();
              setFullMuted((m) => !m);
            }}
            role="button"
            aria-label={fullMuted ? "Unmute reel" : "Mute reel"}
          >
            <video
              key={reels[full].src}
              src={reels[full].src}
              poster={reels[full].poster}
              muted={fullMuted}
              loop
              playsInline
              autoPlay
              preload="auto"
              className="lb-video"
            />
            <span className={`reel-badge lb-vbadge ${!fullMuted ? "on" : ""}`} aria-hidden>
              {!fullMuted ? <SpeakerOn /> : <SpeakerOff />}
            </span>
          </figure>

          <button
            className="lb-nav lb-next"
            aria-label="Next reel"
            onClick={(e) => {
              e.stopPropagation();
              stepFull(1);
            }}
          >
            <Arrow className="lb-arrow" />
          </button>
        </div>
      )}
    </>
  );
}
