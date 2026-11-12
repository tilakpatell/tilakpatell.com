// The work a sector worker does (scene/sector.worker.js), kept pure so it
// runs in Node and is tested there: a sector made whole (space.js's
// fullSector) and its stars as typed arrays the far layer takes as they
// are (universe/farStars.js's slots); and the sectors past the 3 × 3 × 3 as
// specks only, each made once and kept while the ship's near. A planet's
// moons don't cross (they're made from the planet alone): withMoons puts
// them back, made when first asked for.
//
// starsOf(sector, centre = sector.origin) → { at: Float32Array (xyz from centre),
//   color: Uint8Array (rgb), r: Float32Array, count }: every system's star and every
//   middle-layer wonder
// sectorJob({ type: 'sector', key, universe: bigint, sx, sy, sz }) → { answer: { key, sector, stars }, transfer }
// beyondKeys(centre: [sx, sy, sz], ring) → [[sx, sy, sz]…]: the sectors at Chebyshev ring + 1
//   (98 for ring 1, 218 for ring 2), the core sector included
// beyondJob({ type: 'beyond', key, universe, centre, ring, cap = Infinity }, cache = new Map(), make)
//   → { answer: { key, centre, stars }, transfer }: the systems of beyondKeys(centre, ring),
//   from centre's middle, each sector's biggest stars first, as many as `cap` shares out
//   between them; sectors made once and kept in `cache` (the 400 last used)
// withMoons(sector) → the same sector, each planet's moonList back (made when first read)

import { sectorCentre } from '../../../lib/space/address.js';
import { fullSector } from './space';
import { moonsOf } from './systems';

const WONDER_SPECK = { nebula: { color: '#b48cff', r: 0.4 }, pulsar: { color: '#b8f4ff', r: 0.4 }, derelict: { color: '#7a808c', r: 0.4 }, rogue: { color: '#6b5a50', r: 0.4 } };
const KEPT = 400;

const rgbs = new Map();
const rgbOf = (hex) => {
  let c = rgbs.get(hex);
  if (!c) {
    const v = parseInt(hex.slice(1), 16);
    rgbs.set(hex, (c = [(v >> 16) & 255, (v >> 8) & 255, v & 255]));
  }
  return c;
};

function specks(rows, centre) {
  const count = rows.length;
  const at = new Float32Array(count * 3);
  const color = new Uint8Array(count * 3);
  const r = new Float32Array(count);
  rows.forEach(([p, size, hex], i) => {
    at[i * 3] = p[0] - centre[0];
    at[i * 3 + 1] = p[1] - centre[1];
    at[i * 3 + 2] = p[2] - centre[2];
    color.set(rgbOf(hex), i * 3);
    r[i] = size;
  });
  return { at, color, r, count };
}

export function starsOf(sector, centre = sector.origin) {
  const rows = sector.systems.map((s) => [s.at, s.star.size, s.star.color]);
  for (const w of sector.wonders) {
    const look = WONDER_SPECK[w.kind] ?? WONDER_SPECK.rogue;
    rows.push([w.at, w.size * look.r, look.color]);
  }
  return specks(rows, centre);
}

const buffersOf = (stars) => [stars.at.buffer, stars.color.buffer, stars.r.buffer];

export function sectorJob({ key, universe, sx, sy, sz }) {
  const whole = fullSector(universe, sx, sy, sz);
  const stars = starsOf(whole);
  // (the moons stay behind: made again from each planet on the other side)
  const sector = {
    ...whole,
    systems: whole.systems.map((s) => ({
      ...s,
      planets: s.planets.map((p) => {
        const { moonList, ...rest } = p; // eslint-disable-line no-unused-vars
        return rest;
      }),
    })),
  };
  const t = sector.things;
  return { answer: { key, sector, stars }, transfer: [...buffersOf(stars), t.slot.buffer, t.kind.buffer, t.at.buffer, t.size.buffer] };
}

export function withMoons(sector) {
  for (const s of sector.systems)
    for (const p of s.planets) {
      if ('moonList' in p) continue;
      Object.defineProperty(p, 'moonList', {
        get() {
          const list = moonsOf(p);
          Object.defineProperty(p, 'moonList', { value: list, enumerable: true, configurable: true, writable: true });
          return list;
        },
        enumerable: true,
        configurable: true,
      });
    }
  return sector;
}

export function beyondKeys([cx, cy, cz], ring) {
  const d = ring + 1;
  const out = [];
  for (let z = -d; z <= d; z++)
    for (let y = -d; y <= d; y++)
      for (let x = -d; x <= d; x++) if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) === d) out.push([cx + x, cy + y, cz + z]);
  return out;
}

const makeSystems = (universe, sx, sy, sz) => fullSector(universe, sx, sy, sz, { things: false });

export function beyondJob({ key, universe, centre, ring, cap = Infinity }, cache = new Map(), make = makeSystems) {
  const mid = sectorCentre(...centre);
  const rows = [];
  const keys = beyondKeys(centre, ring);
  const each = Math.max(1, Math.floor(cap / keys.length));
  for (const [sx, sy, sz] of keys) {
    const id = `${universe}:${sx},${sy},${sz}`;
    let systems = cache.get(id);
    if (systems) cache.delete(id); // (to the back: the most recently used)
    else systems = make(universe, sx, sy, sz).systems.map((s, i) => [s.at, s.star.size, s.star.color, i]).sort((a, b) => b[1] - a[1] || a[3] - b[3]); // (biggest first)
    cache.set(id, systems);
    if (cache.size > KEPT) cache.delete(cache.keys().next().value);
    for (let i = 0; i < systems.length && i < each; i++) rows.push(systems[i]);
  }
  const stars = specks(rows, mid);
  return { answer: { key, centre, stars }, transfer: buffersOf(stars) };
}
