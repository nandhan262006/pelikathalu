"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { Arrow } from "@/components/Icons";

export type Reel = { src: string; poster?: string; label: string; rotate?: number; spot?: string; x?: number; y?: number; w?: number; h?: number };

type ReelPos = { x: number; y: number; w: number; h: number };
type Corner = "nw" | "ne" | "sw" | "se";
const r1 = (v: number) => Math.round(v * 10) / 10;
const CORNERS: Corner[] = ["nw", "ne", "sw", "se"];
// Tile spin in degrees (0/90/180/270); legacy boolean true = 90.
const degOf = (r?: { rotate?: number | boolean }) =>
  typeof r?.rotate === "number" ? ((Math.round(r.rotate) % 360) + 360) % 360 : r?.rotate ? 90 : 0;

// The curated 5-reel desktop art direction. Locks apply only when the full set is
// present — any other count falls back to dense auto-flow (see globals.css).
const KNOWN_SPOTS = ["reel-vt-1", "reel-vt-2", "reel-vt-4", "reel-vt-w1", "reel-vt-w2"];

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

export default function Reels({
  reels,
  edit = false,
  onMove,
  onSnapshot,
  onRotate,
  canvasH,
  canvasRatio,
}: {
  reels: Reel[];
  edit?: boolean;
  onMove?: (i: number, pos: ReelPos) => void;
  onSnapshot?: (items: ({ i: number } & ReelPos)[], boxH: number, ratio: number) => void;
  onRotate?: (i: number, rotate: number) => void;
  canvasH?: number;
  canvasRatio?: number;
}) {
  const [unmuted, setUnmuted] = useState<number | null>(null);
  // Tall (9:16) until metadata proves otherwise — tiles adapt per video.
  const [tall, setTall] = useState<boolean[]>(() => reels.map(() => true));
  // Fullscreen viewer index (double-tap), null when closed.
  const [full, setFull] = useState<number | null>(null);
  const [fullMuted, setFullMuted] = useState(true);
  const vids = useRef<(HTMLVideoElement | null)[]>([]);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);

  // --- Arrange mode: free drag + non-uniform corner resize inside the theater box ---
  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ i: number; mode: "move" | "size"; corner: Corner; sx: number; sy: number; box: DOMRect; orig: ReelPos } | null>(null);
  const [live, setLive] = useState<({ i: number } & ReelPos) | null>(null);
  const dragged = useRef(false);

  const startDrag = (i: number, e: RPointerEvent<HTMLElement>, mode: "move" | "size", corner: Corner = "se") => {
    if (!edit || full !== null) return;
    const box = gridRef.current?.getBoundingClientRect();
    if (!box) return;
    const el = (e.currentTarget.closest(".reel") as HTMLElement | null)?.getBoundingClientRect() ?? e.currentTarget.getBoundingClientRect();
    const r = reels[i];
    const orig: ReelPos =
      r.x != null && r.y != null && r.w != null && r.h != null
        ? { x: r.x, y: r.y, w: r.w, h: r.h }
        : {
            x: ((el.left - box.left) / box.width) * 100,
            y: ((el.top - box.top) / box.height) * 100,
            w: (el.width / box.width) * 100,
            h: (el.height / box.height) * 100,
          };
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { i, mode, corner, sx: e.clientX, sy: e.clientY, box, orig };
    setLive({ i, ...orig });
    dragged.current = false;
    e.preventDefault();
    e.stopPropagation();
    // preventDefault above blocks click-to-focus — focus the reel explicitly
    // so Shift+R (rotate) lands on the figure's keydown handler.
    (e.currentTarget.closest(".reel") as HTMLElement | null)?.focus({ preventScroll: true });
  };

  const onDragMove = (e: RPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = ((e.clientX - d.sx) / d.box.width) * 100;
    const dy = ((e.clientY - d.sy) / d.box.height) * 100;
    if (Math.abs(dx) + Math.abs(dy) > 0.5) dragged.current = true;
    if (d.mode === "move") {
      setLive({ i: d.i, x: r1(d.orig.x + dx), y: r1(d.orig.y + dy), w: r1(d.orig.w), h: r1(d.orig.h) });
      return;
    }
    // Non-uniform resize: width and height follow the pointer independently.
    const right = d.corner === "ne" || d.corner === "se";
    const bottom = d.corner === "se" || d.corner === "sw";
    const w = r1(Math.max(6, right ? d.orig.w + dx : d.orig.w - dx));
    const h = r1(Math.max(6, bottom ? d.orig.h + dy : d.orig.h - dy));
    const x = r1(right ? d.orig.x : d.orig.x + (d.orig.w - w));
    const y = r1(bottom ? d.orig.y : d.orig.y + (d.orig.h - h));
    setLive({ i: d.i, x, y, w, h });
  };

  const endDrag = (e: RPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer capture may already be released */
    }
    if (live && dragged.current) onMove?.(live.i, { x: live.x, y: live.y, w: live.w, h: live.h });
    setLive(null);
  };

  // Entering arrange mode: convert every reel from grid slot to absolute coords in one shot.
  // Also re-runs (debounced) on window resize so the canvas ratio follows the viewport.
  useEffect(() => {
    if (!edit || !onSnapshot) return;
    const snap = () => {
      const box = gridRef.current?.getBoundingClientRect();
      if (!box || box.width === 0 || box.height === 0) return;
      // The stored composition is desktop art direction. Never snapshot a
      // phone-width or stacked-flow canvas — doing so writes phone ratio/coords
      // into the draft, which then explode the desktop theater (ratio < 1 makes
      // the canvas taller than it is wide). Both guards must hold.
      if (box.width < 700 || box.width / box.height < 1) return;
      const els = Array.from(gridRef.current?.querySelectorAll(".reel") ?? []) as HTMLElement[];
      // DOM order skips reels with no src — map DOM position back to reel index.
      const idxs = reels.map((r, i) => (r.src ? i : -1)).filter((i) => i >= 0);
      const items = idxs
        .map((reelIdx, pos) => {
          const el = els[pos];
          if (!el) return null;
          const b = el.getBoundingClientRect();
          return {
            i: reelIdx,
            x: r1(((b.left - box.left) / box.width) * 100),
            y: r1(((b.top - box.top) / box.height) * 100),
            w: r1((b.width / box.width) * 100),
            h: r1((b.height / box.height) * 100),
          };
        })
        .filter((v): v is { i: number } & ReelPos => v !== null);
      onSnapshot(items, Math.round(box.height), r1(box.width / box.height));
    };
    const t = setTimeout(snap, 80);
    let rt: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (rt) clearTimeout(rt);
      rt = setTimeout(snap, 400);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      if (rt) clearTimeout(rt);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit]);

  const syncOrientation = (i: number, v: HTMLVideoElement) => {
    if (reels[i]?.rotate) return;
    if (v.videoWidth > 0) {
      const isTall = v.videoHeight >= v.videoWidth;
      setTall((t) => {
        if (t.length > i && t[i] === isTall) return t;
        // `tall` may lag behind a newly added reel — grow it so the write lands
        // and the value actually stabilizes (else setState fires every commit).
        const n = t.length > i ? t.slice() : [...t, ...Array(i + 1 - t.length).fill(true)];
        n[i] = isTall;
        return n;
      });
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
    (d: number) =>
      setFull((f) => {
        if (f === null) return f;
        let n = f;
        for (let k = 0; k < reels.length; k++) {
          n = (n + d + reels.length) % reels.length;
          if (reels[n].src) break; // skip entries with no video
        }
        return n;
      }),
    [reels]
  );

  // Single tap = mute toggle, double tap = fullscreen.
  const onTap = (i: number) => {
    if (edit || dragged.current) return;
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

  // Ratio canvas wins over the legacy px snapshot; spot locks need the full 5-spot set.
  const ratioMode = canvasRatio != null && canvasRatio > 0;
  const placedLegacy = !ratioMode && canvasH != null;
  const locked =
    reels.length === KNOWN_SPOTS.length &&
    reels.every((r) => r.spot != null && KNOWN_SPOTS.includes(r.spot)) &&
    new Set(reels.map((r) => r.spot)).size === KNOWN_SPOTS.length;

  return (
    <>
      <div
        className={`reels-grid${edit ? " editing" : ""}${ratioMode ? " placed-ratio" : placedLegacy ? " placed" : ""}${locked ? " reels-locked" : ""}`}
        ref={gridRef}
        style={
          ratioMode
            ? ({ ["--theater-ratio" as string]: `${canvasRatio}` } as CSSProperties)
            : placedLegacy
              ? ({ ["--theater-h" as string]: `${canvasH}px` } as CSSProperties)
              : undefined
        }
      >
        {reels.map((r, i) => {
          // An empty src makes the browser re-download the page — skip broken entries.
          if (!r.src) return null;
          const pos = live && live.i === i ? live : r.x != null && r.y != null && r.w != null && r.h != null ? r : null;
          // Tile spin in degrees.
          const deg = degOf(r);
          const tileStyle: CSSProperties | undefined =
            pos || deg
              ? {
                  ...(pos ? { left: `${pos.x}%`, top: `${pos.y}%`, width: `${pos.w}%`, height: `${pos.h}%` } : null),
                  ...(deg ? { transform: `rotate(${deg}deg)`, zIndex: 2 } : null),
                }
              : undefined;
          return (
            <figure
              key={`${i}:${r.src}`}
              className={`reel ${(tall[i] ?? true) ? "reel-v" : "reel-h"}${deg ? " reel-rot" : ""}${r.spot ? ` ${r.spot}` : ""}${pos ? " reel-placed" : ""}`}
              style={tileStyle}
              onClick={() => onTap(i)}
              onKeyDown={(e) => {
                // Arrange mode: Shift+R on a focused reel adds another 90° of spin.
                if (edit && onRotate && e.shiftKey && (e.key === "r" || e.key === "R")) {
                  e.preventDefault();
                  e.stopPropagation();
                  onRotate(i, (deg + 90) % 360);
                  return;
                }
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(i);
                }
              }}
              onPointerDown={edit ? (e) => startDrag(i, e, "move") : undefined}
              onPointerMove={edit ? onDragMove : undefined}
              onPointerUp={edit ? endDrag : undefined}
              onPointerCancel={edit ? endDrag : undefined}
              tabIndex={0}
              role="button"
              aria-label={edit ? `${r.label} reel ${i + 1}, rotated ${deg}° — drag to move, Shift+R to rotate 90° more` : `${r.label} reel ${i + 1} — tap for sound, double-tap for fullscreen`}
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
              {edit &&
                CORNERS.map((c) => (
                  <span
                    key={c}
                    className={`reel-grip grip-${c}`}
                    aria-hidden
                    onPointerDown={(e) => startDrag(i, e, "size", c)}
                    onPointerMove={onDragMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onClick={(e) => e.stopPropagation()}
                  />
                ))}
            </figure>
          );
        })}
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
          {(() => {
            const fr = reels[full];
            const fdeg = degOf(fr);
            return (
              <video
                key={fr.src}
                src={fr.src}
                poster={fr.poster}
                muted={fullMuted}
                loop
                playsInline
                autoPlay
                preload="auto"
                className="lb-video"
                style={fdeg ? { transform: `rotate(${fdeg}deg)` } : undefined}
              />
            );
          })()}
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
