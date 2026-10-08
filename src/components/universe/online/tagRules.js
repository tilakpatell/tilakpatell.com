// What a pilot's tag shows, by how far off they are, as plain rules (pure,
// tested in Node; pilots.js draws the tags). Close by, the full tag: the
// callsign, their level, their rank and the shield bar. Past arm's length
// (TAG.near) the distance shows too; past TAG.mid it's the far mode, the
// callsign and the distance only, fading out by TAG.far, unless they're your
// ally, who never fades (you want to find them). It shrinks a little with
// distance, never under 0.8, and its type grows to match, so it's never
// under TAG.minPx on screen, a phone's included.
//
// tagMode(dist, { ally }) → { mode: 'near' | 'far' | null (none), scale,
// fade, showDist, faint (faded to all but nothing: not to be clicked on) };
// fontPx(scale) → the type's size before the scale;
// distText(units) → '320 m' | '1.2 km'; keepIn(x, y, w, h, boxW, boxH) →
// where the tag goes so it's all inside the box, or null if its point is off it.

export const TAG = { near: 40, mid: 140, far: 600, minPx: 12 }; // map units, and px
const SMALLEST = 0.8;
const FAINT = 0.15; // a fade under this is as good as gone: an invisible spot shouldn't open the roster
const BASE_PX = 12.8; // (0.8rem: the tag's type up close)
const METRES = 10; // a map unit, for the read-out (as the nav's distances)
const PAD = 4; // px kept clear of the box's edge

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function tagMode(dist, { ally = false } = {}) {
  const m = rawMode(dist, ally);
  return { ...m, faint: m.fade < FAINT };
}
function rawMode(dist, ally) {
  if (!Number.isFinite(dist) || dist < 0) return { mode: null, scale: 1, fade: 0, showDist: false };
  const scale = 1 - (1 - SMALLEST) * clamp01((dist - TAG.near) / (TAG.far - TAG.near));
  if (dist < TAG.near) return { mode: 'near', scale: 1, fade: 1, showDist: false };
  if (dist < TAG.mid) return { mode: 'near', scale, fade: 1, showDist: true };
  if (ally) return { mode: 'far', scale, fade: 1, showDist: true };
  if (dist >= TAG.far) return { mode: null, scale, fade: 0, showDist: false };
  return { mode: 'far', scale, fade: 1 - (dist - TAG.mid) / (TAG.far - TAG.mid), showDist: true };
}

// (up to the next tenth of a px, as it's written: rounded down, it'd come out a hair under)
export const fontPx = (scale) => Math.ceil(Math.max(BASE_PX, TAG.minPx / Math.max(SMALLEST, scale)) * 10) / 10;

export function distText(units) {
  const m = Math.round((units * METRES) / 10) * 10;
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

// (a tag sits over its point: centred across it, its bottom on it)
export function keepIn(x, y, w, h, boxW, boxH) {
  if (!(x >= 0 && x <= boxW && y >= 0 && y <= boxH)) return null;
  const across = w + PAD * 2 >= boxW ? boxW / 2 : Math.min(boxW - w / 2 - PAD, Math.max(w / 2 + PAD, x));
  const down = Math.min(boxH - PAD, Math.max(h + PAD, y));
  return { x: across, y: down };
}
