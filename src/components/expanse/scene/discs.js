// Generated stars, planets, moons, wonders and things within the far plane,
// drawn as discs of their true size by the far layer (universe/farStars.js's discs
// writer, its one draw): levels.js's second level. Every frame it gathers
// what the loaded sectors hold near enough:
//   - each system's star, shining in its colour
//   - its planets where their orbits have them on the shared clock
//     (orbitAt), and their moons (moonAt), lit from their star, each in the
//     colour of the look it's built with (sectors.js's TYPE_LOOK, MOON_LOOK)
//   - the wonders but the nebulae, as their balls (WONDER); a nebula's
//     cloud stands for it out to the far plane (sectors.js)
//   - the lattice's things and the sector's extras (gen/things.js), each in
//     its kind's look (nearThings.js's lookOf), a lit one lit from the light
//     it's told, the key where the camera is (the same light their balls
//     are lit by, near), or shining in its colour with none
// and pushes each with how much of it shows: levels.js's disc weight, grown
// in from nothing over the far plane's last fifth and gone to nothing over
// the last fifth of where the real thing takes over, which covers it.
//
// A system is built whole within its reach (near.js), so all of it gives
// way together, by how far the camera is from its star against the
// system's reach, or the reach near.js says it's built within. Told what's
// built (`built`), a system that isn't keeps its discs whole however near,
// so nothing goes with nothing in its place. A wonder gives way where its
// ball is real (realAt, as its speck has it), and a thing within THING_NEAR
// of its size, to what's built of it there (nearThings.js); told what's
// drawn near (`shown`), one that isn't keeps its disc whole.
//
// The budget is the most it draws, the nearest kept, and only what shows
// counts: a system given up to what's built, or a wonder to its ball, takes
// none of it. Its edge fades as the far plane does: past the budget, the far
// plane comes in to the nearest left out, so a disc comes and goes at
// nothing as the camera moves. The edge follows the camera at once, as the
// nearest left out moves no faster than it does. Whatever else moves it (a
// new budget, a system given up or come back) it eases, so no disc comes or
// goes by more than 4 px a frame (on a 1,080 px screen at the chase's lens);
// while it eases in, it draws more than the budget, the farthest fading.
//
// The things are many (the lattice holds one a 6,000 cube: some 1,750
// within the far plane), so where there are things they have a share of the
// budget of their own (THING_SHARE), and the bodies the rest. Theirs is
// drawn out to an edge of its own, a distance from the camera within which
// the lattice holds a little under their share (thingsFar), so it doesn't
// move with what's loaded and a thing comes and goes there at nothing as the
// camera moves; a new share eases it, as the budget's does. The nearest of
// them the share allows are kept, should more crowd in (another lane's
// extras).
//
// pickDiscs(xyzr, n, cam, { far = FAR, max = Infinity, out }) → Int32Array:
//   of the first n candidates (four numbers each: where, and the radius),
//   the indices within far + r of cam, the nearest max kept (a tie to the
//   lower index), far to near; written into `out` when it's long enough
// createDiscs(far, { budget, built, shown }) → { feed(sectors, cam, t, shares, light), setBudget(budget), edge() }
//   far: the far layer; budget: universe/budget.js's row (its `discs`);
//   built: () → the systems built in full (near.js's built()): their ids,
//   an array or a set, each given up by its own reach; or a map of each id
//   to the reach it's built within, given up by that; or none, to take
//   every system within its reach as built
//   shown: () → the ids of the wonders and things drawn near (nearThings.js's
//   shown(), a set), each given up within where it's built; none, to take
//   every one within it as drawn
//   feed(sectors, cam, t, shares, light): a frame's. The sectors through addBodies
//   (null for none), where the camera is (the far layer's parent's space,
//   the map's), the shared clock in seconds (orbits.js's spaceTime) and how
//   much of each sector shows (0 … 1, one a sector in its order: a sector
//   come in fading in; none, and all of each), and the way toward the
//   light the lit things are lit from, [x, y, z] (none: they shine). It
//   allocates nothing for a body.
//   setBudget(budget): a new row, from the pace's step
//   edge(): where the bodies' budget ends as of the last feed, the far plane while
//   all within it fit (or none's been fed): where the far layer's specks
//   come in (farStars' setDiscEdge), so nothing's missing between the two
// THING_SHARE; thingShare(discs) → the things' share of a budget's discs;
//   thingsFar(share) → the distance from the camera the lattice fills to a
//   little under that many (never past the far plane)

import * as THREE from 'three';
import { SECTOR } from '../../../lib/space/address';
import { moonAt, orbitAt } from '../gen/orbits';
import { THING_CELLS, THING_KINDS, THING_NEAR } from '../gen/things';
import { FADE, FAR, discPx, levelWeights, realAt } from './levels';
import { biggestThing, eachThingWithin, lookOf, thingIdOf } from './nearThings';
import { MOON_LOOK, TYPE_LOOK, WONDER, WONDER_SPECK, lookColour } from './sectors';

const LOOK = 7; // a candidate's look: its colour, the way to its light, how much is left to its disc
export const THING_SHARE = 0.25; // the things' share of the discs, where there are things
const THING_FILL = 0.85; // the share of it the lattice fills within their edge (the most kept seldom bites)
const CELL = SECTOR / THING_CELLS; // (a lattice cell, which holds one thing at most)
const LENS = { fovY: 34, height: 1080 }; // the chase's lens (flight.js's FOV) on a 1,080 px screen
const PX = 4; // the most a disc comes or goes by in a frame, as the spec's pop check counts
// How far the inverse of the budget's edge moves in a frame at most, times
// the radius of the biggest disc it fades. At the edge E, a disc d off weighs
// 1 − S(d / (FADE·E) − (1 − FADE) / FADE), S a smoothstep, whose slope is 1.5
// at most; as 1/E moves by δ, that moves by 1.5·d·δ / FADE at most. The disc
// is r·discPx(1, 1) / d pixels across, so its pixels move by 1.5·r·discPx(1, 1)·δ
// / FADE at most, however far off it is.
const EASE = (PX * FADE) / (1.5 * discPx(1, 1, LENS));

let dists = new Float64Array(0); // (pickDiscs' distances and order, kept between calls)
let order = new Int32Array(0);
// (a whole number back: a fraction handed back to the sort is boxed, every compare)
const nearer = (a, b) => (dists[a] < dists[b] ? -1 : dists[a] > dists[b] ? 1 : a - b);

export function pickDiscs(xyzr, n, cam, { far = FAR, max = Infinity, out = null } = {}) {
  if (dists.length < n) {
    dists = new Float64Array(n * 2);
    order = new Int32Array(n * 2);
  }
  let m = 0;
  for (let i = 0; i < n; i++) {
    const dx = xyzr[i * 4] - cam[0];
    const dy = xyzr[i * 4 + 1] - cam[1];
    const dz = xyzr[i * 4 + 2] - cam[2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d <= far + xyzr[i * 4 + 3]) {
      dists[i] = d;
      order[m++] = i;
    }
  }
  const nearest = order.subarray(0, m).sort(nearer);
  const k = Math.min(m, max >= 0 ? Math.floor(max) : 0);
  const res = out && out.length >= k ? out.subarray(0, k) : new Int32Array(k);
  for (let j = 0; j < k; j++) res[j] = nearest[k - 1 - j];
  return res;
}

const has = (ids, id) => (ids.has ? ids.has(id) : ids.includes(id));
const NO_LIGHT = [0, 0, 0];
// the reach a system gives way by, told what's built: -1 for one that isn't
const reachOf = (held, s) => (held.get ? (held.get(s.id) ?? -1) : has(held, s.id) ? s.reach : -1);

// `from` eased toward `to`, its inverse moving by `step` at most (none, or
// less, holds it where it is)
// The things' share of a budget's discs, and the distance from the camera
// that holds about THING_FILL of it: at the lattice's most, one a cell
// (gen/things.js's), so a sphere of it holds 4/3·π·(d / CELL)³; never past
// the far plane, and the far plane with no budget to speak of
export const thingShare = (discs) => (discs === Infinity ? Infinity : Math.max(0, Math.floor(THING_SHARE * discs)));
export const thingsFar = (share) => Math.min(FAR, CELL * Math.cbrt((THING_FILL * share) / ((4 / 3) * Math.PI)));
const shareAt = (edge) => ((4 / 3) * Math.PI * (edge / CELL) ** 3) / THING_FILL;

function ease(from, to, step) {
  const a = 1 / Math.max(from, 1);
  const b = 1 / Math.max(to, 1);
  if (!(Math.abs(b - a) > step)) return to;
  return step > 0 ? 1 / (b > a ? a + step : a - step) : from;
}

export function createDiscs(far, { budget, built = null, shown = null }) {
  const writer = far.discs;
  let max = budget.discs;
  let edge = -1; // the budget's edge (none yet)
  let thingEdge = -1; // and the things'
  let had = 0; // (how many of each it had to draw within the far plane, the frame before)
  let hadThings = 0;
  const was = new Float64Array(3); // where the camera was, the frame before
  // a frame's candidates, the bodies' and the things': where and how big,
  // how each looks, and its id
  const poolOf = () => ({ n: 0, xyzr: new Float64Array(256 * 4), look: new Float64Array(256 * LOOK), d: new Float64Array(256), ids: [], picked: new Int32Array(256), near: new Float64Array(256), list: null });
  const bodies = poolOf();
  const things = poolOf();
  const colours = new Map(); // a hex colour's THREE.Color, made once
  const W = { full: 0, disc: 0, speck: 0 };
  const REACH = { reach: 0 };
  const SPECK = { r: 0 }; // (a wonder's speck, for where its ball is real)
  const EDGE = { reach: 0, far: FAR }; // (the far plane, or the budget's edge, with nothing built)
  const PICK = { far: FAR, max: Infinity, out: null };
  const P = new Float64Array(3); // a planet where it is this frame, and a moon of it
  const M = new Float64Array(3);

  // a candidate: where, its radius, its colour, the way to its light (none:
  // it shines), how much is left to its disc, its id and (a thing's) how far
  // off it is
  const put = (pool, x, y, z, r, hex, lx, ly, lz, hand, id, d = 0) => {
    if (pool.n * 4 >= pool.xyzr.length) {
      const more = new Float64Array(pool.xyzr.length * 2);
      more.set(pool.xyzr);
      pool.xyzr = more;
      const looks = new Float64Array(pool.look.length * 2);
      looks.set(pool.look);
      pool.look = looks;
      const ds = new Float64Array(pool.d.length * 2);
      ds.set(pool.d);
      pool.d = ds;
    }
    pool.d[pool.n] = d;
    let c = colours.get(hex);
    if (!c) colours.set(hex, (c = new THREE.Color(hex)));
    const k = pool.n++;
    const { xyzr, look } = pool;
    xyzr[k * 4] = x;
    xyzr[k * 4 + 1] = y;
    xyzr[k * 4 + 2] = z;
    xyzr[k * 4 + 3] = r;
    const l = k * LOOK;
    look[l] = c.r;
    look[l + 1] = c.g;
    look[l + 2] = c.b;
    look[l + 3] = lx;
    look[l + 4] = ly;
    look[l + 5] = lz;
    look[l + 6] = hand;
    pool.ids[k] = id;
  };
  // a body, lit from its star, or shining
  const add = (at, r, hex, star, hand, id) =>
    star ? put(bodies, at[0], at[1], at[2], r, hex, star[0] - at[0], star[1] - at[1], star[2] - at[2], hand, id) : put(bodies, at[0], at[1], at[2], r, hex, 0, 0, 0, hand, id);
  // a thing: given up within THING_NEAR of its size once it's drawn near
  // (or always, told nothing), lit from the frame's light if its look is lit
  let drawn = null;
  let light = NO_LIGHT;
  let biggestNow = 0; // (the biggest thing a frame)
  const thing = (x, y, z, size, lk, d, share, id) => {
    let hand = share;
    const near = THING_NEAR * size;
    if (d < near && (!drawn || drawn.has(id))) {
      REACH.reach = near;
      hand *= 1 - levelWeights(d, REACH, W).full;
    }
    if (!(hand > 0)) return;
    biggestNow = Math.max(biggestNow, size);
    const l = lk.lit ? light : NO_LIGHT;
    put(things, x, y, z, size, lk.color, l[0], l[1], l[2], hand, id, d);
  };
  // (the lattice things of the sector being gathered, each visited once)
  let of = null;
  let ofShare = 1;
  let ofCam = null;
  let reach = FAR; // (how far off a thing is wanted this frame: the things' edge, or the far plane)
  const visit = (i) => {
    const t = of.things;
    const o = of.origin;
    const x = o[0] + t.at[i * 3];
    const y = o[1] + t.at[i * 3 + 1];
    const z = o[2] + t.at[i * 3 + 2];
    const size = t.size[i];
    const d = Math.sqrt((x - ofCam[0]) ** 2 + (y - ofCam[1]) ** 2 + (z - ofCam[2]) ** 2);
    if (d <= reach + size) thing(x, y, z, size, (THING_KINDS[t.kind[i]] ?? THING_KINDS[0]).look, d, ofShare, thingIdOf(of, i));
  };
  const distTo = (at, cam) => Math.sqrt((at[0] - cam[0]) ** 2 + (at[1] - cam[1]) ** 2 + (at[2] - cam[2]) ** 2);
  const distOf = (pool, k, cam) => Math.sqrt((pool.xyzr[k * 4] - cam[0]) ** 2 + (pool.xyzr[k * 4 + 1] - cam[1]) ** 2 + (pool.xyzr[k * 4 + 2] - cam[2]) ** 2);
  // the biggest of the m bodies listed within lo … hi of the camera
  const biggest = (m, lo, hi) => {
    let r = 0;
    for (let j = 0; j < m; j++) {
      if (bodies.near[j] > hi) continue;
      if (bodies.near[j] < lo) break;
      r = Math.max(r, bodies.xyzr[bodies.list[j] * 4 + 3]);
    }
    return r;
  };
  // a pool's candidates within `within` (and their radii) of the camera, the
  // nearest `most` kept, far to near, with how far each is
  const pick = (pool, cam, within, most) => {
    if (pool.picked.length < pool.n) {
      pool.picked = new Int32Array(2 * pool.n);
      pool.near = new Float64Array(2 * pool.n);
    }
    PICK.far = within;
    PICK.max = most;
    PICK.out = pool.picked;
    pool.list = pickDiscs(pool.xyzr, pool.n, cam, PICK);
    for (let j = 0; j < pool.list.length; j++) pool.near[j] = distOf(pool, pool.list[j], cam);
    return pool.list.length;
  };
  // the things within their edge pushed to the far layer, faded in over the
  // edge's last fifth: as they came while they're no more than `most` (the
  // far layer puts them in order), else the nearest `most`
  const pushThings = (cam, at, most) => {
    const { n: count, d, look, xyzr, ids } = things;
    let within = 0;
    for (let k = 0; k < count; k++) if (d[k] < at) within++;
    if (within > most) return push(things, pick(things, cam, at, most), at);
    EDGE.far = at;
    for (let k = 0; k < count; k++) {
      if (!(d[k] < at)) continue;
      const l = k * LOOK;
      const alpha = look[l + 6] * levelWeights(d[k], EDGE, W).disc;
      if (alpha > 0) writer.push(xyzr[k * 4], xyzr[k * 4 + 1], xyzr[k * 4 + 2], xyzr[k * 4 + 3], look[l], look[l + 1], look[l + 2], look[l + 3], look[l + 4], look[l + 5], alpha, ids[k]);
    }
  };
  // those of a pool within its edge pushed to the far layer, faded in over
  // the edge's last fifth
  const push = (pool, m, at) => {
    EDGE.far = at;
    for (let j = 0; j < m; j++) {
      if (!(pool.near[j] < at)) continue;
      const i = pool.list[j];
      const l = i * LOOK;
      const { xyzr, look } = pool;
      const alpha = look[l + 6] * levelWeights(pool.near[j], EDGE, W).disc;
      if (!(alpha > 0)) continue;
      writer.push(xyzr[i * 4], xyzr[i * 4 + 1], xyzr[i * 4 + 2], xyzr[i * 4 + 3], look[l], look[l + 1], look[l + 2], look[l + 3], look[l + 4], look[l + 5], alpha, pool.ids[i]);
    }
  };

  return {
    feed(sectors, cam, t = 0, shares = null, toward = null) {
      bodies.n = 0;
      things.n = 0;
      biggestNow = 0;
      const held = built ? built() : null;
      drawn = shown ? shown() : null;
      light = toward ?? NO_LIGHT;
      // the things' share of the budget, and how far off that reaches
      const share = thingShare(max);
      const thingTarget = thingsFar(share);
      reach = Math.max(thingEdge, thingTarget);
      let holdsThings = false;
      for (let i = 0; i < sectors.length; i++) {
        const sector = sectors[i];
        const part = shares ? shares[i] : 1;
        if (!sector || !(part > 0)) continue;
        const { systems, wonders, extras } = sector;
        for (let j = 0; j < systems.length; j++) {
          const s = systems[j];
          // (everything of a system is within its reach of its star)
          const dS = distTo(s.at, cam);
          if (!(dS <= FAR + 2 * s.reach)) continue;
          const sReach = held ? reachOf(held, s) : s.reach;
          REACH.reach = sReach;
          const hand = part * (sReach < 0 ? 1 : 1 - levelWeights(dS, REACH, W).full);
          if (!(hand > 0)) continue;
          add(s.at, s.star.size, s.star.color, null, hand, s.id);
          const { planets } = s;
          for (let k = 0; k < planets.length; k++) {
            const p = planets[k];
            orbitAt(p, t, P);
            add(P, p.radius, lookColour(TYPE_LOOK[p.type] ?? TYPE_LOOK.rock), s.at, hand, p.id);
            const moons = p.moonList;
            for (let q = 0; q < moons.length; q++) {
              const mn = moons[q];
              add(moonAt(mn, p, t, M, P), mn.radius, lookColour(MOON_LOOK[mn.type] ?? MOON_LOOK.rocky), s.at, hand, mn.id);
            }
          }
        }
        for (let j = 0; j < wonders.length; j++) {
          const w = wonders[j];
          if (w.kind === 'nebula') continue;
          const lk = WONDER[w.kind] ?? WONDER.rogue;
          SPECK.r = w.size * WONDER_SPECK;
          REACH.reach = realAt(SPECK);
          const given = !drawn || drawn.has(w.id);
          const hand = part * (given ? 1 - levelWeights(distTo(w.at, cam), REACH, W).full : 1);
          if (hand > 0) add(w.at, w.size * lk.r, lk.dark ?? lk.color, null, hand, w.id);
        }
        // its things and extras, as far off as the things' edge reaches
        if (sector.things?.count > 0) {
          holdsThings = true;
          of = sector;
          ofShare = part;
          ofCam = cam;
          eachThingWithin(sector, cam, reach + biggestThing(sector), visit);
          of = ofCam = null;
        }
        if (extras)
          for (const list in extras)
            for (const e of extras[list]) {
              holdsThings = true;
              const d = distTo(e.at, cam);
              if (d <= reach + e.size) thing(e.at[0], e.at[1], e.at[2], e.size, lookOf(e.kind, e.look), d, part, e.id);
            }
      }

      // The bodies: all of them within the far plane, far to near, and the
      // nearest the budget leaves out (less the things' share, where there
      // are things), where its edge goes. With nothing to draw the frame
      // before, there's nothing to ease from: it starts there.
      const m = pick(bodies, cam, FAR, Infinity);
      const { near } = bodies;
      const all = max >= 0 ? Math.floor(max) : 0;
      const keep = holdsThings && share < Infinity ? Math.max(0, all - share) : all;
      const target = m > keep ? Math.min(FAR, near[m - 1 - keep]) : FAR;
      const moved = distTo(was, cam);
      if (edge < 0 || !had) edge = target;
      else {
        // With the camera at once; then eased the rest of the way by what the
        // camera's move leaves of a frame's PX (the edge's move with it, and
        // a disc's own move, as much as a move of the edge's inverse would
        // have spent), for the biggest disc it fades where it is, or, if one
        // is bigger, between where it was and where that takes it (which a
        // slower step stays within).
        const e = target > edge ? Math.min(target, edge + moved) : Math.max(target, edge - moved);
        if (e !== target) {
          const lo = Math.max(1, Math.min(edge, target));
          const spent = Math.abs(1 / Math.max(e, 1) - 1 / Math.max(edge, 1)) + moved / ((1 - FADE) * lo * lo);
          const r = biggest(m, (1 - FADE) * e, e);
          const next = ease(e, target, EASE / r - spent);
          const most = biggest(m, (1 - FADE) * Math.min(edge, next), Math.max(edge, next));
          edge = most > r ? ease(e, target, EASE / most - spent) : next;
        } else edge = e;
      }
      was[0] = cam[0];
      was[1] = cam[1];
      was[2] = cam[2];
      // The things: within their edge, a distance from the camera the
      // lattice fills to under their share (so their count is about the
      // same wherever you are, and the most kept seldom bites), eased to a
      // new share by what the camera's move leaves of a frame's PX for the
      // biggest of them; the most kept, the share their edge is at while it
      // eases.
      if (thingEdge < 0 || !hadThings) thingEdge = thingTarget;
      else {
        const lo = Math.max(1, Math.min(thingEdge, thingTarget));
        thingEdge = ease(thingEdge, thingTarget, EASE / Math.max(1, biggestNow) - moved / ((1 - FADE) * lo * lo));
      }
      had = m;
      hadThings = things.n;

      writer.begin();
      push(bodies, m, edge);
      pushThings(cam, thingEdge, Math.max(share, Math.ceil(shareAt(thingEdge))));
      writer.end();
    },
    setBudget(next) {
      max = next.discs;
    },
    edge: () => (edge < 0 ? FAR : edge),
  };
}
