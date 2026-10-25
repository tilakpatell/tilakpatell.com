// The nebulae's rules: where a cloud is drawn, at what level, its shape,
// whether the camera is inside one, the fog's layers round the ship and the
// cloud's young stars. Pure (no three.js, no DOM), so it runs in Node;
// index.js draws from these, and shaders.js mirrors envelope() line for line.
//
// A nebula stays where it is in the map. Its place is absolute (doubles),
// drawn from the camera; one past the far plane is pulled in along its own
// direction and shrunk by the same factor, so it keeps its true direction
// and its true angle, with no floor, whatever the far plane.
//
//   NEAR        in radii: inside it a cloud is near (more steps, young stars)
//   FADE        the share of NEAR either side of it the level eases over
//   LIMIT       the share of camera.far a cloud is drawn within
//   INSIDE_MIN  the least of a cloud's envelope that counts as inside it
//   FOG_NEAR    the fog's first layer, clear of the ship (the chase camera
//               is at most 2.5 behind it: flight.js's CHASE)
//   FOG_FAR     the farthest the fog's last layer goes
//   FORMS       each form's shape, in radii: { inner, peak, outer, flat, core }
//               (an inner under 0 fills it to the middle, flat squashes it
//               toward the map's plane, core is how bright its heart is)
//   FORM_INDEX  each form's number in the shader
//
// checkDesc(desc) → { id, at, r, colors: [c0, c1, c2], seed, form }, or a
//   TypeError for what can't be drawn
// seedOf(seed) → [a, b, c], each in [0, 1): a number, bigint or string
// envelope(form, p) → 0…1, p in radii from the middle, in the map's axes
// placement(at, r, cam, limit) → { centre, radius, scale, dist }
// detailAt(dist, r) → 0…1 (1 near); stepsAt(detail, row) → whole steps
// insideOf(entries, position) → { id, depth } | null, the deepest
// fogLayers(row, r) → row.fog radii, ascending
// youngStars(desc, n) → [{ at (from the middle), size, bright, pal }]

import { PALETTE } from '../palette';

export const NEAR = 4;
export const FADE = 0.2;
export const LIMIT = 0.98;
export const INSIDE_MIN = 0.02;
export const FOG_NEAR = 8;
export const FOG_FAR = 3000;

// (cloud: the Expanse's, and any form not known; shell: a remnant's broken
// ring, the Veil's; nursery: billows round a bright core where the young
// stars are, the Cradle's)
export const FORMS = Object.freeze({
  cloud: Object.freeze({ inner: -1, peak: 0.35, outer: 1, flat: 0.55, core: 1 }),
  shell: Object.freeze({ inner: 0.45, peak: 0.72, outer: 0.98, flat: 0.8, core: 1 }),
  nursery: Object.freeze({ inner: -1, peak: 0.2, outer: 1, flat: 0.6, core: 2.2 }),
});
export const FORM_INDEX = Object.freeze({ cloud: 0, shell: 1, nursery: 2 });

// how far a form's young stars stray from the middle, in radii (deep
// space's: 0.6 round the Veil, 0.35 in the Cradle)
const SPREAD = { cloud: 0.5, shell: 0.6, nursery: 0.35 };

const formOf = (form) => (typeof form === 'string' && Object.hasOwn(FORMS, form) ? form : 'cloud');

// (GLSL's, clamped the same way; NaN reads as the low edge, so nothing
// handed in makes a NaN cloud)
const smoothstep = (a, b, x) => {
  const t = (x - a) / (b - a);
  const k = t > 0 ? (t < 1 ? t : 1) : 0;
  return k * k * (3 - 2 * k);
};

export function checkDesc(desc) {
  const { id, at, r, colors, seed, form } = desc ?? {};
  if (typeof id !== 'string' || !id) throw new TypeError('A nebula needs an id.');
  if (at == null || at.length !== 3 || ![0, 1, 2].every((i) => Number.isFinite(at[i]))) throw new TypeError(`Nebula ${id}: at must be three finite numbers.`);
  if (!(Number.isFinite(r) && r > 0)) throw new TypeError(`Nebula ${id}: r must be a finite number over 0.`);
  const given = Array.isArray(colors) ? colors.filter((c) => typeof c === 'string' && c) : [];
  const list = given.length ? given : [PALETTE.nebula.hex];
  // (its own copy of where it is, so a caller changing its array later doesn't move it)
  return { id, at: [at[0], at[1], at[2]], r, colors: [0, 1, 2].map((i) => list[i % list.length]), seed: seed ?? id, form: formOf(form) };
}

// FNV-1a over the seed's words, then splitmix32: a bigint past 2^53 stays
// itself (as a number it would round onto its neighbours)
const utf8 = new TextEncoder();
function drawsOf(seed) {
  let s = 0x811c9dc5;
  for (const b of utf8.encode(String(seed))) s = Math.imul(s ^ b, 0x01000193);
  return () => {
    s = (s + 0x9e3779b9) | 0;
    let t = s ^ (s >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return (t >>> 0) / 4294967296;
  };
}

export function seedOf(seed) {
  const next = drawsOf(seed);
  return [next(), next(), next()];
}

// ρ is the distance from the middle with y stretched by 1 / flat; the
// falling edge is 1 − smoothstep, as GLSL's smoothstep is undefined with its
// edges reversed
export function envelope(form, p) {
  const f = FORMS[formOf(form)];
  const rho = Math.hypot(p[0], p[1] / f.flat, p[2]);
  if (!(rho < 1)) return 0;
  return (1 - smoothstep(f.peak, f.outer, rho)) * (f.inner < 0 ? 1 : smoothstep(f.inner, f.peak, rho));
}

export function placement(at, r, cam, limit) {
  // (+ 0: a −0 would make a camera at the middle read as somewhere else)
  const d = [at[0] - cam[0] + 0, at[1] - cam[1] + 0, at[2] - cam[2] + 0];
  const dist = Math.hypot(d[0], d[1], d[2]);
  const scale = dist > limit ? limit / dist : 1;
  return { centre: [d[0] * scale, d[1] * scale, d[2] * scale], radius: r * scale, scale, dist };
}

export function detailAt(dist, r) {
  const edge = NEAR * r;
  return 1 - smoothstep(edge * (1 - FADE), edge * (1 + FADE), dist);
}

export function stepsAt(detail, row) {
  const k = detail > 0 ? Math.min(1, detail) : 0;
  return Math.round(row.farSteps + (row.nearSteps - row.farSteps) * k);
}

export function insideOf(entries, position) {
  let best = null;
  for (const e of entries) {
    const p = [0, 1, 2].map((i) => (position[i] - e.at[i]) / e.r);
    const depth = envelope(e.form, p);
    if (depth >= INSIDE_MIN && !(best && best.depth >= depth)) best = { id: e.id, depth };
  }
  return best;
}

// the first clear of the ship, the last half the cloud's radius out (or
// FOG_FAR, or the first, whichever binds), one ratio between
export function fogLayers(row, r) {
  const n = Math.max(0, row.fog);
  const last = Math.max(FOG_NEAR, Math.min(0.5 * r, FOG_FAR));
  const k = n > 1 ? (last / FOG_NEAR) ** (1 / (n - 1)) : 1;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? last : FOG_NEAR * k ** i));
}

// crowded toward the middle (the sum of three draws, as deep space's were),
// flatter than wide; size and brightness as deep space drew them; pal is
// which of the cloud's three colours it leans to
export function youngStars(desc, n) {
  const rand = drawsOf(desc.seed ?? desc.id);
  for (let i = 0; i < 3; i++) rand(); // (past seedOf's three, the same seed's stream)
  const spread = SPREAD[formOf(desc.form)] * desc.r;
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
  const count = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  const stars = [];
  for (let i = 0; i < count; i++) {
    const at = [gauss() * spread, gauss() * spread * 0.45, gauss() * spread];
    const bright = 0.5 + rand() ** 6 * 5;
    const pal = Math.floor(rand() * 3);
    const size = 0.8 + rand() ** 3 * 2.5;
    stars.push({ at, size, bright, pal });
  }
  return stars;
}
