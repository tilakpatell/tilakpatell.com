// The Outer Rim worlds' shared helpers (sites/outer.js and sites/nevarro.js):
// their sky, their ground's palette, and a squad of troops for a quest.

export const sky = (zenith, horizon, sun, extra = {}) => ({ zenith, horizon, haze: 0.8, hazeColor: horizon, suns: [{ az: 0.6, el: 0.35, color: sun, size: 0.016, glow: 1.1 }], clouds: { cover: 0.3, color: '#ffffff', shade: '#9aa0aa', scale: 0.6, speed: 0.005 }, ...extra });
export const palette = (low, high, rock, accent, extra = {}) => ({ low, high, rock, accent, deep: rock, hLow: -4, hHigh: 14, rockAt: 0.4, accentCover: 0.25, ripple: { strength: 0.02, scale: 3, wind: 0.5 }, grain: 0.5, ...extra });
export const hostile = (range, every, damage) => ({ range, every, damage, spread: 0.06 });
export const troops = (tag, n, at, kind = 'stormtrooper') => ({ kind, n, at, spread: 12, roam: 5, hp: 2, tag, hostile: hostile(42, 2.3, 8) });
// (the game's own nature, for a scatter row to wear: ../nature.js)
export { NATURE } from '../nature';
