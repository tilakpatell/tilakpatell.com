// Generated stars, planets, moons and wonders within the far plane, drawn as
// discs of their true size by the far layer (universe/farStars.js's discs
// writer, its one draw): levels.js's second level. Every frame it gathers
// what the loaded sectors hold near enough:
//   - each system's star, shining in its colour
//   - its planets where their orbits have them on the shared clock
//     (orbitAt), and their moons (moonAt), lit from their star, each in the
//     colour of the look it's built with (sectors.js's TYPE_LOOK, MOON_LOOK)
//   - the wonders but the nebulae (lane 1's), as their balls (WONDER)
// and pushes each with how much of it shows: levels.js's disc weight, grown
// in from nothing over the far plane's last fifth and gone to nothing over
// the last fifth of where the real thing takes over, which covers it.
//
// A system is built whole within its reach (near.js), so all of it gives
// way together, by how far the camera is from its star against the
// system's reach, or the reach near.js says it's built within. Told what's
// built (`built`), a system that isn't keeps its discs whole however near,
// so nothing goes with nothing in its place. A wonder gives way where its
// ball is real (realAt, as its speck has it).
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
// pickDiscs(xyzr, n, cam, { far = FAR, max = Infinity, out }) → Int32Array:
//   of the first n candidates (four numbers each: where, and the radius),
//   the indices within far + r of cam, the nearest max kept (a tie to the
//   lower index), far to near; written into `out` when it's long enough
// createDiscs(far, { budget, built }) → { feed(sectors, cam, t), setBudget(budget) }
//   far: the far layer; budget: universe/budget.js's row (its `discs`);
//   built: () → the systems built in full (near.js's built()): their ids,
//   an array or a set, each given up by its own reach; or a map of each id
//   to the reach it's built within, given up by that; or none, to take
//   every system within its reach as built
//   feed(sectors, cam, t): a frame's. The sectors through addBodies (null
//   for none), where the camera is (the far layer's parent's space, the
//   map's) and the shared clock in seconds (orbits.js's spaceTime). It
//   allocates nothing for a body.
//   setBudget(budget): a new row, from the pace's step

import * as THREE from 'three';
import { moonAt, orbitAt } from '../gen/orbits';
import { FADE, FAR, discPx, levelWeights, realAt } from './levels';
import { MOON_LOOK, TYPE_LOOK, WONDER, WONDER_SPECK, lookColour } from './sectors';

const LOOK = 7; // a candidate's look: its colour, the way to its star, how much is left to its disc
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
// the reach a system gives way by, told what's built: -1 for one that isn't
const reachOf = (held, s) => (held.get ? (held.get(s.id) ?? -1) : has(held, s.id) ? s.reach : -1);

// `from` eased toward `to`, its inverse moving by `step` at most (none, or
// less, holds it where it is)
function ease(from, to, step) {
  const a = 1 / Math.max(from, 1);
  const b = 1 / Math.max(to, 1);
  if (!(Math.abs(b - a) > step)) return to;
  return step > 0 ? 1 / (b > a ? a + step : a - step) : from;
}

export function createDiscs(far, { budget, built = null }) {
  const writer = far.discs;
  let max = budget.discs;
  let edge = -1; // the budget's edge (none yet)
  const was = new Float64Array(3); // where the camera was, the frame before
  // a frame's candidates: where and how big, and how each looks
  let n = 0;
  let xyzr = new Float64Array(256 * 4);
  let look = new Float64Array(256 * LOOK);
  let picked = new Int32Array(256);
  let near = new Float64Array(256); // (the picked's distances, as they're listed)
  let list = picked;
  const ids = [];
  const colours = new Map(); // a hex colour's THREE.Color, made once
  const W = { full: 0, disc: 0, speck: 0 };
  const REACH = { reach: 0 };
  const SPECK = { r: 0 }; // (a wonder's speck, for where its ball is real)
  const EDGE = { reach: 0, far: FAR }; // (the far plane, or the budget's edge, with nothing built)
  const PICK = { far: FAR, max: Infinity, out: null };
  const P = new Float64Array(3); // a planet where it is this frame, and a moon of it
  const M = new Float64Array(3);

  const add = (at, r, hex, star, hand, id) => {
    if (n * 4 >= xyzr.length) {
      const more = new Float64Array(xyzr.length * 2);
      more.set(xyzr);
      xyzr = more;
      const looks = new Float64Array(look.length * 2);
      looks.set(look);
      look = looks;
    }
    let c = colours.get(hex);
    if (!c) colours.set(hex, (c = new THREE.Color(hex)));
    const k = n++;
    xyzr[k * 4] = at[0];
    xyzr[k * 4 + 1] = at[1];
    xyzr[k * 4 + 2] = at[2];
    xyzr[k * 4 + 3] = r;
    const l = k * LOOK;
    look[l] = c.r;
    look[l + 1] = c.g;
    look[l + 2] = c.b;
    look[l + 3] = star ? star[0] - at[0] : 0;
    look[l + 4] = star ? star[1] - at[1] : 0;
    look[l + 5] = star ? star[2] - at[2] : 0;
    look[l + 6] = hand;
    ids[k] = id;
  };
  const distTo = (at, cam) => Math.sqrt((at[0] - cam[0]) ** 2 + (at[1] - cam[1]) ** 2 + (at[2] - cam[2]) ** 2);
  const distOf = (k, cam) => Math.sqrt((xyzr[k * 4] - cam[0]) ** 2 + (xyzr[k * 4 + 1] - cam[1]) ** 2 + (xyzr[k * 4 + 2] - cam[2]) ** 2);
  // the biggest of the m listed within lo … hi of the camera
  const biggest = (m, lo, hi) => {
    let r = 0;
    for (let j = 0; j < m; j++) {
      if (near[j] > hi) continue;
      if (near[j] < lo) break;
      r = Math.max(r, xyzr[list[j] * 4 + 3]);
    }
    return r;
  };

  return {
    feed(sectors, cam, t = 0) {
      n = 0;
      const held = built ? built() : null;
      for (let i = 0; i < sectors.length; i++) {
        const sector = sectors[i];
        if (!sector) continue;
        const { systems, wonders } = sector;
        for (let j = 0; j < systems.length; j++) {
          const s = systems[j];
          // (everything of a system is within its reach of its star)
          const dS = distTo(s.at, cam);
          if (!(dS <= FAR + 2 * s.reach)) continue;
          const reach = held ? reachOf(held, s) : s.reach;
          REACH.reach = reach;
          const hand = reach < 0 ? 1 : 1 - levelWeights(dS, REACH, W).full;
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
          const hand = 1 - levelWeights(distTo(w.at, cam), REACH, W).full;
          if (hand > 0) add(w.at, w.size * lk.r, lk.dark ?? lk.color, null, hand, w.id);
        }
      }

      // all of them within the far plane, far to near, and the nearest the
      // budget leaves out, where its edge goes
      if (picked.length < n) {
        picked = new Int32Array(2 * n);
        near = new Float64Array(2 * n);
      }
      PICK.out = picked;
      list = pickDiscs(xyzr, n, cam, PICK);
      const m = list.length;
      for (let j = 0; j < m; j++) near[j] = distOf(list[j], cam);
      const keep = max >= 0 ? Math.floor(max) : 0;
      const target = m > keep ? Math.min(FAR, near[m - 1 - keep]) : FAR;
      if (edge < 0) edge = target;
      else {
        // With the camera at once; then eased the rest of the way by what the
        // camera's move leaves of a frame's PX (the edge's move with it, and
        // a disc's own move, as much as a move of the edge's inverse would
        // have spent), for the biggest disc it fades where it is, or, if one
        // is bigger, between where it was and where that takes it (which a
        // slower step stays within).
        const moved = distTo(was, cam);
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
      EDGE.far = edge;

      writer.begin();
      for (let j = 0; j < m; j++) {
        if (!(near[j] < edge)) continue;
        const k = list[j];
        const l = k * LOOK;
        const alpha = look[l + 6] * levelWeights(near[j], EDGE, W).disc;
        if (alpha > 0) writer.push(xyzr[k * 4], xyzr[k * 4 + 1], xyzr[k * 4 + 2], xyzr[k * 4 + 3], look[l], look[l + 1], look[l + 2], look[l + 3], look[l + 4], look[l + 5], alpha, ids[k]);
      }
      writer.end();
    },
    setBudget(next) {
      max = next.discs;
    },
  };
}
