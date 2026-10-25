// What's round the ship, and which place it's at. Pure (no React, DOM or
// three.js): it reads the sectors it's given and makes none.
//
// What's listed follows what's drawn. Lane 2's disc layer (expanse/scene/
// discs.js) draws every star, planet and moon of a system within the far
// plane, and every wonder, as a disc, keeping the nearest up to its room, and
// gives way to near.js within a system's build reach. Any of those can be on
// screen, so each needs a row to be picked, named and put on the map. So the
// list holds two parts:
//   - near: every body of each system whose reach + `inside` holds the
//     camera (its star, planets, moons and station), with their parks and
//     no cap. These are what near.js builds, a few dozen at most.
//   - the rest: every other system, planet, moon, lattice thing, extra and
//     wonder within the far plane past its reach (a thing's card may say
//     another distance), the nearest `max` of them by distance from the
//     middle, the disc layer's own rule. That layer draws the nearest of the
//     same set at most its room, so each disc it draws has a row. A planet
//     or moon out here has no park: that far off it can't be where you're at.
// It makes no object for a body it leaves out. The candidates go into a
// scratch kept between calls (what each is, where, how far), and a row is
// made only for those kept. What a body's row always is (its name, look, park
// and src) is made the first time it's kept and kept with the generator's
// row (a WeakMap, gone with its sector; nothing is saved), so a call makes
// only each row and where it is. A lattice thing has no row of its own until
// thingRow makes one, about 20 µs for its name's seed, so a sector's first
// call costs most.
//
// Where you're at mirrors ship.js's orbiting, with a zone a place: in at its
// park + 8, out at its park + 14 (PARK_GAP), measured from its middle. The
// smallest zone that holds the ship wins, and takes over the place it's at
// only while it's under way or at a trip's end, so a moon going by a ship
// parked at its planet doesn't take it.
//
// AROUND = { far, inside, max, underWay }: the far plane; how far past a
//   system's reach it counts as near (past every build reach near.js makes);
//   the cap's default, the low tier's far-layer room (the scene passes its
//   own device's); the speed a ship is under way at
// Row: { id, place ('system' | 'planet' | 'moon' | 'station' | 'thing' |
//   'extra' | 'wonder'), kind, name, at (where it is at t, its own array),
//   r, reach, deep, color, move (cards.js's, by placeLook), dist (max(0,
//   |cam − at| − reach)), park (parkDistance, or null), src: { row, system,
//   planet } (the generator's rows: read them, never write them) }. A light
//   destination: resolvePlace(row.id) gives its card.
// placesAround(sectors, cam, t, { far, inside, max } = AROUND) → Row[],
//   nearest dist first. sectors: a Map or any iterable of sectors; cam: [x,
//   y, z] in the map's frame; t: the shared clock (spaceTime)
// hereZone(row) → { in, out }, from the row's middle
// orbitingPlace(ship, current, rows, prefer = null) → id | null, over the
//   rows with a park. ship: { x, y, z, speed }. prefer (a trip just ended
//   there) is it while its in holds the ship; else current stays within its
//   out, unless the ship is under way and a smaller in holds it; else the
//   smallest in that holds it, or null
// aimStars(sectors, cam, { max = 2000 } = {}) → [{ id, at (the system's
//   own), reach (its card's, 2 × its star's size) }], nearest first, for
//   aim.js's aimFrom

import { SECTOR } from '../../../lib/space/address.js';
import { SECTOR_EXTRAS, THING_KINDS, moonAt, orbitAt, thingRow } from '../../expanse/shared/gen';
import { FAR } from '../../expanse/shared/levels';
import { PARK_GAP } from '../ship';
import { placeLook, placeReach, thingCardOf } from './cards';
import { atTime } from './ids';
import { parkDistance } from './park';

export const AROUND = { far: FAR, inside: 1000, max: 600, underWay: 1 };

// (a candidate's place, in the scratch)
const SYSTEM = 0;
const PLANET = 1;
const MOON = 2;
const THING = 3;
const EXTRA = 4;
const WONDER = 5;
const HALF = SECTOR / 2;

// (each lattice kind's card: its reach goes with its size, so it's the
// reach of a thing 1 across times the thing's size)
const LATTICE = THING_KINDS.map(({ kind }) => ({ per: placeReach('thing', { kind, size: 1 }), card: thingCardOf(kind) }));
const LATTICE_REACH = Math.max(...THING_KINDS.map((k, i) => LATTICE[i].per * k.size[1]));

// The scratch: a candidate's place, sector, indexes, where it is and how far
// its middle is
let room = 0;
let n = 0;
let code = new Uint8Array(0);
let idx = new Int32Array(0);
let pos = new Float64Array(0);
let mid = new Float64Array(0);
let order = new Int32Array(0);
const list = []; // (the sectors of a call)
const P = [0, 0, 0]; // (a planet where it is, and a moon of it)
const M = [0, 0, 0];

function grow() {
  room = Math.max(1024, room * 2);
  const more = (Kind, from, k) => {
    const to = new Kind(room * k);
    to.set(from);
    return to;
  };
  code = more(Uint8Array, code, 1);
  idx = more(Int32Array, idx, 4);
  pos = more(Float64Array, pos, 3);
  mid = more(Float64Array, mid, 1);
  order = new Int32Array(room);
}

function add(place, si, a, b, c, x, y, z, d) {
  if (n >= room) grow();
  code[n] = place;
  idx[n * 4] = si;
  idx[n * 4 + 1] = a;
  idx[n * 4 + 2] = b;
  idx[n * 4 + 3] = c;
  pos[n * 3] = x;
  pos[n * 3 + 1] = y;
  pos[n * 3 + 2] = z;
  mid[n] = d;
  n++;
}

// (a whole number back, a tie to the one found first, as discs.js's pickDiscs)
const nearer = (a, b) => (mid[a] < mid[b] ? -1 : mid[a] > mid[b] ? 1 : a - b);

// The k nearest in a into its first k places, in no order: a quickselect,
// as only those are sorted after. before is a total order, so which k they
// are is fixed whatever the order they came in.
function nearestFirst(a, k, before) {
  let lo = 0;
  let hi = a.length - 1;
  const at = k - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    // (the median of three for the pivot, so slot-ordered things don't make it slow)
    const x = a[lo];
    const y = a[m];
    const z = a[hi];
    const p = before(x, y) < 0 ? (before(y, z) < 0 ? y : before(x, z) < 0 ? z : x) : before(x, z) < 0 ? x : before(y, z) < 0 ? z : y;
    let i = lo;
    let j = hi;
    while (i <= j) {
      while (before(a[i], p) < 0) i++;
      while (before(a[j], p) > 0) j--;
      if (i <= j) {
        const s = a[i];
        a[i] = a[j];
        a[j] = s;
        i++;
        j--;
      }
    }
    if (at <= j) hi = j;
    else if (at >= i) lo = i;
    else return;
  }
}

// What a body's row always is, made once: from the generator's row, or for a
// lattice thing from its sector and index (a thing's row is thingRow's)
const bases = new WeakMap(); // the generator's row → its base
const things = new WeakMap(); // a sector → its lattice things' bases, by index

function makeBase(place, row, system, planet) {
  const look = placeLook(place, row);
  return { id: row.id, place, kind: look.kind, name: look.name, r: look.r, reach: look.reach, deep: look.deep, color: look.color, move: look.move, park: undefined, src: { row, system, planet } };
}

function baseOf(place, row, system = null, planet = null) {
  let b = bases.get(row);
  if (!b) bases.set(row, (b = makeBase(place, row, system, planet)));
  return b;
}

function thingOf(sector, i) {
  let made = things.get(sector);
  if (!made) things.set(sector, (made = []));
  return made[i] ?? (made[i] = makeBase('thing', thingRow(sector, i), null, null));
}

const sectorsOf = (sectors) => (!sectors ? [] : typeof sectors.values === 'function' ? sectors.values() : sectors);

// A row from its base: at and d, where it is and how far its middle is,
// when the scratch has them; parked, with its park (worked out once a body)
function rowOf(b, cam, t, parked, at = null, d = -1) {
  const r = { id: b.id, place: b.place, kind: b.kind, name: b.name, at, r: b.r, reach: b.reach, deep: b.deep, color: b.color, move: b.move, dist: 0, park: null, src: b.src };
  if (!r.at) r.at = atTime(r, t);
  const away = d >= 0 ? d : Math.sqrt((r.at[0] - cam[0]) ** 2 + (r.at[1] - cam[1]) ** 2 + (r.at[2] - cam[2]) ** 2);
  r.dist = Math.max(0, away - r.reach);
  if (parked) {
    if (b.park === undefined) b.park = parkDistance(b);
    r.park = b.park;
  }
  return r;
}

function nearRows(out, sector, sys, cam, t) {
  out.push(rowOf(baseOf('system', sys, sys), cam, t, true));
  for (const p of sys.planets) {
    out.push(rowOf(baseOf('planet', p, sys), cam, t, true));
    for (const m of p.moonList ?? []) out.push(rowOf(baseOf('moon', m, sys, p), cam, t, true));
  }
  for (const st of sector.stations ?? []) if (st.i === sys.i) out.push(rowOf(baseOf('station', st, sys), cam, t, true));
}

// a wonder or an extra: one that moves is where its card's mover has it
function addThing(place, si, a, b, row, cam, t, far) {
  const card = thingCardOf(row.kind);
  const at = card.move ? card.move(row, t) : row.at;
  const reach = placeReach(place === EXTRA ? 'extra' : 'wonder', row);
  const dx = at[0] - cam[0];
  const dy = at[1] - cam[1];
  const dz = at[2] - cam[2];
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d - reach <= (card.far ?? far)) add(place, si, a, b, 0, at[0], at[1], at[2], d);
}

// (most: the furthest a lattice thing is listed from, so a sector whose box
// is further off has none to list)
function addLattice(sector, si, cam, t, far, most) {
  const set = sector.things;
  const count = set?.count ?? 0;
  if (!count) return;
  const o = sector.origin;
  const bx = Math.max(0, Math.abs(cam[0] - o[0]) - HALF);
  const by = Math.max(0, Math.abs(cam[1] - o[1]) - HALF);
  const bz = Math.max(0, Math.abs(cam[2] - o[2]) - HALF);
  if (bx * bx + by * by + bz * bz > most * most) return;
  const { at, size, kind } = set;
  for (let i = 0; i < count; i++) {
    const k = LATTICE[kind[i]];
    const reach = k.per * size[i];
    const lim = (k.card.far ?? far) + reach;
    let x = o[0] + at[i * 3];
    let y = o[1] + at[i * 3 + 1];
    let z = o[2] + at[i * 3 + 2];
    if (k.card.move) [x, y, z] = k.card.move(thingOf(sector, i).src.row, t);
    const dx = x - cam[0];
    const dy = y - cam[1];
    const dz = z - cam[2];
    const dd = dx * dx + dy * dy + dz * dz;
    if (dd <= lim * lim) add(THING, si, i, 0, 0, x, y, z, Math.sqrt(dd));
  }
}

function keptRow(c, cam, t) {
  const sector = list[idx[c * 4]];
  const a = idx[c * 4 + 1];
  const b = idx[c * 4 + 2];
  const at = [pos[c * 3], pos[c * 3 + 1], pos[c * 3 + 2]];
  const d = mid[c];
  const place = code[c];
  if (place === THING) return rowOf(thingOf(sector, a), cam, t, true, at, d);
  if (place === WONDER) return rowOf(baseOf('wonder', sector.wonders[a]), cam, t, true, at, d);
  if (place === EXTRA) return rowOf(baseOf('extra', sector.extras[SECTOR_EXTRAS[a].list][b]), cam, t, true, at, d);
  const sys = sector.systems[a];
  if (place === SYSTEM) return rowOf(baseOf('system', sys, sys), cam, t, true, at, d);
  const p = sys.planets[b];
  if (place === PLANET) return rowOf(baseOf('planet', p, sys), cam, t, false, at, d);
  return rowOf(baseOf('moon', p.moonList[idx[c * 4 + 3]], sys, p), cam, t, false, at, d);
}

export function placesAround(sectors, cam, t, { far = AROUND.far, inside = AROUND.inside, max = AROUND.max } = {}) {
  const out = [];
  const most = LATTICE.reduce((m, k) => Math.max(m, k.card.far ?? far), far) + LATTICE_REACH;
  n = 0;
  list.length = 0;
  for (const sector of sectorsOf(sectors)) if (sector) list.push(sector);
  for (let si = 0; si < list.length; si++) {
    const sector = list[si];
    const { systems } = sector;
    for (let j = 0; j < systems.length; j++) {
      const sys = systems[j];
      const dx = sys.at[0] - cam[0];
      const dy = sys.at[1] - cam[1];
      const dz = sys.at[2] - cam[2];
      const dS = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dS <= sys.reach + inside) {
        nearRows(out, sector, sys, cam, t);
        continue;
      }
      const rs = placeReach('system', sys);
      if (dS - rs <= far) add(SYSTEM, si, j, 0, 0, sys.at[0], sys.at[1], sys.at[2], dS);
      // (everything of a system is within its reach of its star; the disc
      // layer looks at a system's bodies within twice that, so this does)
      if (!(dS <= far + 2 * sys.reach)) continue;
      const { planets } = sys;
      for (let k = 0; k < planets.length; k++) {
        const p = planets[k];
        orbitAt(p, t, P);
        const rp = placeReach('planet', p);
        const d = Math.sqrt((P[0] - cam[0]) ** 2 + (P[1] - cam[1]) ** 2 + (P[2] - cam[2]) ** 2);
        if (d - rp <= far) add(PLANET, si, j, k, 0, P[0], P[1], P[2], d);
        const moons = p.moonList ?? [];
        for (let q = 0; q < moons.length; q++) {
          moonAt(moons[q], p, t, M, P);
          const rm = placeReach('moon', moons[q]);
          const dm = Math.sqrt((M[0] - cam[0]) ** 2 + (M[1] - cam[1]) ** 2 + (M[2] - cam[2]) ** 2);
          if (dm - rm <= far) add(MOON, si, j, k, q, M[0], M[1], M[2], dm);
        }
      }
    }
    const wonders = sector.wonders ?? [];
    for (let j = 0; j < wonders.length; j++) addThing(WONDER, si, j, 0, wonders[j], cam, t, far);
    for (let e = 0; e < SECTOR_EXTRAS.length; e++) {
      const rows = sector.extras?.[SECTOR_EXTRAS[e].list] ?? [];
      for (let k = 0; k < rows.length; k++) addThing(EXTRA, si, e, k, rows[k], cam, t, far);
    }
    addLattice(sector, si, cam, t, far, most);
  }

  // the nearest max of the rest by their middles, when there are more
  const keep = Math.min(n, max >= 0 ? Math.floor(max) : 0);
  for (let c = 0; c < n; c++) order[c] = c;
  if (keep < n && keep > 0) nearestFirst(order.subarray(0, n), keep, nearer);
  const kept = order.subarray(0, keep);
  for (let j = 0; j < kept.length; j++) out.push(keptRow(kept[j], cam, t));
  list.length = 0; // (so a sector let go isn't held here)
  return out.sort((a, b) => a.dist - b.dist);
}

export const hereZone = (row) => ({ in: row.park + PARK_GAP.in, out: row.park + PARK_GAP.out });

export function orbitingPlace(ship, current, rows, prefer = null) {
  let best = null;
  let bestIn = Infinity;
  let stay = null;
  for (const row of rows) {
    if (row.park == null) continue;
    const zone = hereZone(row);
    const d = Math.hypot(ship.x - row.at[0], ship.y - row.at[1], ship.z - row.at[2]);
    if (prefer != null && row.id === prefer && d < zone.in) return prefer;
    if (current != null && row.id === current && d < zone.out) stay = zone;
    if (d < zone.in && zone.in < bestIn) {
      best = row.id;
      bestIn = zone.in;
    }
  }
  if (stay) return Math.abs(ship.speed ?? 0) >= AROUND.underWay && best !== null && bestIn < stay.in ? best : current;
  return best;
}

const stars = []; // (aimStars' systems, kept between calls)
let starD = new Float64Array(0);
let starOrder = new Int32Array(0);
const starNearer = (a, b) => (starD[a] < starD[b] ? -1 : starD[a] > starD[b] ? 1 : a - b);

export function aimStars(sectors, cam, { max = 2000 } = {}) {
  stars.length = 0;
  for (const sector of sectorsOf(sectors)) for (const sys of sector?.systems ?? []) stars.push(sys);
  if (starD.length < stars.length) {
    starD = new Float64Array(stars.length * 2);
    starOrder = new Int32Array(stars.length * 2);
  }
  for (let i = 0; i < stars.length; i++) {
    const at = stars[i].at;
    starD[i] = Math.hypot(at[0] - cam[0], at[1] - cam[1], at[2] - cam[2]);
    starOrder[i] = i;
  }
  const k = Math.min(stars.length, Math.max(0, Math.floor(max)));
  if (k > 0 && k < stars.length) nearestFirst(starOrder.subarray(0, stars.length), k, starNearer);
  const nearest = starOrder.subarray(0, k).sort(starNearer);
  const out = new Array(k);
  for (let j = 0; j < k; j++) {
    const sys = stars[nearest[j]];
    out[j] = { id: sys.id, at: sys.at, reach: placeReach('system', sys) };
  }
  stars.length = 0;
  return out;
}
