// Minas Tirith, the land: the city of seven levels on the knee of Mount
// Mindolluin, each walled, each a little higher than the one below, with
// the great prow of rock thrust out east through all of them; the road
// winding up through the seven gates; the Citadel at the top, with the
// Court of the Fountain, the White Tree, the Tower of Ecthelion and the
// hall of the kings; the beacon on its ledge up the mountain; the Pelennor
// below, and far off along the White Mountains the beacons to Rohan.
// The hall of the kings, inside, is its own place (`zone` 'hall'); the rest
// is the city ('ride', 'court', 'beacon', 'walls'). ./scene.js draws them.
// No drawing here, so it can be tested on its own.
//
// The towns' conventions (../bree/layout.js): metres, +x east, +z south; a
// figure's `face` turns its +x to (cos face, -sin face), so π/2 is north.

import { pushOut, sightClear } from '../walker';

const TAU = Math.PI * 2;
const circle = (id, x, z, r, o = {}) => ({ id, kind: 'circle', x, z, r, ...o });
const box = (id, x, z, w, d, o = {}) => ({ id, kind: 'box', x, z, w, d, turn: 0, ...o });
const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
// the angle of (x, z) round the city's middle: 0 is east, π/2 south
export const angleOf = (x, z) => Math.atan2(z, x);
// a figure's `face` for going from (ax, az) towards (bx, bz)
export const faceTo = (ax, az, bx, bz) => Math.atan2(-(bz - az), bx - ax);

// ── the seven levels ──
// Wall k (k = 0, the outermost, to 6) runs round at radius WALL_R[k], from
// SPAN north of east to SPAN south of it, where the mountain closes it.
// Level k is the ground between wall k and wall k + 1, at LEVEL_Y[k]; the
// Citadel (level 6) is the whole round inside wall 6. Each wall stands on
// the level below it (the Pelennor, at 0, for the first) and is its own
// level's parapet above.
export const TIERS = 7;
export const WALL_R = [150, 128, 107, 87, 68, 50, 34];
export const LEVEL_Y = [10, 21, 32, 43, 54, 65, 76];
export const WALL_T = 3.2;
export const PARAPET = 1.6;
export const SPAN = 0.56 * Math.PI;
// the gates: the Great Gate east, then turn and turn about, north and south of the prow
export const GATE_A = [0, -0.42, 0.42, -0.42, 0.42, -0.42, 0.42];
export const GATE_W = 5.2;
const GATE_H = 7;
export const ROAD_W = 7;
// the road along level k runs round its middle
const ROAD_R = WALL_R.slice(0, 6).map((r, k) => (r + WALL_R[k + 1]) / 2);
// which level (x, z) is on: -1 outside the walls (or the mountain behind)
export function levelOf(x, z) {
  const r = Math.hypot(x, z);
  if (r <= WALL_R[6]) return 6;
  if (r > WALL_R[0] || Math.abs(angleOf(x, z)) > SPAN) return -1;
  for (let k = 5; k >= 0; k--) if (r <= WALL_R[k]) return k;
  return -1;
}

// ── the prow ──
// The great bastion of rock running east from the Citadel through every
// level, its top level with the Citadel's court; the road on each level
// goes through it in a tunnel.
export const PROW = { x0: WALL_R[6] - 4, x1: WALL_R[1] + 2, w: 10, y: LEVEL_Y[6] };
export const TUNNELS = [1, 2, 3, 4, 5].map((k) => ({ k, x: ROAD_R[k], y: LEVEL_Y[k], w: 8, h: 8 }));
export const inProw = (x, z, m = 0) => x >= PROW.x0 - m && x <= PROW.x1 + m && Math.abs(z) <= PROW.w / 2 + m;

// ── the road up ──
// From the Pelennor up the causeway to the Great Gate, round each level to
// the next gate (climbing the last stretch to it), and so up to the
// Citadel. Built as straight runs and arcs a metre apart, its corners
// rounded, then measured: `s` is metres along it.
const RAMP_ARC = 20;
const STEP = 1;
function rawRoad() {
  const pts = [];
  const line = (a, b) => {
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / STEP));
    for (let i = pts.length ? 1 : 0; i <= n; i++) {
      const k = i / n;
      pts.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]);
    }
  };
  // the causeway: flat across the field, then up to the gate's sill
  line([236, 0, 0], [196, 0, 0]);
  line([196, 0, 0], [WALL_R[0] + 1, LEVEL_Y[0], 0]);
  line([WALL_R[0] + 1, LEVEL_Y[0], 0], [ROAD_R[0], LEVEL_Y[0], 0]);
  for (let k = 0; k < 6; k++) {
    const r = ROAD_R[k];
    const a0 = GATE_A[k];
    const a1 = GATE_A[k + 1];
    const arc = Math.abs(a1 - a0) * r;
    // the climb starts on the arc, after the prow (it's in the arc's middle)
    const ramp = Math.min(RAMP_ARC, arc / 2 - 6);
    const inner = WALL_R[k + 1] - WALL_T;
    const climb = ramp + (r - inner);
    const y0 = LEVEL_Y[k];
    const y1 = LEVEL_Y[k + 1];
    const n = Math.max(2, Math.round(arc / STEP));
    for (let i = 1; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const left = arc - (arc * i) / n;
      const y = left < ramp ? y0 + (y1 - y0) * ((ramp - left) / climb) : y0;
      const [x, z] = polar(r, a);
      pts.push([x, y, z]);
    }
    // in through the gate, the last of the climb, then on to the next road
    const [gx, gz] = polar(inner, a1);
    const yGate = y1;
    const prev = pts[pts.length - 1];
    line(prev, [gx, yGate, gz]);
    if (k < 5) {
      const [nx, nz] = polar(ROAD_R[k + 1], a1);
      line([gx, yGate, gz], [nx, yGate, nz]);
    } else {
      const [nx, nz] = polar(24, a1);
      line([gx, yGate, gz], [nx, yGate, nz]);
    }
  }
  return pts;
}
// round the corners: a few passes of a running mean over x and z, the ends held
function rounded(pts, passes = 4, w = 3) {
  let cur = pts.map((p) => [...p]);
  for (let p = 0; p < passes; p++) {
    const next = cur.map((q) => [...q]);
    for (let i = w; i < cur.length - w; i++) {
      let sx = 0;
      let sz = 0;
      for (let j = -w; j <= w; j++) {
        sx += cur[i + j][0];
        sz += cur[i + j][2];
      }
      next[i][0] = sx / (2 * w + 1);
      next[i][2] = sz / (2 * w + 1);
    }
    cur = next;
  }
  return cur;
}
export const ROAD = (() => {
  const pts = rounded(rawRoad());
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  return { pts, s, len: s[s.length - 1] };
})();
export const ROAD_LEN = ROAD.len;
// the road `s` metres along: where, and which way it's going
export function roadAt(s) {
  const { pts, s: ss } = ROAD;
  const v = Math.max(0, Math.min(ROAD.len, s));
  let lo = 0;
  let hi = ss.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ss[mid] <= v) lo = mid;
    else hi = mid;
  }
  const k = ss[hi] > ss[lo] ? (v - ss[lo]) / (ss[hi] - ss[lo]) : 0;
  const a = pts[lo];
  const b = pts[hi];
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const d = Math.hypot(dx, dz) || 1;
  return { x: a[0] + dx * k, y: a[1] + (b[1] - a[1]) * k, z: a[2] + dz * k, dx: dx / d, dz: dz / d, face: Math.atan2(-dz, dx) };
}
// a point beside the road: `side` metres to the right of it (left is minus)
export function besideRoad(s, side) {
  const p = roadAt(s);
  // the right of a heading (dx, dz) is (-dz, dx)
  return { ...p, x: p.x - p.dz * side, z: p.z + p.dx * side };
}
// how near (x, z) comes to the road, in metres (and where along it)
export function roadNear(x, z) {
  const { pts, s } = ROAD;
  let best = Infinity;
  let at = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const d = Math.hypot(pts[i][0] - x, pts[i][2] - z);
    if (d < best) {
      best = d;
      at = s[i];
    }
  }
  return { d: best, s: at };
}
// where the road goes through each gate (the Great Gate is 0)
export const GATES = GATE_A.map((a, k) => {
  const [x, z] = polar(WALL_R[k], a);
  const { s } = roadNear(x, z);
  const p = roadAt(s);
  return { k, a, x, z, s, sill: p.y, top: p.y + GATE_H };
});
// The stretches of road where things can be in the way: the level parts of
// the arcs, away from the gates, the climbs and the tunnels. [s0, s1] each.
export const SLOTS = (() => {
  const out = [];
  let from = null;
  const { pts, s } = ROAD;
  for (let i = 0; i < pts.length; i++) {
    const [x, y, z] = pts[i];
    const r = Math.hypot(x, z);
    const k = ROAD_R.findIndex((rr) => Math.abs(rr - r) < 0.4);
    const ok = k >= 0 && Math.abs(y - LEVEL_Y[k]) < 0.01 && !inProw(x, z, 5) && GATES.every((g) => Math.abs(g.s - s[i]) > 12);
    if (ok && from == null) from = s[i];
    if ((!ok || i === pts.length - 1) && from != null) {
      if (s[i] - from > 8) out.push([from + 2, s[i] - 2]);
      from = null;
    }
  }
  return out;
})();

// ── the houses ──
// Rows of tall white houses, two to a level: one against the wall the level
// stands behind, one under the wall of the level above, fronts to the
// street. Seeded, so they're always the same. { x, z, y, w, d, h, face, k }.
export function seeded(seed = 1) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
// the city's trebuchets, on the first level by the Great Gate, south of the road
export const TREBUCHETS = [0.11, 0.2, 0.29].map((a) => {
  const [x, z] = polar(ROAD_R[0] + 1, a);
  // (throwing out, east, over the wall)
  return { x, z, face: -a };
});
export const HOUSES = (() => {
  const rand = seeded(4111);
  const out = [];
  for (let k = 0; k < 6; k++) {
    const rows = [
      { r: (d) => WALL_R[k] - WALL_T - d / 2 - 0.3, out: false },
      { r: (d) => WALL_R[k + 1] + d / 2 + 0.6, out: true },
    ];
    for (const row of rows) {
      let a = -SPAN + 0.04;
      while (a < SPAN - 0.04) {
        const w = 5 + rand() * 3.4;
        const d = 4.4 + rand() * 1.2;
        const r = row.r(d);
        const gap = 0.5 + rand() * 1.4;
        const mid = a + w / 2 / r;
        a += (w + gap) / r;
        if (mid > SPAN - 0.05) break;
        const [x, z] = polar(r, mid);
        const clear = ROAD_W / 2 + d / 2 + 0.6;
        if (roadNear(x, z).d < clear) continue;
        if (inProw(x, z, 2 + w / 2)) continue;
        if (k === 0 && TREBUCHETS.some((t) => Math.hypot(t.x - x, t.z - z) < 8.5)) continue;
        const h = 5 + rand() * 4.6 + (rand() < 0.25 ? 3 : 0);
        out.push({ x, z, y: LEVEL_Y[k], w, d, h, face: row.out ? -mid : Math.PI - mid, k });
      }
    }
  }
  return out;
})();

// ── the Citadel ──
// The round at the top, level with the prow: the hall of the kings (and
// the Tower of Ecthelion rising from its west end) with its doors to the
// east, the Court of the Fountain before them, the White Tree on its lawn
// with the guards round it, the fountain beyond, and the prow running out
// east to its point, over the Pelennor.
export const COURT_Y = LEVEL_Y[6];
export const HALL_HOUSE = { x0: -30, x1: -8, z0: -10, z1: 10, h: 16 };
export const TOWER = { x: -24, z: 0, r: 4.6, h: 66 };
export const TREE = { x: 9, z: 0, r: 3.8, lawn: 3.4 };
export const FOUNTAIN = { x: 19, z: 0, r: 2.4 };
// the four Guards of the Citadel at the corners of the lawn, facing out
export const GUARDS = [
  [4, -4.5],
  [4, 4.5],
  [14, -4.5],
  [14, 4.5],
].map(([x, z]) => ({ x, z, face: faceTo(TREE.x, TREE.z, x, z) }));
export const BEREGOND = { x: 13, z: 8.6, face: Math.PI / 2, r: 3.2 };
export const HALL_DOOR = { x: -6.4, z: 0, r: 2.8 };
export const OVERLOOK = { x: PROW.x1 - 3.4, z: 0, r: 3.4 };
const PROW_WALK = { x0: WALL_R[6] - 3, x1: PROW.x1 - 1.4, w: PROW.w - 2 };
// where the road comes into the Citadel, facing the tree
export const COURT_IN = (() => {
  const p = roadAt(ROAD_LEN);
  return { x: p.x, z: p.z, face: faceTo(p.x, p.z, TREE.x, TREE.z) };
})();
// at the crowning: the King before the tree, and the friends either side of the way to him
export const ARAGORN = { x: 4.4, z: 0, face: 0, r: 3.6 };
export const FRIENDS = [
  { id: 'gandalf', x: 6.4, z: -3.4 },
  { id: 'frodo', x: 9.4, z: -3.4 },
  { id: 'sam', x: 11.6, z: -3.4 },
  { id: 'merry', x: 9.4, z: 3.4 },
  { id: 'legolas', x: 6.4, z: 3.4 },
  { id: 'gimli', x: 11.6, z: 3.6 },
].map((f) => ({ ...f, face: faceTo(f.x, f.z, f.x, 0) }));

export const onCourt = (x, z, m = 0) => Math.hypot(x, z) <= WALL_R[6] - 1.2 - m || (x >= PROW_WALK.x0 && x <= PROW_WALK.x1 - m && Math.abs(z) <= PROW_WALK.w / 2 - m);
export const COURT_COLLIDERS = [
  box('hall', (HALL_HOUSE.x0 + HALL_HOUSE.x1) / 2, 0, HALL_HOUSE.x1 - HALL_HOUSE.x0, HALL_HOUSE.z1 - HALL_HOUSE.z0, { top: HALL_HOUSE.h }),
  circle('tree', TREE.x, TREE.z, TREE.lawn, { top: 0.6, low: true }),
  circle('fountain', FOUNTAIN.x, FOUNTAIN.z, FOUNTAIN.r, { top: 0.9, low: true }),
  ...GUARDS.map((g, i) => circle(`guard${i}`, g.x, g.z, 0.42, { top: 1.9 })),
  circle('beregond', BEREGOND.x, BEREGOND.z, 0.42, { top: 1.9 }),
];
// at the crowning the guards stand back, and the King and the friends are there
export const CROWN_COLLIDERS = [...COURT_COLLIDERS.filter((c) => c.id !== 'beregond'), circle('aragorn', ARAGORN.x, ARAGORN.z, 0.45, { top: 2 }), ...FRIENDS.map((f) => circle(f.id, f.x, f.z, 0.4, { top: 1.6 }))];

// ── the hall of the kings ──
// Long and high, its floor black and white, pillars of black marble down
// both sides and between them the kings of old in stone; at the far (north)
// end the empty throne up its steps, and at their foot the Steward's plain
// black chair. Its own place, its doors at the south end.
export const HALL = { w: 17, z0: -28, z1: 26, h: 20 };
export const COLUMNS = Array.from({ length: 8 }, (_, i) => -20 + i * 6).flatMap((z) => [
  [-6, z],
  [6, z],
]);
export const STATUES = Array.from({ length: 7 }, (_, i) => -17 + i * 6).flatMap((z) => [
  [-7.6, z],
  [7.6, z],
]);
export const THRONE = { x: 0, z: -26.2 };
export const DAIS = { x: 0, z: -25.4, w: 6, d: 4, steps: 4, h: 1.6 };
export const CHAIR = { x: 0, z: -22.4 };
export const DENETHOR = { x: 0, z: -22.3, face: -Math.PI / 2, r: 4.4 };
export const TOMATOES = { x: 2.7, z: -21.2, r: 1.5 };
export const HALL_IN = { x: 0, z: 22.6, face: Math.PI / 2 };
export const HALL_EXIT = { x: 0, z: 24.6, r: 1.8 };
export const HALL_WALLS = [
  [-HALL.w / 2, HALL.z0, HALL.w / 2, HALL.z0, 0.3],
  [-HALL.w / 2, HALL.z0, -HALL.w / 2, HALL.z1, 0.3],
  [HALL.w / 2, HALL.z0, HALL.w / 2, HALL.z1, 0.3],
  [-HALL.w / 2, HALL.z1, HALL.w / 2, HALL.z1, 0.3],
];
export const HALL_COLLIDERS = [
  ...COLUMNS.map(([x, z], i) => circle(`column${i}`, x, z, 0.75, { top: HALL.h })),
  ...STATUES.map(([x, z], i) => box(`statue${i}`, x, z, 1.4, 1.4, { top: 4.5 })),
  box('dais', DAIS.x, DAIS.z, DAIS.w, DAIS.d, { top: DAIS.h, low: true }),
  circle('chair', CHAIR.x, CHAIR.z, 0.6, { top: 1.8 }),
  circle('tomatoes', TOMATOES.x, TOMATOES.z, 0.45, { top: 0.8, low: true }),
];
export const inHall = (x, z, m = 0) => Math.abs(x) <= HALL.w / 2 - m && z >= HALL.z0 + m && z <= HALL.z1 - m;
export const clearView = (ax, az, bx, bz) => sightClear(ax, az, bx, bz, HALL_COLLIDERS.filter((c) => c.id.startsWith('column')), HALL_WALLS);

// ── the beacon ──
// On a ledge high on the mountain behind the Citadel, north-west of the
// tower: the path along it from the south, rocks to crouch behind, the
// great pile of wood near its end, and the guard on his stool beyond it,
// at his supper. `s` is metres along the ledge, from its south end.
export const LEDGE = { x: -44, y: COURT_Y + 18, z0: -14, len: 27, w: 3.2 };
export const ledgeAt = (s) => [LEDGE.x, LEDGE.y, LEDGE.z0 - Math.max(0, Math.min(LEDGE.len, s))];
export const COVERS = [5.5, 11.5, 17].map((s) => ({ s, r: 1.1 }));
export const PILE = { s: 22.6, top: 4.2 };
export const WATCH = { s: 26.4 };
export const inCover = (s) => COVERS.some((c) => Math.abs(s - c.s) <= c.r);
// the chain of beacons along the White Mountains, away north-west to Rohan:
// Amon Dîn, Eilenach, Nardol, Erelas, Min-Rimmon, Calenhad, Halifirien
export const BEACONS = [
  ['Amon Dîn', -230, -380, 170],
  ['Eilenach', -560, -620, 230],
  ['Nardol', -900, -800, 250],
  ['Erelas', -1250, -930, 220],
  ['Min-Rimmon', -1600, -1040, 260],
  ['Calenhad', -1950, -1130, 230],
  ['Halifirien', -2300, -1200, 250],
].map(([name, x, z, h]) => ({ name, x, z, h }));

// ── the siege ──
// On the first wall, south of the Great Gate, by the trebuchets: the
// Pelennor in front, and the siege-towers coming over it. A tower `d`
// metres out is at x = WALL_R[0] + 4 + d, in its own lane.
export const SIEGE_AT = (() => {
  const a = 0.37;
  const [x, z] = polar(WALL_R[0] - WALL_T / 2, a);
  return { x, z, y: LEVEL_Y[0], face: 0 };
})();
export const LANES = [-46, -14, 18, 50, 82];
export const towerX = (d) => WALL_R[0] + 4 + Math.max(0, d);
// the host, encamped and coming on across the field
export const HOST = { x0: 330, x1: 560, z0: -220, z1: 240 };

// A saved spot, if it's fair (only the court and the hall are saved).
export function validAt(saved, zone) {
  const start = zone === 'hall' ? HALL_IN : COURT_IN;
  const back = { zone, ...start };
  if (!saved || saved.zone !== zone || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) return back;
  const colliders = zone === 'hall' ? HALL_COLLIDERS : COURT_COLLIDERS;
  const walls = zone === 'hall' ? HALL_WALLS : [];
  if (zone === 'hall' ? !inHall(saved.x, saved.z, 0.4) : !onCourt(saved.x, saved.z, 0.2)) return back;
  const [x, z] = pushOut(saved.x, saved.z, 0.4, colliders, walls);
  if (Math.hypot(x - saved.x, z - saved.z) > 0.05) return back;
  return { zone, x: saved.x, z: saved.z, face: Number.isFinite(saved.face) ? saved.face : start.face };
}

export { TAU };
