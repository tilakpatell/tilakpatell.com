// The arrival’s camera (the design’s §4.2): where it stands and looks in each
// beat of rules/arrival.js’s clock, as the films would cut it. The boats on
// a spline across the lake from the jetty to the boathouse under the crag
// (the Road’s line.js shape: a curve sampled by the metre), the lead boat’s
// metres along it by the second, and a shot a beat: a dolly, a ride in a
// boat, a crane, a wide. Under reduced motion each beat is one still frame
// (its middle), so the camera cuts and never glides. Pure: no three.
//
//   ANCHORS_A: the shore’s (Lane A’s rules/shore.js and the far castle) frame
//   routeOf(points) → { length, at(m) → { x, z, tx, tz } }
//   boatsAt(beat, k) → metres along the route the lead boat has come (k: 0…1 through the beat)
//   shotFor(beat, k, { anchors, route, heightAt, reduced }) → { at: [x, y, z], look: [x, y, z], fov }
//   moonFor(from, top, lift) → a direction: the moon set just over a tower’s top as seen from `from`
//   squidAt(route) → [x, z]: where the squid’s arm breaks the water, off to the boats’ right
//
// Beats are rules/arrival.js’s ids; the sets that aren’t on the lake (the
// station, the steps, the hall) are placed by their own origins in `anchors`.

import { STEPS, stairY } from './sets';

export const ANCHORS_A = {
  // the boats’ way: from the jetty’s end across the water to the boathouse at the crag’s foot
  route: [
    [6, -28],
    [12, -62],
    [27, -132],
    [48, -228],
    [76, -336],
    [98, -430],
    [105, -484],
  ],
  castle: [70, -620],
  crown: [94, 176, -642], // the Astronomy Tower’s tip
  cave: [106, -507], // the mouth in the crag’s foot the boats go in by, beside the boathouse
  middle: [62, 92, -620], // the castle’s middle, high on the crag
  shore: { jetty: [6, -10], bank: [-14, 30] },
  water: 0,
};

const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => {
  const x = Math.min(1, Math.max(0, k));
  return x * x * (3 - 2 * x);
};
const ease = (k) => {
  const x = Math.min(1, Math.max(0, k));
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
};

// a centripetal-free Catmull-Rom through the points, sampled a metre at a time
export function routeOf(points, step = 1) {
  const p = [points[0], ...points, points.at(-1)];
  const samples = [];
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    const n = 40;
    for (let j = 0; j < n; j++) {
      const t = j / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
      samples.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  samples.push(points.at(-1));
  // (by arc length: a table of metres along it)
  const dist = [0];
  for (let i = 1; i < samples.length; i++) dist.push(dist[i - 1] + Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]));
  const length = dist.at(-1);
  const at = (m) => {
    const d = Math.min(length, Math.max(0, m));
    let lo = 0;
    let hi = dist.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (dist[mid] <= d) lo = mid;
      else hi = mid;
    }
    const k = (d - dist[lo]) / Math.max(1e-6, dist[hi] - dist[lo]);
    const x = lerp(samples[lo][0], samples[hi][0], k);
    const z = lerp(samples[lo][1], samples[hi][1], k);
    const tx = samples[hi][0] - samples[lo][0];
    const tz = samples[hi][1] - samples[lo][1];
    const l = Math.hypot(tx, tz) || 1;
    return { x, z, tx: tx / l, tz: tz / l };
  };
  void step;
  return { length, at };
}

// the lead boat’s metres along the route through each beat on the water
// (a cut between beats lets them jump on: the films’ crossing is a few shots)
const BOATS = {
  path: [0, 0],
  pushoff: [0, 9],
  glide: [12, 78],
  castle: [86, 218],
  squid: [226, 276],
  cliff: [372, 462],
};
export function boatsAt(beat, k) {
  const b = BOATS[beat];
  if (!b) return beat === 'station' || beat === 'hagrid' || beat === 'platform' ? 0 : Infinity;
  // (the push off gathers way; the rest glide at an even pace)
  const e = beat === 'pushoff' ? ease(k) * 0.6 + k * 0.4 : k;
  return lerp(b[0], b[1], e);
}

export function moonFor(from, top, lift = 0.07) {
  const d = [top[0] - from[0], top[1] - from[1], top[2] - from[2]];
  const l = Math.hypot(...d) || 1;
  const el = Math.asin(d[1] / l) + lift;
  const az = Math.atan2(d[0], d[2]);
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
}

export function squidAt(route) {
  const p = route.at(262);
  return [p.x - p.tz * 44, p.z + p.tx * 44];
}

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

// The shot of a beat, k of the way through it. `sets` places the station,
// the steps and the hall: { station: [x, y, z], steps: [x, y, z], hall: [x, y, z] }
export function shotFor(beat, k, { anchors = ANCHORS_A, route = routeOf(anchors.route), heightAt = () => 0, sets = {}, reduced = false } = {}) {
  const t = reduced ? 0.5 : Math.min(1, Math.max(0, k));
  const w = anchors.water;
  const boat = (m, side = 0, up = 1.1) => {
    const p = route.at(m);
    // (to the right of the way is (-tz, tx))
    return [p.x - p.tz * side, w + up, p.z + p.tx * side];
  };
  const ahead = (m, up = 1) => {
    const p = route.at(m);
    return [p.x, w + up, p.z];
  };
  const S = sets.station ?? [0, 0, 0];
  const H = sets.hall ?? [0, 0, 0];
  const P = sets.steps ?? [0, 0, 0];
  const lead = boatsAt(beat, t);
  switch (beat) {
    // the station (world/arrival/station.js: the platform runs along +x, the train on its −z side,
    // Hagrid at its far end by the engine)
    case 'station':
      return { at: add(S, [lerp(-30, -24, smooth(t)), lerp(3.6, 3.0, t), lerp(9.5, 8.5, t)]), look: add(S, [lerp(6, 2, t), 2.4, -2.2]), fov: 46 };
    case 'hagrid':
      return { at: add(S, [lerp(11.6, 12.3, smooth(t)), 1.42, 4.7]), look: add(S, [17.2, 2.2, 2.2]), fov: 40 };
    case 'platform':
      return { at: add(S, [lerp(-10, 7, smooth(t)), 1.5, 3.7]), look: add(S, [lerp(6, 18, smooth(t)), 1.7, 2.0]), fov: 50 };
    // down the bank to the jetty, the castle across the water for the first time
    case 'path': {
      const at = [lerp(-20, -8, smooth(t)), 0, lerp(36, 22, smooth(t))];
      at[1] = heightAt(at[0], at[2]) + 1.55;
      return { at, look: [lerp(2, 30, smooth(t)), lerp(1.5, 30, smooth(t)), lerp(-10, -400, smooth(t))], fov: 48 };
    }
    // on the jetty’s end, the boats sliding out past it
    case 'pushoff':
      return { at: [anchors.route[0][0] + 3.2, w + 1.5, anchors.route[0][1] + 5], look: add(ahead(lead + 6, 0.6), [0, lerp(0, 4, t), 0]), fov: 44 };
    // low in the third boat, the lanterns ahead on the black water
    case 'glide': {
      const at = boat(lead - 13, 0.4, 1.05);
      return { at, look: add(ahead(lead + 40, 1.4), [0, lerp(0, 8, smooth(t)), 0]), fov: 50 };
    }
    // the castle comes up: low between the two files of boats, their lanterns either side, rising a
    // little, the lens long, the look lifting to the towers
    case 'castle': {
      const at = boat(lead - 17, 0.15, lerp(0.95, 2.4, smooth(t)));
      const forward = ahead(lead + 60, 3);
      const towers = [anchors.middle[0], lerp(anchors.middle[1] * 0.55, anchors.middle[1] * 0.8, smooth(t)), anchors.middle[2]];
      const look = forward.map((v, i) => lerp(v, towers[i], smooth(t * 1.4)));
      return { at, look, fov: lerp(46, 38, smooth(t)) };
    }
    // a wide from off to the left, low on the water: the boats crossing in the middle, the arm
    // rising beyond them, the castle over all
    case 'squid': {
      const p = route.at(244);
      const [sx, sz] = squidAt(route);
      const at = [p.x + p.tz * 34, w + 1.4, p.z - p.tx * 34 + 6];
      const look = [lerp(p.x, sx, 0.55), w + lerp(5, 9, smooth(t)), lerp(p.z, sz, 0.55)];
      return { at, look, fov: 50 };
    }
    // under the cliff: the castle towering overhead, then the look coming down to the ivy and the dark under it
    case 'cliff': {
      const at = boat(lead - 8, -0.5, 1.15);
      const up = [anchors.middle[0], 110, anchors.middle[2]];
      const mouth = [anchors.cave[0], w + 2.5, anchors.cave[1]];
      const k = smooth(t * 1.6);
      return { at, look: up.map((v, i) => lerp(v, mouth[i], k)), fov: 54 };
    }
    // the steps (world/arrival/sets.js’s STEPS: the boats in at the quay, the stair up +z through
    // the rock, the Entrance Hall at its top with McGonagall on the marble stair)
    case 'boathouse':
      return { at: add(P, [lerp(-4.2, -3.2, t), 1.35, lerp(-13, -9, smooth(t))]), look: add(P, [1.2, 1.9, 7]), fov: 52 };
    case 'stair': {
      const z = lerp(8, 50, smooth(t));
      return { at: add(P, [0.45, stairY(z) + 1.5, z]), look: add(P, [0, stairY(z + 12) + 1.9, z + 12]), fov: 54 };
    }
    case 'doors': {
      const m = STEPS.mcgonagall;
      const y = STEPS.hall.y + ((m[2] - STEPS.marble.z0) / (STEPS.marble.z1 - STEPS.marble.z0)) * STEPS.marble.rise;
      return { at: add(P, [lerp(0.5, 0.3, smooth(t)), STEPS.hall.y + 1.45, lerp(66.5, 70.5, smooth(t))]), look: add(P, [m[0], y + lerp(1.4, 1.6, t), m[2]]), fov: 44 };
    }
    // the Great Hall (rooms/greatHall.js’s frame: the doors at +z, the dais at −z)
    case 'hall':
      return { at: add(H, [lerp(0.8, 0.3, t), 1.45, lerp(25, 2, smooth(t))]), look: add(H, [0, lerp(5, 2.6, smooth(t)), lerp(-10, -22, smooth(t))]), fov: lerp(58, 50, t) };
    case 'stool':
      return { at: add(H, [-2.6, 1.5, -15.2]), look: add(H, [0.3, 1.25, -18.6]), fov: 44 };
    // under the Hat’s brim: the hall through the gap, the tables facing you
    case 'hat':
      return { at: add(H, [0, 1.12, -18.65]), look: add(H, [0, 1.2, 0]), fov: 64 };
    case 'house':
      return { at: add(H, [lerp(0, 0.6, t), 1.14, -18.65]), look: add(H, [0, 1.6, 0]), fov: 60 };
    case 'feast':
      return { at: add(H, [lerp(4.4, 4.4, t), lerp(2.2, 4.5, smooth(t)), lerp(-14, -5, smooth(t))]), look: add(H, [0, 1.2, 14]), fov: 54 };
    default:
      return { at: [0, 2, 10], look: [0, 2, 0], fov: 50 };
  }
}
