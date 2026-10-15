// Weathertop, the land: the hill of Amon Sûl with its crown of crags and
// the broken ring of the watchtower on top, the old stair, the dell where
// the hobbits camp, the heath round the foot, and the road to the Ford of
// Bruinen. No drawing (./scene.js draws it, ./WeathertopWorld.jsx drives
// it), so it can be tested on its own.
//
// The towns' conventions (../bree/layout.js): metres, +x east, +z south,
// a figure's `face` turns its +x to (cos face, -sin face).

import { fbm, makeNoise, smooth } from '../../../../lib/paint';
import { pushOut } from '../walker';

// The disc you can walk in, and how far the land goes on past it.
export const WORLD = { radius: 60, edge: 110 };
// The hill: a flat top at `top`, its rim at `plateau`, a crown of crags from
// `crag[0]` to `crag[1]` the stair is the only way through, and long
// slopes down to the heath at `foot`.
export const HILL = { top: 22, plateau: 11.4, crag: [12.2, 17.6], ledge: 14, foot: 46 };
const at = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];

// The watchtower of Amon Sûl: a ring of broken walls round the summit.
// Angles in the ground's plane, a point at (cos a·r, sin a·r). `walls` are
// [from, to, height]; an arch stands over each gap in `arches`; `fallen`
// are tumbled blocks [x, z, turn, size]. The way in from the stair is the
// wide gap to the south-west.
export const RUIN = {
  r: 9.5,
  thick: 0.95,
  walls: [
    [-2.9, -2.1, 3.2],
    [-1.85, -1.0, 4.6],
    [-0.75, 0.15, 2.4],
    [0.4, 1.2, 3.8],
    [1.45, 2.0, 1.6],
    [2.75, 3.15, 2.8],
  ],
  arches: [-1.975, -0.875, 1.325],
  fallen: [
    [3.2, -5.5, 0.4, 1.1],
    [-6.4, 2.1, 1.2, 0.9],
    [12.4, 3.0, 2.0, 1.3],
    [-2.0, -12.6, 0.7, 1.0],
    [5.6, 11.2, 2.6, 0.8],
    [-11.8, -4.6, 1.9, 1.2],
  ],
  // the broken plinth in the middle
  plinth: { x: 0, z: 0, r: 0.75 },
};
// the gaps in the ring, where the Nazgûl come in: the arches, the breach
// to the east, the stair's way in, and the narrow gap to the west
export const GAPS = [-1.975, -0.875, 0.275, 1.325, 2.375, 3.267];

// The old stair, from the road at the hill's foot up round the south-west
// and through the crags to the summit: [angle, radius, height or null to
// follow the land].
const STAIR_AT = [
  [2.369, 57.3, null],
  [2.4, 50, null],
  [2.34, 43, null],
  [2.22, 35, null],
  [2.08, 26, null],
  [1.98, 19.4, null],
  [2.16, 17.4, 15],
  [2.36, 15.4, 17.4],
  [2.56, 13.6, 19.8],
  [2.66, 11.6, 21.8],
  [2.55, 9.6, HILL.top],
  [2.42, 8, HILL.top],
];
export const STAIR_W = 2.4;

// The dell on the hill's western shoulder, where the hobbits make camp.
export const DELL = { x: -24, z: -3.5, r: 5.6 };

// ── the lie of the land ──

const noise = makeNoise(71);
const noise2 = makeNoise(23);

// the hill's height by how far out from the middle
function core(r) {
  const { top, plateau, crag, ledge, foot } = HILL;
  if (r < crag[0]) return top - 0.4 * smooth(plateau - 1, crag[0], r);
  if (r < crag[1]) return top - 0.4 - (top - 0.4 - ledge) * smooth(crag[0], crag[1], r);
  if (r < foot) return ledge * Math.pow(1 - (r - crag[1]) / (foot - crag[1]), 1.6);
  return 0;
}
// the land before the stair is cut: the hill, rough on its slopes and flat
// on top, and the heath rolling out to the rim, rising into the dark
function land(x, z) {
  const r = Math.hypot(x, z);
  let h = core(r);
  const rough = smooth(HILL.plateau, HILL.crag[0] + 2, r);
  h += (fbm(noise, x * 0.05 + 3, z * 0.05 - 7, { octaves: 3 }) - 0.5) * 2.2 * rough;
  h += smooth(HILL.foot + 6, WORLD.edge, r) * (8 + fbm(noise2, x * 0.03, z * 0.03, { octaves: 3 }) * 14);
  // the dell: a grassy hollow cut into the shoulder
  const d = Math.hypot(x - DELL.x, z - DELL.z);
  if (d < DELL.r * 1.8) h += (dellY - h) * (1 - smooth(DELL.r * 0.7, DELL.r * 1.8, d));
  return h;
}
const dellY = core(Math.hypot(DELL.x, DELL.z)) - 0.9;

// the stair's points, in the world, with their heights
export const STAIR = STAIR_AT.map(([a, r, y]) => {
  const [x, z] = at(a, r);
  return [x, z, y ?? land(x, z)];
});
// the nearest point on the stair: how far, its height there, and how far up
// the stair it is (0 at the foot, 1 at the top)
export function stairNear(x, z) {
  let best = { d: Infinity, y: 0, k: 0 };
  let run = 0;
  const total = STAIR.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - STAIR[i][0], p[1] - STAIR[i][1]), 0);
  for (let i = 1; i < STAIR.length; i++) {
    const [ax, az, ay] = STAIR[i - 1];
    const [bx, bz, by] = STAIR[i];
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (len * len)));
    const d = Math.hypot(x - (ax + t * dx), z - (az + t * dz));
    if (d < best.d) best = { d, y: ay + (by - ay) * t, k: (run + t * len) / total };
    run += len;
  }
  return best;
}

export function height(x, z) {
  const h = land(x, z);
  // the stair's cut: level across, at the stair's own height
  const s = stairNear(x, z);
  const k = 1 - smooth(STAIR_W / 2, STAIR_W / 2 + 2.4, s.d);
  return k > 0 ? h + (s.y - h) * k : h;
}
export const groundY = height;

// The road east: along the hill's southern foot, from the west rim to the
// east, and the stair's track up from it. [x, z] points.
export const ROAD = [[-48, 34], [-34, 46], [-14, 52.5], [10, 52.5], [30, 46], [44, 39]];
export const onRoad = (x, z) => {
  for (let i = 1; i < ROAD.length; i++) if (toSeg(x, z, ROAD[i - 1], ROAD[i]) < 2.4) return true;
  return false;
};
function toSeg(x, z, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (a[0] + t * dx), z - (a[1] + t * dz));
}
// 1 on the road or the stair, fading off them (for painting the ground)
export function pathAmount(x, z) {
  let best = 0;
  for (let i = 1; i < ROAD.length; i++) best = Math.max(best, 1 - smooth(1.4, 3.2, toSeg(x, z, ROAD[i - 1], ROAD[i])));
  const s = stairNear(x, z);
  return Math.max(best, 1 - smooth(STAIR_W * 0.3, STAIR_W * 0.7, s.d));
}

// ── what stands about ──

// the three stone trolls, in a clearing to the north-east
export const TROLLS = { x: 31, z: -38, turn: 2.3, r: 3.4 };
// dead trees on the heath: [x, z, size]
export const TREES = [
  [-42, 12, 1.1],
  [-38, -26, 0.9],
  [-18, -44, 1.2],
  [16, -47, 1],
  [44, -14, 1.15],
  [48, 12, 0.95],
  [26, 33, 1.05],
  [-6, 38.5, 0.9],
  [-50, -8, 1],
  [8, -52, 0.85],
];
// boulders on the slopes and the heath: [x, z, size]
export const ROCKS = [
  [-30, 22, 1.4],
  [-15, 30, 1.1],
  [12, 28, 1.6],
  [30, 14, 1.2],
  [33, -10, 1.5],
  [20, -30, 1.3],
  [-8, -30, 1.1],
  [-32, -18, 1.2],
  [40, 26, 1],
  [-44, 26, 1.3],
  [50, -30, 1.4],
  [-26, -40, 1.6],
];
// The crags round the crown, as rocks along the ring, but for the stair's
// way through: [x, z, size, seed]
export const CRAGS = (() => {
  const out = [];
  const mid = (HILL.crag[0] + HILL.crag[1]) / 2;
  const n = 34;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.sin(i * 2.3) * 0.05;
    const [x, z] = at(a, mid + Math.sin(i * 1.7) * 0.9);
    if (stairNear(x, z).d < STAIR_W + 1.6) continue;
    out.push([x, z, 2.3 + ((i * 7) % 5) * 0.32, i]);
  }
  return out;
})();
// The camp in the dell: the fire, and the five places it burns once Sam's
// cooking has caught (the fire itself, the pan, a log rolled out, the
// grass, a blanket's corner).
export const FIRE_AT = { x: DELL.x + 0.6, z: DELL.z + 0.4 };
export const PATCHES = [
  { id: 'fire', x: FIRE_AT.x, z: FIRE_AT.z },
  { id: 'pan', x: FIRE_AT.x + 1.5, z: FIRE_AT.z + 0.9 },
  { id: 'log', x: FIRE_AT.x - 1.6, z: FIRE_AT.z + 1.1 },
  { id: 'grass', x: FIRE_AT.x + 0.5, z: FIRE_AT.z - 1.8 },
  { id: 'blanket', x: FIRE_AT.x - 1.4, z: FIRE_AT.z - 1.5 },
];
// the kingsfoil, and the weeds that look like it, round the hill's foot
export const PLANTS = [
  { id: 'a1', x: -40, z: 30, athelas: true },
  { id: 'w1', x: -27, z: 40, athelas: false },
  { id: 'w2', x: -46, z: 18, athelas: false },
  { id: 'a2', x: -50, z: -12, athelas: true },
  { id: 'w3', x: -36, z: -30, athelas: false },
  { id: 'w4', x: 4, z: 41, athelas: false },
  { id: 'a3', x: 22, z: 40.5, athelas: true },
  { id: 'w5', x: 38, z: 24, athelas: false },
  { id: 'w6', x: -12, z: 44, athelas: false },
];

// ── what's in the way ──

const circle = (id, x, z, r, o = {}) => ({ id, kind: 'circle', x, z, r, ...o });

export const COLLIDERS = [
  circle('trolls', TROLLS.x, TROLLS.z, TROLLS.r, { top: 5 }),
  ...TREES.map(([x, z, s], i) => circle(`tree${i}`, x, z, 0.4 * s, { top: 6 })),
  ...ROCKS.map(([x, z, s], i) => circle(`rock${i}`, x, z, 0.8 * s, { low: true, top: 1.4 * s })),
  ...RUIN.fallen.map(([x, z, , s], i) => circle(`block${i}`, x, z, 0.75 * s, { low: true, top: 1.2 * s })),
  circle('plinth', RUIN.plinth.x, RUIN.plinth.z, RUIN.plinth.r, { low: true, top: 1.2 }),
  // the arches' pillars, either side of each gap
  ...RUIN.arches.flatMap((a) => {
    const g = 0.125;
    return [a - g, a + g].map((b, i) => circle(`arch${a}-${i}`, ...at(b, RUIN.r), 0.62, { top: 5.6 }));
  }),
];

// Walls, [x0, z0, x1, z1, thick, low]: the ruin's walls as short chords
// round their arcs, and the crags all round but where the stair goes up.
function arc(a0, a1, r, thick) {
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / 2));
  const out = [];
  for (let i = 0; i < n; i++) {
    const [x0, z0] = at(a0 + ((a1 - a0) * i) / n, r);
    const [x1, z1] = at(a0 + ((a1 - a0) * (i + 1)) / n, r);
    out.push([x0, z0, x1, z1, thick]);
  }
  return out;
}
const RUIN_WALLS = RUIN.walls.flatMap(([a0, a1]) => arc(a0, a1, RUIN.r, RUIN.thick / 2));
// the stair's way through the crags, as the angles it's open between
const CLEFT = [1.98, 2.78];
const CRAG_R = (HILL.crag[0] + HILL.crag[1]) / 2;
const CRAG_WALLS = arc(CLEFT[1], CLEFT[0] + Math.PI * 2, CRAG_R, 1.1);
export const WALLS = [...RUIN_WALLS, ...CRAG_WALLS];

// ── the places to stop ──

// you come up the road from the west with Strider, at dusk
export const START = { x: -40, z: 39.5, face: 0.78 };
export const SPOTS = [
  { id: 'summit', x: -2.4, z: 2.2, r: 2.8 },
  { id: 'camp', x: DELL.x + 2.6, z: DELL.z + 2.2, r: 2.6 },
  { id: 'wounded', x: -33.2, z: 35.8, r: 2.6 },
  { id: 'leave', x: 41, z: 40, r: 3.6 },
  // on the side: Gandalf's mark, scratched on the plinth's east face
  { id: 'mark', x: 1.55, z: 0.25, r: 1.3 },
];
export const spot = (id) => SPOTS.find((s) => s.id === id);
// where Frodo lies, wounded, at the stair's foot while Sam searches
export const WOUNDED = { x: -35.6, z: 34.6, face: 0.4 };
// where Sam starts the search, and where Asfaloth comes to
export const SAM_START = { x: -29.8, z: 38.6, face: 0.2 };
export const ARWEN_AT = { x: -25.5, z: 47.5, face: 2.23 };
// where Frodo stands with the brand on the summit, his back to the plinth
export const STAND = { x: -1.5, z: 1.2 };
// where he lies down to sleep in the dell, after the climb
export const BED = { x: DELL.x - 2.2, z: DELL.z - 1.6, face: 0.3 };

// Who's about, by the time ('dusk', 'night', 'dawn') and how far you've
// got (`while`: only while one of those quests is the next); what they say
// as you come by goes round in turn.
export const CAST = [
  { id: 'strider', name: 'Strider', x: 3.4, z: 3.8, face: -0.4, look: 'strider', when: ['dusk'], lines: ['This was once the great watchtower of Amon Sûl.', 'Come up. You can see the whole of the Weather Hills from here.'] },
  { id: 'merry-top', name: 'Merry Brandybuck', x: -4.6, z: -3.2, face: 0.6, look: 'merry', when: ['dusk'], lines: ['Six days in the wild, and he calls this a rest.', 'There’s nothing up here but stones.'] },
  { id: 'pippin-top', name: 'Pippin Took', x: 4.2, z: -4.6, face: 2.2, look: 'pippin', when: ['dusk'], lines: ['What about breakfast? Elevenses? Supper?', 'He knows about supper, doesn’t he?'] },
  { id: 'sam-top', name: 'Samwise Gamgee', x: -6.2, z: 4.8, face: -0.2, look: 'sam', when: ['dusk'], lines: ['I’ve brought the pans. Just in case.', 'Mr. Frodo, you look done in. Sit down a bit.'] },
  { id: 'sam', name: 'Samwise Gamgee', x: FIRE_AT.x + 1.4, z: FIRE_AT.z - 1.0, face: Math.PI, look: 'sam', when: ['night'], while: ['supper'], lines: ['Strider said to stay here. So we’re staying. With supper.', 'Mr. Frodo’s asleep. Let him rest; I’ll keep him some.'] },
  { id: 'merry', name: 'Merry Brandybuck', x: FIRE_AT.x - 2.5, z: FIRE_AT.z + 2.3, face: 0.4, look: 'merry', when: ['night'], while: ['supper'], lines: ['Strider’s gone off to have a look round. Said to keep close.', 'Nobody said anything about not having supper.'] },
  { id: 'pippin', name: 'Pippin Took', x: FIRE_AT.x + 0.4, z: FIRE_AT.z + 2.0, face: 1.4, look: 'pippin', when: ['night'], while: ['supper'], lines: ['Tomatoes, sausages, nice crispy bacon.', 'Is there any more? There’s always more.'] },
  { id: 'trolls', name: 'The stone trolls', x: TROLLS.x - 4.8, z: TROLLS.z + 2.6, face: 0, look: null, when: ['dusk', 'night', 'dawn'], lines: ['Three trolls, turned to stone. Mr. Bilbo told of these: they argued over their supper till the sun came up and caught them.', 'Moss on their noses, and a bird’s nest on one. They’ll not be getting up again.'] },
  { id: 'strider-foot', name: 'Strider', x: WOUNDED.x + 1.6, z: WOUNDED.z - 1.4, face: Math.PI * 0.7, look: 'strider', when: ['night'], while: ['athelas', 'ford'], lines: ['Sam! Do you know the athelas plant?', 'Kingsfoil. It may help to slow the poison. Hurry!'] },
  { id: 'merry-foot', name: 'Merry Brandybuck', x: WOUNDED.x - 1.5, z: WOUNDED.z + 0.6, face: 0, look: 'merry', when: ['night'], while: ['athelas', 'ford'], lines: ['He’s cold, Sam. He’s so cold.', 'Hurry!'] },
  { id: 'pippin-foot', name: 'Pippin Took', x: WOUNDED.x - 0.4, z: WOUNDED.z + 1.7, face: 1, look: 'pippin', when: ['night'], while: ['athelas', 'ford'], lines: ['Is he going to be all right?', 'Find it, Sam. Please.'] },
  { id: 'strider-dawn', name: 'Strider', x: 38.4, z: 38.6, face: Math.PI, look: 'strider', when: ['dawn'], lines: ['Frodo is in Rivendell, in Elrond’s care. The road goes on.', 'Rivendell is not far now. Come.'] },
];
export const castFor = (sky, next = null) => CAST.filter((c) => (!c.when || c.when.includes(sky)) && (!c.while || c.while.includes(next)));

// A saved spot, if it's still a fair one: never inside anything, never on
// the summit before you've climbed (the climb's the quest), and back at
// the road's start if it was anywhere strange.
export function validAt(saved, done = []) {
  if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) return START;
  if (!done.includes('climb')) return START;
  if (Math.hypot(saved.x, saved.z) > WORLD.radius - 0.5) return START;
  const [x, z] = pushOut(saved.x, saved.z, 0.4, COLLIDERS, WALLS);
  if (Math.hypot(x - saved.x, z - saved.z) > 0.05) return START;
  return { x: saved.x, z: saved.z, face: Number.isFinite(saved.face) ? saved.face : 0 };
}
