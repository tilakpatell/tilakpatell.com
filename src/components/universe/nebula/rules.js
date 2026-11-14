// The nebulae's rules, apart from their drawing (./index.js draws them):
// where a cloud is drawn, at what level, its shape, whether you are inside
// one, the fog's layers round the ship and its young stars. No three.js
// here, so every rule is tested in Node.
//
// A nebula is a place, fixed in the map like a planet: its state is in
// absolute doubles, and it is drawn round the camera. One past the far
// plane is pulled in along its own direction and shrunk by the same
// factor, so its direction and its angle on the sky are its true ones
// (2·atan(r / d), with no floor). shaders.js mirrors envelope() line for
// line.

import { PALETTE } from '../palette';

// a cloud is near (marched finely, its young stars in) within NEAR_UNITS
// of its edge, and never further than NEAR radii: a small cloud from a
// little off, a vast one only once you're at it (its stars are specks
// from further). FADE the share either side the two levels blend over.
export const NEAR = 4;
export const NEAR_UNITS = 1000;
export const FADE = 0.2;
// the share of the camera's far plane a cloud is drawn within
export const LIMIT = 0.98;
// the least of a cloud's gas that counts as being in it
export const INSIDE_MIN = 0.02;
// the fog's first layer, clear of the ship (the chase camera sits at most
// 2.5 behind it: flight.js's CHASE), and its last at most
export const FOG_NEAR = 8;
export const FOG_FAR = 3000;

// A cloud's shape, in radii from its middle: its gas rises from inner to
// peak and falls from peak to outer (inner < 0: full from the middle);
// flat squashes it toward the map's plane; core is how hot its heart.
export const FORMS = Object.freeze({
  cloud: Object.freeze({ inner: -1, peak: 0.35, outer: 1, flat: 0.55, core: 1 }), // (a cloud, fullest at its heart)
  shell: Object.freeze({ inner: 0.45, peak: 0.72, outer: 0.98, flat: 0.8, core: 1 }), // (a remnant: hollow, brightest at its rim)
  nursery: Object.freeze({ inner: -1, peak: 0.2, outer: 1, flat: 0.6, core: 2.2 }), // (a nursery: a hot heart where its stars are)
});
export const FORM_INDEX = Object.freeze({ cloud: 0, shell: 1, nursery: 2 });

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

// A description as a generator hands it in, made whole: colours padded by
// repeating (none: the palette's nebula), an unknown form a cloud. What
// can't be drawn is refused here, never drawn black or NaN.
export function checkDesc(desc) {
  const { id, at, r, colors, seed, form } = desc ?? {};
  if ((typeof id !== 'string' && typeof id !== 'number') || id === '') throw new TypeError('a nebula needs an id');
  if (!Array.isArray(at) || at.length !== 3 || !at.every(finite)) throw new TypeError(`nebula ${id}: at must be three finite numbers`);
  if (!finite(r) || r <= 0) throw new TypeError(`nebula ${id}: r must be above 0`);
  const given = Array.isArray(colors) ? colors.filter((c) => typeof c === 'string' && c) : [];
  const from = given.length ? given : [PALETTE.nebula.hex];
  return {
    id: String(id),
    at: [at[0], at[1], at[2]], // (a copy: the caller's array moving later moves nothing)
    r,
    colors: [0, 1, 2].map((i) => from[i % from.length]),
    seed: seed ?? id,
    form: Object.hasOwn(FORMS, form) ? form : 'cloud',
  };
}

// three numbers in [0, 1) from any seed a generator makes (a number, a
// bigint, a string): FNV-1a over its text, then three splitmix steps
export function seedOf(seed) {
  const s = String(seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const out = [];
  for (let k = 0; k < 3; k++) {
    h = (h + 0x9e3779b9) >>> 0;
    let z = h;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    z = (z ^ (z >>> 16)) >>> 0;
    out.push(z / 4294967296);
  }
  return out;
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// how much of a cloud's gas is at p (in radii from its middle, the map's
// axes), 0 to 1; GLSL's smoothstep is undefined with its edges reversed,
// so the falling edge is 1 − smoothstep (shaders.js's envelope is the same)
export function envelope(form, p) {
  const f = FORMS[form] ?? FORMS.cloud;
  const rho = Math.hypot(p[0], p[1] / f.flat, p[2]);
  if (rho >= 1) return 0;
  return (1 - smoothstep(f.peak, f.outer, rho)) * (f.inner < 0 ? 1 : smoothstep(f.inner, f.peak, rho));
}

// Where a cloud is drawn: its middle less the camera, pulled inside `limit`
// along its own direction and shrunk by the same factor, so it keeps its
// true direction and angle. dist is its true distance.
export function placement(at, r, cam, limit) {
  const d = [at[0] - cam[0], at[1] - cam[1], at[2] - cam[2]];
  const dist = Math.hypot(d[0], d[1], d[2]);
  const scale = dist > limit ? limit / dist : 1;
  return { centre: [d[0] * scale, d[1] * scale, d[2] * scale], radius: r * scale, scale, dist };
}

// how near a cloud is drawn: 1 inside its near reach (less the fade), 0
// past it, smooth between
export const nearOf = (r) => Math.min(NEAR * r, r + NEAR_UNITS);
export const detailAt = (dist, r) => 1 - smoothstep(nearOf(r) * (1 - FADE), nearOf(r) * (1 + FADE), dist);

export const stepsAt = (detail, row) => Math.round(row.farSteps + (row.nearSteps - row.farSteps) * detail);

// the cloud you are in, the deepest of those that hold you, and how deep
// (its gas where you are); null outside every one
export function insideOf(entries, position) {
  let best = null;
  for (const e of entries) {
    const p = [0, 1, 2].map((i) => (position[i] - e.at[i]) / e.r);
    const depth = envelope(e.form, p);
    if (depth >= INSIDE_MIN && (!best || depth > best.depth)) best = { id: e.id, depth };
  }
  return best;
}

// the fog's layers round the ship: row.fog radii, one ratio apart, from
// clear of the ship to half the cloud (at most FOG_FAR)
export function fogLayers(row, r) {
  const n = row.fog;
  const hi = Math.max(FOG_NEAR, Math.min(0.5 * r, FOG_FAR));
  if (n <= 1) return [hi];
  const k = (hi / FOG_NEAR) ** (1 / (n - 1));
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? hi : FOG_NEAR * k ** i));
}

// a small seeded generator (mulberry32) from seedOf's first number
const rngOf = (seed) => {
  let a = Math.floor(seedOf(seed)[0] * 4294967296) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const SPREAD = { shell: 0.6, nursery: 0.35, cloud: 0.5 };

// A near cloud's young stars, crowded toward its middle, the same for a
// seed: at (units from the middle), size and bright as deepspace.js drew
// its sparks, pal the colour of the three each leans to.
export function youngStars(desc, n) {
  const rand = rngOf(desc.seed ?? desc.id);
  const spread = SPREAD[desc.form] ?? SPREAD.cloud;
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
  return Array.from({ length: n }, () => {
    const at = [gauss() * desc.r * spread, gauss() * desc.r * spread * 0.45, gauss() * desc.r * spread];
    const bright = 0.5 + rand() ** 6 * 5;
    const pal = Math.floor(rand() * 3);
    const size = 0.8 + rand() ** 3 * 2.5;
    return { at, size, bright, pal };
  });
}
