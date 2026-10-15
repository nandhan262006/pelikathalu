"use client";

import { useState, type DragEvent } from "react";
import type { Reel } from "@/lib/content";
import { THEATER_SLOTS, assignSpot, clearSpot, isKnownSpot, moveReel } from "@/lib/theaterLayout";

const shortName = (src: string): string => {
  const tail = src.split("/").pop() ?? src;
  return tail.length > 22 ? `…${tail.slice(-21)}` : tail;
};

export default function TheaterLayout({
  value,
  onChange,
}: {
  value: Reel[];
  onChange: (v: Reel[]) => void;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const reels = value ?? [];
  const pool = reels.map((r, i) => ({ r, i })).filter(({ r }) => !isKnownSpot(r.spot));

  const drop = (slotId: string) => (e: DragEvent) => {
    e.preventDefault();
    setOver(null);
    if (drag === null) return;
    onChange(slotId ? assignSpot(reels, drag, slotId) : clearSpot(reels, drag));
    setDrag(null);
  };

  const allowDrop = (slotId: string) => (e: DragEvent) => {
    e.preventDefault();
    setOver(slotId);
  };

  const chip = (i: number) => (
    <div
      className="db-slot-chip"
      draggable
      onDragStart={() => setDrag(i)}
      onDragEnd={() => {
        setDrag(null);
        setOver(null);
      }}
      title="Drag to another slot, or use the dropdown"
    >
      <span className="db-slot-chip-name">
        {i + 1}. {reels[i].label || "untitled"}
      </span>
      <em className="db-slot-chip-src">{shortName(reels[i].src)}</em>
      <span className="db-item-actions">
        <button type="button" className="db-mini" disabled={i === 0} onClick={() => onChange(moveReel(reels, i, -1))} aria-label="Move earlier (mobile order)">↑</button>
        <button type="button" className="db-mini" disabled={i === reels.length - 1} onClick={() => onChange(moveReel(reels, i, 1))} aria-label="Move later (mobile order)">↓</button>
      </span>
    </div>
  );

  const slotCell = (slotId: string, label: string, area: { col: number; row: number; rowSpan?: number; tall?: boolean }) => {
    const idx = reels.findIndex((r) => (r.spot ?? "") === slotId);
    return (
      <div
        className={`db-slot ${tallClass(area)}${over === slotId ? " db-slot-over" : ""}`}
        style={{ gridColumn: String(area.col), gridRow: `${area.row} / span ${area.rowSpan ?? 1}` }}
        onDragOver={allowDrop(slotId)}
        onDragLeave={() => setOver((o) => (o === slotId ? null : o))}
        onDrop={drop(slotId)}
      >
        <div className="db-slot-head">
          <span className="db-slot-label">{label}</span>
          <select
            className="db-input db-slot-select"
            value={idx === -1 ? "" : String(idx)}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "" ? (idx === -1 ? reels : clearSpot(reels, idx)) : assignSpot(reels, Number(v), slotId));
            }}
            aria-label={`Reel in ${label}`}
          >
            <option value="">— empty —</option>
            {reels.map((r, i) => (
              <option key={i} value={String(i)}>
                {i + 1}. {r.label || shortName(r.src)}
              </option>
            ))}
          </select>
        </div>
        {idx !== -1 && chip(idx)}
      </div>
    );
  };

  return (
    <div className="db-field db-theater">
      <span className="db-label">
        Theater layout <em className="db-count">{THEATER_SLOTS.length} slots</em>
      </span>
      <p className="db-theater-hint">
        Drag a reel chip into a slot (or pick from its dropdown) to change its desktop position. Chips collide →
        they swap. ↑↓ set the order used on mobile. Changes autosave with the draft.
      </p>
      <div className="db-theater-grid">
        {THEATER_SLOTS.map((s) => slotCell(s.id, s.label, s.area))}
      </div>
      <div
        className={`db-theater-pool${over === "" ? " db-slot-over" : ""}`}
        onDragOver={allowDrop("")}
        onDragLeave={() => setOver((o) => (o === "" ? null : o))}
        onDrop={drop("")}
      >
        <span className="db-slot-label">Auto flow (extra reels)</span>
        <div className="db-theater-pool-chips">
          {pool.length === 0 && <em className="db-dim">empty — reels dropped here follow natural grid order</em>}
          {pool.map(({ i }) => chip(i))}
        </div>
      </div>
    </div>
  );
}

const tallClass = (area: { tall?: boolean }): string => (area.tall ? " db-slot-tall" : "");
