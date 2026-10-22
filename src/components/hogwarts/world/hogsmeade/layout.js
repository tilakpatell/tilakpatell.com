// Hogsmeade’s set, laid out (the design’s §4.9): the village of
// rules/hogsmeade.js stood in the set’s own frame, which is the Map’s with
// the street’s middle at the origin (rules/paths.js’s ROOM_FRAMES.hogsmeade:
// no turn), so a footprint on the Map and a step in the set are one point.
// Where every building stands and faces, the doors (three shops with an
// inside, the rest fronts with a line), the road back at the station’s end,
// the lamps, where you come in and where each shop lets you out, the walk’s
// edges, the ground and the Shack’s hill. Pure.
//
//   S(along, across) → [x, z] in the set: a point on the street’s frame
//   HERE: { axis, right, half, width }   EDGE: the walkable street-frame box
//   site(id) → { …the building, at, door, faces, out: [x, z] (the way out of
//     its door), yaw (its group’s turn), back: [x, z] (a step out into the street) }
//   SITES: every building’s site, the Shack’s too (id 'shack')
//   doorsOf() → the set’s doors: three into the shops and the road back out
//   spotsOf() → the fronts that only have a line at the door
//   lamps() → [{ at: [x, z], side }] the street’s lamps, clear of every door
//   spawn → { at: [x, 0, z], yaw } at the station’s end, looking up the street
//   exitFor(room) → { at, yaw }: where a shop’s door lets you out into the street
//   floorAt(x, z) → y: the street level, the Shack’s hill rising behind its fence
//   terrainAt(x, z) → y: the land drawn round it (floorAt where you walk), streetFrame([x, z]) → { along, across }
//   walls() → [{ at, r }]: the walk’s edges as circles (behind the buildings, the street’s ends)
//   colliders() → every building, lamp, the arch and the fence, as boxes and circles
//   bounds → { x0, x1, z0, z1 }   poses → the checks’ named views
//   yawFacing([dx, dz]) → the walk’s yaw that looks along a direction

import { BUILDINGS, SHACK, VILLAGE, buildingAt, frameAt } from '../../rules/hogsmeade';

export const HERE = {
  axis: VILLAGE.axis,
  // (the right of a walker going up the street, as frameAt has it)
  right: [-VILLAGE.axis[1], VILLAGE.axis[0]],
  half: VILLAGE.half,
  width: VILLAGE.width,
};

// the street’s frame in the set
export const S = (along, across) => {
  const [x, z] = frameAt(along, across);
  return [x - VILLAGE.at[0], z - VILLAGE.at[1]];
};
const sub = (p) => [p[0] - VILLAGE.at[0], p[1] - VILLAGE.at[1]];

// the walk’s yaw (play/walk.js: yaw 0 looks down −z, ahead is (−sin, −cos)) looking along d
export const yawFacing = ([dx, dz]) => Math.atan2(-dx, -dz);

// where you may walk, in the street’s frame: the street from the station’s
// end up to past the Hog’s Head, and a yard or two behind the fronts
export const EDGE = { a0: -84, a1: 70, c0: -31, c1: 27 };

// the Shack’s own footprint (it stands on its hill, not on the street)
const SHACK_HOUSE = { id: 'shack', name: 'The Shrieking Shack', sign: null, line: null, w: 12, d: 9, h: 12, lean: 0.16, chimney: 1, tone: 'shack' };

export function site(id) {
  if (id === 'shack') {
    const at = sub(SHACK.at);
    // (it looks down the hill toward the village: its front to the street)
    const toStreet = [-at[0], -at[1]];
    const l = Math.hypot(...toStreet) || 1;
    const out = [toStreet[0] / l, toStreet[1] / l];
    return { ...SHACK_HOUSE, at, door: [at[0] + out[0] * (SHACK_HOUSE.d / 2), at[1] + out[1] * (SHACK_HOUSE.d / 2)], faces: Math.atan2(out[0], out[1]), out, yaw: Math.atan2(out[0], out[1]), back: null, ground: SHACK.hill };
  }
  const b = buildingAt(id);
  if (!b) return null;
  const out = [Math.sin(b.faces), Math.cos(b.faces)];
  const door = sub(b.door);
  return { ...b, at: sub(b.at), door, out, yaw: b.faces, back: [door[0] + out[0] * 1.6, door[1] + out[1] * 1.6], ground: 0 };
}

export const SITES = [...BUILDINGS.map((b) => site(b.id)), site('shack')];

export function doorsOf() {
  const shops = SITES.filter((s) => s.room).map((s) => ({ id: s.id, at: s.door, r: 1.1, faces: s.yaw, name: s.name, to: s.room }));
  return [...shops, { id: 'road', at: S(-80, 0), r: 2.6, faces: yawFacing([-HERE.axis[0], -HERE.axis[1]]), name: 'The road back to the castle', verb: 'Go back', to: 'out' }];
}

export const spotsOf = () => SITES.filter((s) => s.line && !s.room).map((s) => ({ id: s.id, at: s.door, r: 1, faces: s.yaw, verb: 'Try', label: s.name, line: s.line }));

// lamps every so often on alternate kerbs, never in front of a door
export function lamps() {
  const out = [];
  let side = 1;
  for (let a = -70; a <= 62; a += 16) {
    const clear = (s) => SITES.every((b) => !b.line || b.side !== s || Math.abs(b.along - a) > 3.2);
    const s = clear(side) ? side : clear(-side) ? -side : 0;
    if (s) out.push({ at: S(a, s * (HERE.width / 2 - 0.9)), side: s, along: a });
    side = -side;
  }
  return out;
}

export const spawn = (() => {
  const [x, z] = S(-72, 0);
  return { at: [x, 0, z], yaw: yawFacing(HERE.axis) };
})();

export function exitFor(room) {
  const s = SITES.find((b) => b.room === room);
  if (!s) return null;
  return { at: s.back, yaw: yawFacing(s.out) };
}

// the Shack’s hill: a smooth mound, flat on top where the Shack stands
const HILL_AT = sub(SHACK.at);
export function floorAt(x, z) {
  const d = Math.hypot(x - HILL_AT[0], z - HILL_AT[1]) / SHACK.r;
  if (d >= 1.6) return 0;
  // (a plateau out to a third of its radius, then a long falling shoulder)
  const k = d <= 0.35 ? 1 : Math.max(0, 1 - (d - 0.35) / 1.25);
  return SHACK.hill * k * k * (3 - 2 * k);
}

// the land round the village: level where you walk, the Shack’s hill, and
// beyond the yards a valley’s sides rising toward the hills (drawn only)
export function streetFrame([x, z]) {
  const [ux, uz] = HERE.axis;
  return { along: x * ux + z * uz, across: -x * uz + z * ux };
}
export function terrainAt(x, z) {
  const f = streetFrame([x, z]);
  const out = Math.max(EDGE.a0 - 70 - f.along, f.along - EDGE.a1 - 10, EDGE.c0 - 8 - f.across, f.across - EDGE.c1 - 8, 0);
  // (the road runs on down to the station: the valley stays open along it)
  const road = f.along < EDGE.a0 ? Math.max(0, 1 - Math.abs(f.across) / 40) : 0;
  const k = Math.min(1, out / 140);
  const rise = k * k * (3 - 2 * k) * (22 + 9 * Math.sin(x * 0.013 + 1.3) + 7 * Math.sin(z * 0.017 + 0.4) + 4 * Math.sin((x + z) * 0.041)) * (1 - road * 0.8);
  return Math.max(floorAt(x, z), rise);
}

// the street-frame box’s outline as a run of circles, the station’s end left
// open for the road door (which takes you back before you reach the edge)
export function walls(step = 1.4, r = 0.8) {
  const out = [];
  const run = (a0, c0, a1, c1) => {
    const n = Math.max(1, Math.ceil(Math.hypot(a1 - a0, c1 - c0) / step));
    for (let i = 0; i <= n; i++) out.push({ at: S(a0 + ((a1 - a0) * i) / n, c0 + ((c1 - c0) * i) / n), r });
  };
  run(EDGE.a0, EDGE.c0, EDGE.a1, EDGE.c0);
  run(EDGE.a1, EDGE.c0, EDGE.a1, EDGE.c1);
  run(EDGE.a1, EDGE.c1, EDGE.a0, EDGE.c1);
  run(EDGE.a0, EDGE.c1, EDGE.a0, EDGE.c0);
  return out;
}

// what the walk goes round: every building as its box (turned to its yaw),
// the lamps, the arch’s two piers at the station’s end, the fence
export function colliders() {
  const out = [];
  for (const s of SITES) out.push({ kind: 'box', at: s.at, w: s.w + 0.2, d: s.d + 0.2, turn: s.yaw });
  for (const l of lamps()) out.push({ kind: 'circle', at: l.at, r: 0.22 });
  for (const c of [-1, 1]) out.push({ kind: 'circle', at: S(-76, c * 5.4), r: 0.55 });
  const [f0, f1] = SHACK.fence.map(sub);
  const n = Math.ceil(Math.hypot(f1[0] - f0[0], f1[1] - f0[1]) / 1.2);
  for (let i = 0; i <= n; i++) out.push({ kind: 'circle', at: [f0[0] + ((f1[0] - f0[0]) * i) / n, f0[1] + ((f1[1] - f0[1]) * i) / n], r: 0.5 });
  return out;
}

export const bounds = (() => {
  const cs = [S(EDGE.a0, EDGE.c0), S(EDGE.a1, EDGE.c0), S(EDGE.a1, EDGE.c1), S(EDGE.a0, EDGE.c1)];
  return { x0: Math.min(...cs.map((c) => c[0])), x1: Math.max(...cs.map((c) => c[0])), z0: Math.min(...cs.map((c) => c[1])), z1: Math.max(...cs.map((c) => c[1])) };
})();

// the checks’ named views: where the eye stands and where it looks (y up from the street)
const P = (along, across, y) => [...S(along, across)].flatMap((v, i) => (i === 0 ? [v, y] : [v]));
const facing = (id, back, up, y = 1.7, at = 3.6) => {
  const s = site(id);
  const eye = [s.door[0] + s.out[0] * back + HERE.axis[0] * up, y, s.door[1] + s.out[1] * back + HERE.axis[1] * up];
  return { at: eye, look: [s.at[0], at, s.at[1]] };
};
export const poses = {
  street: { at: P(-70, 1.2, 1.7), look: P(-10, -1, 4.2) },
  up: { at: P(10, -2, 1.7), look: P(60, 0, 4) },
  honeydukes: facing('honeydukes', 10.5, 6),
  broomsticks: facing('broomsticks', 10.5, 5),
  hogshead: facing('hogshead', 9, -4),
  shack: { at: P(-40, -27, 2.2), look: [...sub(SHACK.at)].flatMap((v, i) => (i === 0 ? [v, SHACK.hill + 3.5] : [v])) },
};
