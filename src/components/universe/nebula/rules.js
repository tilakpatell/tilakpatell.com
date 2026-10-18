// The nebulae's rules: where a cloud is drawn, how near it is, what shape it
// fills, whether the ship is inside it, and the young stars in it. Pure, so
// the renderer and the tests share one answer; the shader mirrors envelope()
// line for line. No three.js.
//
// NEAR, FADE, LIMIT, INSIDE_MIN, FOG_NEAR, FOG_FAR
// FORMS, FORM_INDEX
// checkDesc(desc) → { id, at, r, colors, seed, form }
// seedOf(seed) → [a, b, c], each in [0, 1)
// envelope(form, p) → 0…1, p in radii from the middle
// placement(at, r, cam, limit) → { centre, radius, scale, dist }
// detailAt(dist, r) → 0…1; stepsAt(detail, row) → integer
// insideOf(entries, position) → { id, depth } or null
// fogLayers(row, r) → radii, ascending
// youngStars(desc, n) → [{ at, size, bright, pal }]

import { PALETTE } from '../palette';

export const NEAR = 4; // in radii; inside this is the near level
export const FADE = 0.2; // the share of NEAR over which near turns to far
export const LIMIT = 0.98; // the share of camera.far a cloud is drawn within
export const INSIDE_MIN = 0.02; // the envelope below which the ship is not inside
export const FOG_NEAR = 8; // (the chase camera sits at most 2.5 behind the ship)
export const FOG_FAR = 3000;

// inner < 0 means no hollow; flat squashes y; core brightens the heart
export const FORMS = {
  cloud: { inner: -1, peak: 0.35, outer: 1, flat: 0.55, core: 1 },
  shell: { inner: 0.45, peak: 0.72, outer: 0.98, flat: 0.8, core: 1 },
  nursery: { inner: -1, peak: 0.2, outer: 1, flat: 0.6, core: 2.2 },
};
export const FORM_INDEX = { cloud: 0, shell: 1, nursery: 2 };

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function checkDesc(desc) {
  if (!desc || desc.id == null || desc.id === '') throw new TypeError('a nebula needs an id');
  const { at, r } = desc;
  if (!Array.isArray(at) || at.length !== 3 || !at.every(Number.isFinite)) {
    throw new TypeError(`nebula ${desc.id}: at must be three finite numbers`);
  }
  if (!(r > 0) || !Number.isFinite(r)) throw new TypeError(`nebula ${desc.id}: r must be above 0`);
  const given = Array.isArray(desc.colors) && desc.colors.length ? desc.colors : [PALETTE.nebula];
  // (repeat to three: [a] → a a a, [a, b] → a b a)
  const colors = [0, 1, 2].map((i) => given[i % given.length]);
  const form = Object.hasOwn(FORMS, desc.form) ? desc.form : 'cloud';
  return { id: desc.id, at: [...at], r, colors, seed: desc.seed, form };
}

// One mixing step of splitmix32: the state advances, the result is 32 bits.
const split = (state) => {
  let z = (state + 0x9e3779b9) | 0;
  const next = z;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  return [next, (z ^ (z >>> 16)) >>> 0];
};

export function seedOf(seed) {
  // FNV-1a over the text, so numbers, bigints and strings all land alike
  let h = 0x811c9dc5;
  const text = String(seed);
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  let state = h | 0;
  return [0, 1, 2].map(() => {
    const [s, out] = split(state);
    state = s;
    return out / 4294967296;
  });
}

// ρ = length(p.x, p.y / flat, p.z)
// env = ρ ≥ 1 ? 0 : (1 − smoothstep(peak, outer, ρ)) × (inner < 0 ? 1 : smoothstep(inner, peak, ρ))
// (the falling edge is 1 − smoothstep, as GLSL's smoothstep has no reversed edges)
export function envelope(form, p) {
  const f = FORMS[Object.hasOwn(FORMS, form) ? form : 'cloud'];
  const rho = Math.hypot(p[0], p[1] / f.flat, p[2]);
  if (rho >= 1) return 0;
  return (1 - smoothstep(f.peak, f.outer, rho)) * (f.inner < 0 ? 1 : smoothstep(f.inner, f.peak, rho));
}

// A cloud farther than `limit` is pulled in along its own line of sight and
// shrunk by the same factor, so it keeps its true angle and sits inside the
// far plane.
export function placement(at, r, cam, limit) {
  const d = [at[0] - cam[0], at[1] - cam[1], at[2] - cam[2]];
  const dist = Math.hypot(...d);
  const scale = Math.min(1, limit / dist); // (dist 0 → Infinity → 1)
  return { centre: d.map((v) => v * scale), radius: r * scale, scale, dist };
}

export const detailAt = (dist, r) => 1 - smoothstep(NEAR * r * (1 - FADE), NEAR * r * (1 + FADE), dist);

export const stepsAt = (detail, row) =>
  Math.round(row.farSteps + (row.nearSteps - row.farSteps) * detail);

export function insideOf(entries, position) {
  let best = null;
  for (const e of entries) {
    const p = [0, 1, 2].map((i) => (position[i] - e.at[i]) / e.r);
    const depth = envelope(e.form, p);
    if (depth >= INSIDE_MIN && (!best || depth > best.depth)) best = { id: e.id, depth };
  }
  return best;
}

// Geometric from FOG_NEAR to the cloud's half-radius (or FOG_FAR), the last
// layer set exactly so the sum of rounding never moves it.
export function fogLayers(row, r) {
  const far = Math.min(0.5 * r, FOG_FAR);
  const n = row.fog;
  // (a cloud too small to fog the ship from inside has no layers)
  if (far <= FOG_NEAR) return [];
  if (n <= 1) return [far];
  const ratio = (far / FOG_NEAR) ** (1 / (n - 1));
  return Array.from({ length: n }, (_, i) =>
    i === 0 ? FOG_NEAR : i === n - 1 ? far : FOG_NEAR * ratio ** i);
}

const SPREAD = { shell: 0.6, nursery: 0.35, cloud: 0.5 };

// Young stars, crowded toward the middle: the draws follow the old per-world
// loop (a three-roll spread, brightness 0.5 + u⁶·5, size 0.8 + u³·2.5).
export function youngStars(desc, n) {
  let state = Math.floor(seedOf(desc.seed)[0] * 4294967296) | 0;
  const rand = () => {
    const [s, out] = split(state);
    state = s;
    return out / 4294967296;
  };
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
  const spread = SPREAD[Object.hasOwn(SPREAD, desc.form) ? desc.form : 'cloud'] * desc.r;
  return Array.from({ length: n }, () => {
    const at = [gauss() * spread, gauss() * spread * 0.45, gauss() * spread];
    const bright = 0.5 + rand() ** 6 * 5;
    const size = 0.8 + rand() ** 3 * 2.5;
    return { at, size, bright, pal: Math.floor(rand() * 3) };
  });
}
