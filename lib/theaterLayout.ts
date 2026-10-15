import type { Reel } from "./content";


export type TheaterSlot = {
  id: string; // the layout class stored in reel.spot
  label: string;
  area: { col: number; row: number; rowSpan?: number; tall?: boolean };
};

// Mirrors the .v-theater .reel-vt-* rules in globals.css — keep in sync.
export const THEATER_SLOTS: TheaterSlot[] = [
  { id: "reel-vt-1", label: "Left · tall", area: { col: 1, row: 1, tall: true } },
  { id: "reel-vt-w2", label: "Top center · wide", area: { col: 2, row: 1 } },
  { id: "reel-vt-w1", label: "Top right · wide", area: { col: 3, row: 1 } },
  { id: "reel-vt-4", label: "Far right · full height", area: { col: 4, row: 1, rowSpan: 3, tall: true } },
  { id: "reel-vt-2", label: "Center · tall", area: { col: 2, row: 2, rowSpan: 2, tall: true } },
];

const SLOT_IDS = new Set(THEATER_SLOTS.map((s) => s.id));

export const reelIndexInSlot = (reels: Reel[], slotId: string): number =>
  reels.findIndex((r) => (r.spot ?? "") === slotId);

/** Place reel `from` into slot `toId`, swapping with whatever occupies it. */
export function assignSpot(reels: Reel[], from: number, toId: string): Reel[] {
  const next = reels.map((r) => ({ ...r }));
  const src = next[from];
  if (!src) return reels;
  if (!toId) {
    src.spot = "";
    return next;
  }
  const other = reelIndexInSlot(next, toId);
  if (other !== -1 && other !== from) {
    const tmp = src.spot ?? "";
    src.spot = toId;
    next[other].spot = tmp;
  } else {
    src.spot = toId;
  }
  return next;
}

/** Send a reel back to the auto-flow pool (clear its spot). */
export function clearSpot(reels: Reel[], from: number): Reel[] {
  const next = reels.map((r) => ({ ...r }));
  if (!next[from]) return reels;
  next[from].spot = "";
  return next;
}

/** True when a reel occupies this slot (its spot equals the slot id). */
export const isInSlot = (reel: Reel, slotId: string): boolean => (reel.spot ?? "") === slotId;

export const slotArea = (s: TheaterSlot): string =>
  `${s.area.col} / ${s.area.row} / ${(s.area.col ?? 0) + 1} / ${s.area.row + (s.area.rowSpan ?? 1)}`;

export const isKnownSpot = (spot: string | undefined): boolean =>
  !!spot && SLOT_IDS.has(spot);

export function moveReel(reels: Reel[], i: number, d: number): Reel[] {
  const j = i + d;
  if (j < 0 || j >= reels.length) return reels;
  const next = [...reels];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
