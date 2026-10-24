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
// system's reach. Told what's built (`built`), a system that isn't keeps its
// discs whole however near, so nothing goes with nothing in its place. A
// wonder gives way where its ball is real (realAt, as its speck has it).
//
// The budget is the most it draws, the nearest kept. Its edge fades as the
// far plane does: past the budget, the far plane comes in to the nearest
// left out, so a disc comes and goes at nothing as the camera moves. A
// budget raised eases its edge out a twentieth a frame; one cut takes at
// once.
//
// pickDiscs(xyzr, n, cam, { far = FAR, max = Infinity, out }) → Int32Array:
//   of the first n candidates (four numbers each: where, and the radius),
//   the indices within far + r of cam, the nearest max kept (a tie to the
//   lower index), far to near; written into `out` when it's long enough
// createDiscs(far, { budget, built }) → { feed(sectors, cam, t), setBudget(budget) }
//   far: the far layer; budget: universe/budget.js's row (its `discs`);
//   built: () → the ids of the systems built in full (near.js's built()),
//   or none, to take every system within its reach as built
//   feed(sectors, cam, t): a frame's. The sectors through addBodies (null
//   for none), where the camera is (the far layer's parent's space, the
//   map's) and the shared clock in seconds (orbits.js's spaceTime)
//   setBudget(budget): a new row, from the pace's step

import * as THREE from 'three';
import { moonAt, orbitAt } from '../gen/orbits';
import { FAR, levelWeights, realAt } from './levels';
import { MOON_LOOK, TYPE_LOOK, WONDER, WONDER_SPECK, lookColour } from './sectors';

const GROW = 1.05; // a raised budget's edge eases out by this much a frame
const EDGE_LEAST = 1000; // (and from at least this, so one at nothing still grows)
const LOOK = 7; // a candidate's look: its colour, the way to its star, how much is left to its disc

let dists = new Float64Array(0); // (pickDiscs' distances and order, kept between calls)
let order = new Int32Array(0);

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
  const nearest = order.subarray(0, m).sort((a, b) => dists[a] - dists[b] || a - b);
  const k = Math.min(m, max >= 0 ? Math.floor(max) : 0);
  const res = out && out.length >= k ? out.subarray(0, k) : new Int32Array(k);
  for (let j = 0; j < k; j++) res[j] = nearest[k - 1 - j];
  return res;
}

const has = (ids, id) => (ids.has ? ids.has(id) : ids.includes(id));

export function createDiscs(far, { budget, built = null }) {
  const writer = far.discs;
  let max = budget.discs;
  let edge = -1; // the budget's edge (none yet)
  let rising = false;
  // a frame's candidates: where and how big, and how each looks
  let n = 0;
  let xyzr = new Float64Array(256 * 4);
  let look = new Float64Array(256 * LOOK);
  let picked = new Int32Array(256);
  const ids = [];
  const colours = new Map(); // a hex colour's THREE.Color, made once
  const W = { full: 0, disc: 0, speck: 0 };
  const REACH = { reach: 0 };
  const EDGE = { reach: 0, far: FAR }; // (the far plane, or the budget's edge, with nothing built)
  const PICK = { far: FAR, max: 0, out: null };

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

  return {
    feed(sectors, cam, t = 0) {
      n = 0;
      const held = built ? built() : null;
      for (const sector of sectors) {
        if (!sector) continue;
        for (const s of sector.systems) {
          // (everything of a system is within its reach of its star)
          const dS = distTo(s.at, cam);
          if (!(dS <= FAR + 2 * s.reach)) continue;
          REACH.reach = s.reach;
          const hand = held && !has(held, s.id) ? 1 : 1 - levelWeights(dS, REACH, W).full;
          add(s.at, s.star.size, s.star.color, null, hand, s.id);
          for (const p of s.planets) {
            add(orbitAt(p, t), p.radius, lookColour(TYPE_LOOK[p.type] ?? TYPE_LOOK.rock), s.at, hand, p.id);
            for (const m of p.moonList) add(moonAt(m, p, t), m.radius, lookColour(MOON_LOOK[m.type] ?? MOON_LOOK.rocky), s.at, hand, m.id);
          }
        }
        for (const w of sector.wonders) {
          if (w.kind === 'nebula') continue;
          const lk = WONDER[w.kind] ?? WONDER.rogue;
          REACH.reach = realAt({ r: w.size * WONDER_SPECK });
          add(w.at, w.size * lk.r, lk.dark ?? lk.color, null, 1 - levelWeights(distTo(w.at, cam), REACH, W).full, w.id);
        }
      }

      // the nearest the budget allows, and the nearest left out, for its edge
      if (picked.length < n + 1) picked = new Int32Array(2 * n + 1);
      PICK.max = max + 1;
      PICK.out = picked;
      const list = pickDiscs(xyzr, n, cam, PICK);
      const over = list.length > max;
      const target = over ? Math.min(FAR, distOf(list[0], cam)) : FAR;
      edge = rising && edge >= 0 ? Math.min(target, Math.max(edge, EDGE_LEAST) * GROW) : target;
      if (edge >= target) rising = false;
      EDGE.far = edge;

      writer.begin();
      for (let j = over ? 1 : 0; j < list.length; j++) {
        const k = list[j];
        const l = k * LOOK;
        const alpha = look[l + 6] * levelWeights(distOf(k, cam), EDGE, W).disc;
        if (alpha > 0) writer.push(xyzr[k * 4], xyzr[k * 4 + 1], xyzr[k * 4 + 2], xyzr[k * 4 + 3], look[l], look[l + 1], look[l + 2], look[l + 3], look[l + 4], look[l + 5], alpha, ids[k]);
      }
      writer.end();
    },
    setBudget(next) {
      if (next.discs > max) rising = true;
      max = next.discs;
    },
  };
}
