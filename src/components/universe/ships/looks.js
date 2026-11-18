// What a ship's tiers show, as numbers on what's drawn already (nothing new
// drawn): its engines' glow a tenth bigger a tier of its Engines, and hotter,
// toward blue-white, half the way there at Mk V. engines.js still holds every
// glow under its brightness cap, so a hotter colour never blooms past the hull.
// Pure (no three.js).
//
// HOT: the blue-white an engine runs toward
// engineLook(tier, colour) → { r (times its radius), colour ('#rrggbb') }
// engineList(list, tier) → the engines (engines.js's { at, r, colour }) at that
//   tier: the list itself at Mk I

export const HOT = '#cfe4ff';
const MAX = 5;

const hex = (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : null);
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

export function engineLook(tier, colour) {
  const t = Number.isFinite(tier) ? Math.min(MAX, Math.max(1, Math.floor(tier))) : 1;
  const k = (t - 1) / 8;
  const from = hex(colour);
  const to = hex(HOT);
  return { r: 1 + 0.1 * (t - 1), colour: from && k > 0 ? toHex(from.map((v, i) => v + (to[i] - v) * k)) : colour };
}

export function engineList(list, tier) {
  if (!(tier > 1)) return list;
  return list.map((e) => {
    const look = engineLook(tier, e.colour);
    return { ...e, r: e.r * look.r, colour: look.colour };
  });
}
