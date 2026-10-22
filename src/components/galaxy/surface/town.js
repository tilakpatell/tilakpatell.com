// A small town out in the wilds (wayside.js's): one street, houses down
// each side of it facing in, a bigger one across its end, stalls and
// crates along it, lamps where the land is settled enough for them and a
// truck parked. Its houses are the world's own where it has a city of
// them (its city's kit, or a site's `town`), else the kind its ground
// builds: domes and adobe on sand, white houses and stilt huts on green
// ground, rock houses and prefabs on grey and on snow. Pure: wayside.js
// turns and moves its things with the place.
//
//   townOf(rand, site) → [[kind, x, z, more]…]: about the town's middle,
//     its street along +z (a house's `seat`: the metres round it it's
//     stood on the lowest ground of, wayside.js's laidOn)
//   housesFor(site) → { houses, end, sand }: the kinds it's built of
//   SPAN: metres from a town's middle its street and houses reach at most

import FOOT from './sites/footprints.json';

const STREET = 9; // metres across the street
const SET = 1.2; // metres a house stands back from the street's edge
const NARROWEST = 4; // metres an alley between two houses is at least
const HALF = 26; // metres from the town's middle to each end of its street
export const SPAN = HALF + 22; // (its end house beyond)
const WIDEST = 22; // metres along the street a city's house may be, to stand in a town

// the houses each ground builds, and what stands about them
const LANDS = {
  sand: { houses: ['tathouse', 'tathouse2', 'adobe', 'moshut', 'moshouse', 'homestead'], end: 'cantina', about: ['vaporator', 'vaporator', 'stall', 'crates', 'barrels'], lamps: false },
  green: { houses: ['kestrohouse', 'calodanhouse', 'stilthut'], end: 'kestrohouse', about: ['stall', 'crates', 'barrels'], lamps: true },
  grey: { houses: ['nevarrohouse', 'nevarrodomehouse', 'mosblock', 'bunker'], end: 'nevarrohouse', about: ['crates', 'barrels', 'crates'], lamps: true },
  snow: { houses: ['nevarrodomehouse', 'bunker'], end: 'bunker', about: ['crates', 'barrels'], lamps: true },
};
const GREEN = new Set(['grass', 'leaves', 'needles', 'mud', 'beach']);
const landOf = (site) => {
  const d = site.ground?.detail;
  if (d === 'sand' || d === 'redsoil') return 'sand';
  if (d === 'snow') return 'snow';
  return GREEN.has(d) ? 'green' : 'grey';
};

export function housesFor(site) {
  const land = LANDS[landOf(site)];
  // (a world's own: its `town`, or the houses its cities are built of, those small enough)
  const city = (site.places ?? []).flatMap((p) => p.city?.kit ?? []).map((k) => (typeof k === 'string' ? k : k.kind));
  const own = (site.town?.houses ?? city).filter((k) => FOOT[k] && FOOT[k][0] <= WIDEST);
  return { ...land, houses: own.length ? own : land.houses, end: site.town?.end ?? (own.length ? own[0] : land.end) };
}

export function townOf(rand, site) {
  const kit = housesFor(site);
  const out = [];
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const half = HALF;
  // down each side, from one end: a house, an alley, the next, till the street's end
  for (const side of [-1, 1]) {
    let z = -half + rand() * 4;
    for (;;) {
      const kind = pick(kit.houses);
      const scale = 0.9 + rand() * 0.2;
      const [w, d] = FOOT[kind] ?? [10, 10];
      if (z + w * scale > half) break;
      const x = side * (STREET / 2 + SET + (d * scale) / 2);
      // (its front, its own +z, to the street)
      out.push([kind, x, z + (w * scale) / 2, { yaw: side > 0 ? -Math.PI / 2 : Math.PI / 2, scale, seat: (Math.min(w, d) * scale) / 2 }]);
      // (and something stood out front, now and then)
      if (rand() < 0.6) out.push([pick(kit.about), side * (STREET / 2 - 0.8), z + rand() * w * scale, { yaw: rand() * Math.PI * 2 }]);
      z += w * scale + NARROWEST + rand() * 4;
    }
  }
  // across the street's far end, facing down it
  const [ew, ed] = FOOT[kit.end] ?? [14, 12];
  out.push([kit.end, 0, half + 2 + ed / 2, { yaw: Math.PI, seat: Math.min(ew, ed) / 2 }]);
  if (kit.lamps) for (let z = -half + 4, i = 0; z < half; z += 12, i++) out.push(['lamp', (i % 2 ? 1 : -1) * (STREET / 2 - 0.4), z]);
  out.push(['speedertruck', -STREET / 4, -half + 6 + rand() * 10, { yaw: rand() * 0.4 - 0.2 }]);
  return out;
}
