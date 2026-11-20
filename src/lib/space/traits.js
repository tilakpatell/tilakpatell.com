// What a generated planet offers beyond its type: its own seeded traits, so
// no two are the same kind of stop. What it has to take (resources and now
// and then a rare good, in the market's good ids), what it costs to be there
// (a hazard), what there is to find (ruins, read from the very ground the
// landings build, a moon's secret, an anomaly), and whether someone keeps a
// station over it. Each from a stream of its own (the planet's seed xor a
// salt), so a new trait never moves another, and nothing the generator made
// before changes. A function of the row alone; never stored.
//
// Pure: runs in Node and in a worker.
//
//   RESOURCES[type] → [[good, weight]…]; RARES[type] → [good…]; HAZARDS[type] → [hazard…]
//   ANOMALIES, SECRETS: the kinds
//   RARE → { least, most, from, to }: a rare good's chance, `least` at the core to `most` from
//     `to` sectors out (a pure grade past the market's PURE_FROM is the market's to say)
//   traitsOfPlanet(row, { d = 0 } = {}) → {
//     resources: [{ id, amount }] (1–3, amount 0.2…1, most first), rare: { id } | null,
//     hazard: { id, level } | null (level 1…3), ruins: boolean, station: boolean,
//     weather: variety's kind, exotic: variety's or null,
//     secret: { moon: k, kind } | null (a moon of its own that holds something),
//     anomaly: { id } | null, tags: [string] (what's notable, most notable first) }
//   row: a planet's row (id, seed, type, moons, system?), d: its sector's distance out

import { fold } from './hash64.js';
import { seeded } from '../seeded.js';
import { varietyOf } from './variety.js';

export const RESOURCES = {
  rock: [['iron', 3], ['titanium', 2]],
  desert: [['titanium', 3], ['iron', 2]],
  lava: [['iron', 3], ['titanium', 2], ['plasma', 1]],
  ice: [['ice', 4], ['gas', 1]],
  forest: [['organics', 4], ['food', 2]],
  ocean: [['organics', 3], ['food', 2], ['ice', 1]],
  gas: [['gas', 4], ['stellargas', 1]],
  ringed: [['gas', 3], ['ice', 2], ['stellargas', 1]],
};
export const RARES = {
  rock: ['voidcrystal', 'exotic'],
  desert: ['voidcrystal', 'relics'],
  lava: ['exotic', 'voidcrystal'],
  ice: ['exotic', 'voidcrystal'],
  forest: ['silk', 'exotic'],
  ocean: ['silk', 'exotic'],
  gas: ['exotic'],
  ringed: ['exotic', 'voidcrystal'],
};
export const HAZARDS = {
  rock: ['radiation', 'quakes'],
  desert: ['duststorms', 'heat'],
  lava: ['quakes', 'heat'],
  ice: ['blizzards', 'cold'],
  forest: ['predators', 'spores'],
  ocean: ['storms', 'predators'],
  gas: ['storms', 'crushing'],
  ringed: ['storms', 'debris'],
};
export const ANOMALIES = ['gravity', 'timeslip', 'mirror', 'song', 'ghostlight'];
export const SECRETS = ['cache', 'wreck', 'signal', 'machine'];
export const RARE = Object.freeze({ least: 0.08, most: 0.25, from: 0, to: 30 });
const HAZARD = 0.4;
const ANOMALY = 0.06;
const SECRET = 0.15;
const STATION = 0.08;

const SALT = { resources: 0x1b2c3d4e, rare: 0x2c3d4e5f, hazard: 0x3d4e5f60, secret: 0x4e5f6071, anomaly: 0x5f607182, station: 0x60718293 };
const streamOf = (row, aspect) => seeded(fold(BigInt(row.seed)) ^ SALT[aspect]);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function weighted(rnd, list) {
  let r = rnd() * list.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of list) if ((r -= w) < 0) return k;
  return list[list.length - 1][0];
}

function resourcesOf(row) {
  const rnd = streamOf(row, 'resources');
  const table = [...(RESOURCES[row.type] ?? RESOURCES.rock)];
  const n = 1 + Math.floor(rnd() * Math.min(3, table.length));
  const out = [];
  for (let i = 0; i < n; i++) {
    const id = weighted(rnd, table);
    table.splice(table.findIndex(([k]) => k === id), 1);
    out.push({ id, amount: Math.round((0.2 + 0.8 * rnd()) * 100) / 100 });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

export function traitsOfPlanet(row, { d = 0 } = {}) {
  const type = RESOURCES[row.type] ? row.type : 'rock';
  const v = varietyOf(row);
  const ruins = v.poiKinds.includes('ruins');
  const resources = resourcesOf(row);

  const rr = streamOf(row, 'rare');
  const chance = RARE.least + (RARE.most - RARE.least) * clamp((d - RARE.from) / (RARE.to - RARE.from), 0, 1);
  // (ruins hold relics more often than anything else holds a rare)
  const rare = rr() < chance * (ruins ? 2 : 1) ? { id: ruins && rr() < 0.6 ? 'relics' : RARES[type][Math.floor(rr() * RARES[type].length)] } : (rr(), null);

  const hr = streamOf(row, 'hazard');
  const pirates = row.system?.hazard === 'pirates';
  const hazard = pirates && hr() < 0.5 ? { id: 'pirates', level: 2 } : hr() < HAZARD ? { id: HAZARDS[type][Math.floor(hr() * HAZARDS[type].length)], level: 1 + Math.floor(hr() * 3) } : null;

  const sr = streamOf(row, 'secret');
  const moons = row.moons ?? 0;
  const secret = moons > 0 && sr() < SECRET ? { moon: Math.floor(sr() * moons), kind: SECRETS[Math.floor(sr() * SECRETS.length)] } : null;

  const ar = streamOf(row, 'anomaly');
  const anomaly = ar() < ANOMALY ? { id: ANOMALIES[Math.floor(ar() * ANOMALIES.length)] } : null;

  const station = streamOf(row, 'station')() < STATION;

  const tags = [
    ...(anomaly ? ['anomaly'] : []),
    ...(rare ? ['rare'] : []),
    ...(v.exotic ? ['exotic'] : []),
    ...(ruins ? ['ruins'] : []),
    ...(secret ? ['secret'] : []),
    ...(station ? ['station'] : []),
    ...(hazard ? ['hazard'] : []),
  ];
  return { resources, rare, hazard, ruins, station, weather: v.weather.kind, exotic: v.exotic, secret, anomaly, tags };
}
