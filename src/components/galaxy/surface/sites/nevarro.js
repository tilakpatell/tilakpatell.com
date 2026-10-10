// Nevarro, from the ground (docs/superpowers/HANDOFF-nevarro-rebuild.md).
//
// Nevarro City as the show's artists built it: a town sunk into a shelf of
// black lava rock, its floor under the rock's top, the rock round it a
// natural wall with domes along its top. Greef Karga's cantina on a market
// square, rings of grey plaster houses with their backs to the rock, three
// ways out cut through it (the West Gate to the landing yard, the South
// Gate to the river, the North Lane to the Razor Crest), and steps down to
// the covert in the sewers. The Charon River comes out of its tunnel under
// the town and runs down to the lava flats, under one rock bridge; the
// Imperial base is built into the lip of a lava canyon on a plateau to the
// west; a watch hill stands over the town, and a volcano behind it all.
//
// The lava is a hazard: anyone who steps in is back at the landing (`fall`,
// just under its surface).

import { grove } from './stand';
import { sky, palette, hostile, troops } from './outerKit';

const { PI, cos, sin, hypot, atan2 } = Math;
const r1 = (v) => Math.round(v * 10) / 10;

// ── The numbers everything hangs off ──

// the lava's level, the beds dug for it (deep enough to read as lava on the
// coarse ground grid of phones and small windows, 8 m cells), and the height
// under which you've stepped in it
export const LAVA = -3;
const BED = LAVA - 5;
const FALL = LAVA - 0.3;
// the town: its frame (local -x points at the landing; the square in the
// middle), the floor of its bowl, how far the bowl goes
export const TOWN = { at: [148.8, -65.4], yaw: 0.42 };
export const FLOOR = 11;
export const BOWL = 76;
// the Imperial base (where the puck quest sends you) and the plateau it
// stands on; `n` is the way out over its canyon, `a` along the canyon
export const BASE = { at: [-260, 160], top: 30.5 };
const n = [0.852, -0.524];
const a = [0.524, 0.852];
const off = (p, s, t = 0) => [r1(p[0] + n[0] * s + a[0] * t), r1(p[1] + n[1] * s + a[1] * t)];
// the watch hill, behind the town from the landing
export const HILL = { at: [283.8, -217.8], r: 130, height: 28 };
// the volcano, straight behind the town and the hill from the landing
export const VOLCANO = [660, -380];
// the lava flats, where the river runs out into a basin of black crust
export const FLATS = [325, 245];

// a spot in the town's frame, in the world's
export const tw = ([x, z]) => [r1(TOWN.at[0] + x * cos(TOWN.yaw) + z * sin(TOWN.yaw)), r1(TOWN.at[1] - x * sin(TOWN.yaw) + z * cos(TOWN.yaw))];
const polar = (r, ang) => [r1(r * cos(ang)), r1(r * sin(ang))];
// a yaw that turns a thing's front (+z) toward the direction (dx, dz)
const facing = (dx, dz) => r1(atan2(dx, dz) * 100) / 100;

// a run of pits along a path [[x, z, r]…], down to `floor` (absolute), a pit
// every 1.35 r (their floors meet: each is flat out to 0.7 r); `gaps`:
// [from, to] metres down the path left undug (a rock bridge the lava runs under)
const run = (pts, floor, gaps = []) => {
  const pits = [];
  let s = 0;
  let next = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az, ar] = pts[i];
    const [bx, bz, br] = pts[i + 1];
    const len = hypot(bx - ax, bz - az);
    while (next <= s + len) {
      const t = (next - s) / len;
      const r = ar + (br - ar) * t;
      if (!gaps.some(([g0, g1]) => next >= g0 && next <= g1)) pits.push({ at: [r1(ax + (bx - ax) * t), r1(az + (bz - az) * t)], r: r1(r), floor });
      next += r * 1.35;
    }
    s += len;
  }
  return pits;
};

// ── The town's ways out: cuts through the rock at the floor's level, out
// to where the land outside is as low (local polar angle, half-width, how
// far out, the height they come out at, how many steps) ──
export const WAYS = {
  west: { ang: PI, w: 8, out: 120, h: 11.5, k: 3 }, // the West Gate: the landing yard
  south: { ang: PI / 2, w: 7, out: 120, h: 9.5, k: 4 }, // the South Gate: the river, the lava flats
  north: { ang: -1.95, w: 6, out: 120, h: 11, k: 4 }, // the North Lane: the Razor Crest
};
const cut = ({ ang, w, out, h, k }) =>
  Array.from({ length: k + 1 }, (_, i) => {
    const d = BOWL - 2 + ((out - BOWL + 2) * i) / k;
    return { at: tw(polar(d, ang)), r: w, edge: 4, h: r1(FLOOR + ((h - FLOOR) * i) / k) };
  });

// ── The town, in its own frame: x across (−x to the landing), z down (+z to
// the lava flats); each front (+z of its model) to the street it's on ──

// the frontage each kind takes along a street
const W = { nevarrorow: 22, nevarrohouse: 13, nevarrodomehouse: 11, nevarrotower: 9 };
// a ring of buildings at radius r between two angles, fronts in (to the
// middle) or out; the kinds in turn, `gap` metres apart, centred in the arc
const arcRow = (r, a0, a1, kinds, { out = false, gap = 3 } = {}) => {
  const total = kinds.reduce((s, k) => s + W[k], 0) + gap * (kinds.length - 1);
  let at = (a0 + a1) / 2 - total / r / 2;
  return kinds.map((k) => {
    const mid = at + W[k] / r / 2;
    at += (W[k] + gap) / r;
    const yaw = out ? facing(cos(mid), sin(mid)) : facing(-cos(mid), -sin(mid));
    return { kind: k, at: polar(r, mid), yaw };
  });
};
// (the half-angle a street of half-width w takes at radius r, and a bit)
const half = (w, r) => w / r + 0.04;
const { west: Wg, south: Sg, north: Ng } = WAYS;

// where the Charon River comes out of its tunnel, under the town's south-east rock
export const PORTAL = { local: polar(105, 1.1), ang: 1.1 };

// the covert's way down, off the ring lane between the North Lane and the
// new quarter: steps down a passage to a sunken floor, the sewer's mouth in
// its far wall
export const COVERT = { ang: -1.25, from: 50, to: 64, floor: FLOOR - 6 };
const COVERT_AT = polar(COVERT.to, COVERT.ang);

// the outer ring: backs to the rock, fronts in, on the ring lane
const RO = 66;
const OUTER = [
  // from the West Gate round to the North Lane (the old town)
  ...arcRow(RO, -PI + half(Wg.w, RO), Ng.ang - half(Ng.w, RO), ['nevarrorow', 'nevarrohouse', 'nevarrorow']),
  // from the covert round to the South Gate: the new quarter, its towers
  ...arcRow(RO, -0.95, Sg.ang - half(Sg.w, RO), ['nevarrohouse', 'nevarrodomehouse', 'nevarrotower', 'nevarrorow', 'nevarrotower', 'nevarrohouse', 'nevarrodomehouse']),
  // from the South Gate back round to the West Gate
  ...arcRow(RO, Sg.ang + half(Sg.w, RO), PI - half(Wg.w, RO), ['nevarrorow', 'nevarrohouse', 'nevarrodomehouse', 'nevarrorow']),
];
// the inner ring: fronts out onto the ring lane, round the square
const RI = 41;
const INNER = [
  ...arcRow(RI, -PI + half(Wg.w, RI), Ng.ang - half(Ng.w, RI), ['nevarrohouse', 'nevarrodomehouse'], { out: true }),
  ...arcRow(RI, Ng.ang + half(Ng.w, RI), -0.35, ['nevarrodomehouse', 'nevarrohouse', 'nevarrodomehouse'], { out: true }),
  ...arcRow(RI, 0.45, Sg.ang - half(Sg.w, RI), ['nevarrohouse', 'nevarrodomehouse'], { out: true }),
  ...arcRow(RI, Sg.ang + half(Sg.w, RI), PI - half(Wg.w, RI), ['nevarrodomehouse', 'nevarrohouse', 'nevarrohouse'], { out: true }),
];
// the rock's top round the bowl: domes at its level (the roofs of what's
// under the rock, as the show's model of the city has them; the dome is 7 m
// tall, sunk to show 3.5 to 4.5 m), and every third a dome house sunk to its
// dome; none over the ways out or the river's tunnel
const RIM = 87;
const clearOf = (ang) => [...Object.values(WAYS).map((w) => w.ang), PORTAL.ang].every((b) => Math.abs(atan2(sin(ang - b), cos(ang - b))) > 0.2);
const RIMDOMES = Array.from({ length: 24 }, (_, i) => -PI + (i + 0.5) * ((2 * PI) / 24))
  .filter(clearOf)
  .map((ang, i) => (i % 3 === 2 ? { kind: 'nevarrodomehouse', at: polar(RIM + 1, ang), yaw: facing(-cos(ang), -sin(ang)), sink: 2.6 } : { kind: 'nevarrodome', at: polar(RIM, ang), yaw: r1(ang * 3), scale: i % 2 ? 1 : 0.85, sink: 2.6 }));

// the cantina where Greef's zone door is (its world spot kept: [140, -90],
// turned 0.3), the square in front of it, a big dome house on its east side
export const CANTINA = { at: [2, -26.05], yaw: -0.12 };
const CORE = [
  { kind: 'nevarrocantina', at: CANTINA.at, yaw: CANTINA.yaw },
  { kind: 'nevarrodomehouse', at: [34, 3], yaw: -PI / 2, scale: 1.3 },
  // the market: stalls round the square's west and south sides and down
  // Gate Street (the bazaar by the way in), cargo
  { kind: 'stall', at: [-17, -8], yaw: PI / 2 },
  { kind: 'stall', at: [-17, 9], yaw: PI / 2 },
  { kind: 'stall', at: [-13, 15], yaw: PI },
  { kind: 'stall', at: [12, 15], yaw: PI },
  { kind: 'stall', at: [18, 9], yaw: -PI / 2 },
  { kind: 'stall', at: [-27, -6.8], yaw: 0 },
  { kind: 'stall', at: [-34, -6.8], yaw: 0 },
  { kind: 'stall', at: [-29, 6.8], yaw: PI },
  { kind: 'crates', at: [-12, -14] },
  { kind: 'crates', at: [16, -12], yaw: 0.8 },
  { kind: 'cratecube', at: [-14, 12], yaw: 0.4 },
  { kind: 'barrel', at: [-15.5, 12.8], yaw: 0.2 },
  { kind: 'barrel', at: [15.6, 13.6], yaw: 1.2 },
  { kind: 'vaporator', at: [24, -20] },
  { kind: 'speedertruck', at: [-24, -14], yaw: 0.3 },
];
// the covert: the passage down, a fire, the Armorer's forge, the sewer's mouth
const COVERT_THINGS = [
  { kind: 'charonportal', at: polar(COVERT.to + 8, COVERT.ang), yaw: facing(-cos(COVERT.ang), -sin(COVERT.ang)), scale: 0.6, abs: true, y: COVERT.floor - 0.3, solid: false },
  { kind: 'fire', at: polar(COVERT.to - 2, COVERT.ang + 0.08) },
  { kind: 'welderrack', at: polar(COVERT.to + 2, COVERT.ang - 0.1), yaw: facing(-cos(COVERT.ang), -sin(COVERT.ang)) },
  { kind: 'ammocan', at: polar(COVERT.to + 1, COVERT.ang - 0.14), yaw: 1.1 },
  { kind: 'empirecrate', at: polar(COVERT.to + 2, COVERT.ang + 0.13), yaw: 0.6 },
];
// the street lamps (dark posts): round the square, round the ring lane, out
// along the ways to the gates
const LAMP = { h: 5, light: '#ffb070', color: '#2a2828' };
const LAMPS = [
  [-20, -15],
  [20, -15],
  [-20, 17],
  [20, 17],
  ...[-2.6, -0.6, 1.0, 2.3].map((ang) => polar(54, ang)),
  ...[90, 116].map((d) => polar(d, Wg.ang + 0.08)),
  ...[90, 112].map((d) => polar(d, Sg.ang + 0.08)),
  polar(96, Ng.ang - 0.07),
].map((at) => ({ kind: 'lamp', at, opts: LAMP }));
// the gates, across their cuts at the rock's outer face: the second
// season's gate where the ships set down and again to the river, the first
// season's round arch by the Razor Crest (you walk through them: no solids)
const GATES = [
  { kind: 'nevarroarch', at: polar(104, Wg.ang), yaw: r1(-Wg.ang + PI / 2), sink: 0.2, solid: false },
  { kind: 'nevarroarch', at: polar(97, Sg.ang), yaw: r1(-Sg.ang + PI / 2), scale: 0.9, sink: 0.2, solid: false },
  { kind: 'nevarrogate', at: polar(97, Ng.ang), yaw: r1(-Ng.ang + PI / 2), sink: 0.6, solid: false },
];
// roof gear: vaporators up on every third roof of the outer ring (each
// kind's roof height a little behind its middle, measured off the models)
const ROOF = { nevarrorow: 7.9, nevarrohouse: 6.8, nevarrodomehouse: 5.1, nevarrotower: 15.5 };
const ROOFS = OUTER.filter((_, i) => i % 3 === 0).map((b, i) => ({ kind: 'vaporator', at: [r1(b.at[0] * 1.04), r1(b.at[1] * 1.04)], y: ROOF[b.kind], solid: false, yaw: i }));

export const TOWN_THINGS = [...CORE, ...OUTER, ...INNER, ...RIMDOMES, ...GATES, ...LAMPS, ...ROOFS, ...COVERT_THINGS];

// the steps down to the covert: pits down the passage, each a little lower,
// and the sunken floor at its end
const COVERT_PITS = [
  ...Array.from({ length: 6 }, (_, i) => {
    const d = COVERT.from + ((COVERT.to - COVERT.from) * i) / 6;
    return { at: polar(d, COVERT.ang), r: 4.5, floor: r1(FLOOR - ((FLOOR - COVERT.floor) * (i + 1)) / 7) };
  }),
  { at: COVERT_AT, r: 10, floor: COVERT.floor },
];

// ── The Charon River: out of its tunnel under the town's south-east rock,
// down to the lava flats, under one rock bridge on the way ──
const P0 = tw(PORTAL.local);
export const RIVER = [[...P0, 7], [r1(P0[0] + 4), r1(P0[1] + 20), 7.5], [242, 48, 8], [250, 80, 8.5], [256, 112, 9], [268, 146, 9.5], [284, 180, 10], [300, 212, 10]];
// (where the bridge is, in metres down the river from the tunnel)
export const BRIDGES = [[90, 124]];
export const RIVERPITS = run(RIVER, BED, BRIDGES);
// (the way the river leaves its tunnel: the mouth faces down it, the
// keelboat lies along it)
const DOWN = (() => {
  const dx = RIVER[1][0] - RIVER[0][0];
  const dz = RIVER[1][1] - RIVER[0][1];
  const d = hypot(dx, dz);
  return [dx / d, dz / d];
})();
const along = (m) => [r1(P0[0] + DOWN[0] * m), r1(P0[1] + DOWN[1] * m)];
// (the first pit past the bridge: a second tunnel mouth stands in its upstream end)
const pastBridge = (() => {
  const i = RIVERPITS.findIndex((p, j) => j > 0 && hypot(p.at[0] - RIVERPITS[j - 1].at[0], p.at[1] - RIVERPITS[j - 1].at[1]) > p.r * 2);
  const [p, q] = [RIVERPITS[i], RIVERPITS[i + 1]];
  const d = hypot(q.at[0] - p.at[0], q.at[1] - p.at[1]);
  const u = [(q.at[0] - p.at[0]) / d, (q.at[1] - p.at[1]) / d];
  return { at: [r1(p.at[0] - u[0] * p.r * 0.55), r1(p.at[1] - u[1] * p.r * 0.55)], yaw: facing(...u), down: u };
})();

// ── The Imperial base's canyon: a lava trench along the plateau's
// south-east lip ──
const C0 = off(BASE.at, 70);
export const CANYON = run(
  [
    [...off(C0, 0, -110), 18],
    [...off(C0, 0, -60), 22],
    [...off(C0, 0, 40), 22],
    [...off(C0, 0, 78), 16],
  ],
  BED,
);
// the way up to it: round the canyon's north end and up the plateau's flank
export const BASEWAY = [
  [0, 0],
  [-180, -30],
  [-312, -28],
  [-300, 100],
  [-260, 160],
];
// (in the base's own frame: s out toward the canyon, t along it)
const bt = (s, t) => [r1(n[0] * s + a[0] * t), r1(n[1] * s + a[1] * t)];
const OUT = facing(...n); // the yaw that faces out over the canyon
const IMP = { h: 5, light: '#dfe8ff', color: '#2a2c30' };

export const nevarro = {
  place: 'The lava fields outside Nevarro City',
  line: 'Black rock, rivers of fire, and a town that runs on bounties.',
  // (The Mandalorian's Nevarro: black volcanic rock and grey ash under a
  // cool steel-blue overcast, the haze grey, not brown)
  sky: sky('#5a6d8e', '#a9b5c3', '#ffe2c0', { clouds: { cover: 0.6, color: '#c9ced4', shade: '#4c5058', scale: 0.6, speed: 0.006 } }),
  // (thin enough for the volcano and the range to read)
  fog: { color: '#9ca6b0', density: 0.0007 },
  light: { sun: 2.4, sky: '#b4c0d0', ground: '#2e3036', ambient: 0.64 },
  dust: '#2a2a2e',
  edge: 'Nothing out there but lava fields and the Guild’s competition. Turn back.',
  fall: FALL,
  ground: {
    detail: 'ash',
    detailLook: { color: 0.7, normal: 0.8 },
    seed: 21,
    layers: [
      { type: 'swell', scale: 380, height: 10 },
      { type: 'hills', scale: 120, height: 10 },
      // the range round the valley, near enough now to be seen
      { type: 'mountains', from: 560, to: 1150, height: 440, scale: 620 },
      // (new, after the old three so theirs keep their shapes) the shelf
      // of rock the town's sunk into
      { type: 'island', at: TOWN.at, r: 120, height: 10, core: 0.75, ragged: 0.18 },
      // the plateau the Imperial base is built into the lip of
      { type: 'island', at: [-300, 205], r: 200, height: 26, core: 0.72, ragged: 0.15 },
      // the watch hill behind the town
      { type: 'island', at: HILL.at, r: HILL.r, height: HILL.height, core: 0.2, ragged: 0.2 },
      // the volcano, its crater
      { type: 'island', at: VOLCANO, r: 460, height: 300, core: 0.1, ragged: 0.22 },
      { type: 'island', at: VOLCANO, r: 70, height: -50, core: 0.35, ragged: 0.2 },
      // the lava flats: a basin a few metres over the lava, its lowest
      // hollows under it
      { type: 'island', at: FLATS, r: 150, height: -7.5, core: 0.5, ragged: 0.4 },
    ],
    flats: Object.values(WAYS).flatMap(cut),
    pits: [...RIVERPITS, ...CANYON],
    palette: palette('#26282e', '#3a3b40', '#1b1f21', '#6e6b62', { hLow: -3, hHigh: 34, rockAt: 0.36, accentCover: 0.3, roughness: 0.9, wet: { level: LAVA, band: 2.2, color: '#7a1e06' }, mark: '#18191c' }),
  },
  water: { level: LAVA, color: '#ff4a0a', deep: '#2a0904', kind: 'lava', glow: 1.8 },
  weather: [{ kind: 'ash', count: 700, color: '#8a8e94' }],
  // where you set down: the landing yard outside the West Gate
  land: { at: [0, 0], yaw: 1.64, r: 34 },
  places: [
    {
      id: 'town',
      name: 'Nevarro City',
      at: TOWN.at,
      yaw: TOWN.yaw,
      r: 96,
      flat: { r: BOWL, h: FLOOR, edge: 5 },
      about: 'The Guild’s town, sunk in a shelf of black lava rock: Greef Karga’s cantina on the market square, streets of domed plaster houses with their backs to the rock, and three ways out cut through it.',
      things: TOWN_THINGS,
      pits: COVERT_PITS,
    },
    {
      id: 'covert',
      name: 'The covert’s way down',
      at: tw(COVERT_AT),
      r: 14,
      about: 'Steps down off the ring lane into the sewers under the town, where the Armorer keeps her forge by the river of fire. The Tribe’s covert, if you’re invited.',
      things: [],
    },
    {
      id: 'crest',
      name: 'The Razor Crest',
      at: [40, -170],
      r: 30,
      flat: { r: 30 },
      about: 'Din Djarin’s gunship, older than it looks and patched in more places than it should be. He camps beside it rather than in town.',
      things: [
        { kind: 'razorcrest', at: [0, 0], yaw: 1.2 },
        { kind: 'crates', at: [-11, 8], yaw: 0.6 },
      ],
    },
    {
      id: 'base',
      name: 'The Imperial base',
      at: BASE.at,
      r: 50,
      flat: { r: 46, h: BASE.top },
      about: 'An Imperial Remnant base built into the lip of a lava canyon, its coolant tanks hanging out over the drop. Still running. Still guarding something.',
      things: [
        // (the Remnant's cargo, the game's Imperial containers)
        { kind: 'impcontainer', model: 'game:objects/props/objectsets/_galacticempire/container_xl_02/container_xl_02_a_mesh', at: [-30, 26], yaw: 0.4 },
        { kind: 'impcontainer', model: 'game:objects/props/objectsets/_galacticempire/container_xl_02/container_xl_02_a_mesh', at: [-34, 16], yaw: 0.5 },
        // (half in the cliff, half out over the canyon, its roof nine metres over the plateau)
        { kind: 'nevarrobase', at: bt(44, 4), yaw: OUT, scale: 1.6, abs: true, y: BASE.top - 6 },
        { kind: 'bunkerash', at: bt(-8, 26), yaw: OUT + PI / 2 },
        { kind: 'bunker', at: bt(-30, 8), yaw: OUT, model: false, opts: { w: 16, d: 10 } },
        { kind: 'bunker', at: bt(-30, -14), yaw: OUT, model: false, opts: { w: 12, d: 9 } },
        { kind: 'lookout', at: bt(-26, -36), yaw: OUT, opts: { h: 24 } },
        { kind: 'kmast', at: bt(-12, 38) },
        { kind: 'parked', at: bt(-4, -18), yaw: OUT, opts: { kind: 'tie', metres: 7.2 } },
        { kind: 'parked', at: bt(-14, -26), yaw: OUT + 0.2, opts: { kind: 'tie', metres: 7.2 } },
        { kind: 'eweb', at: bt(24, -24), yaw: OUT },
        { kind: 'eweb', at: bt(24, 30), yaw: OUT },
        { kind: 'crates', at: bt(10, 16) },
        { kind: 'crates', at: bt(-18, 14), yaw: 0.7 },
        { kind: 'empirecrate', at: bt(4, 22), yaw: 0.3 },
        { kind: 'cratecube', at: bt(6, -8), yaw: 1.2 },
        { kind: 'lamp', at: bt(14, -12), opts: IMP },
        { kind: 'lamp', at: bt(14, 14), opts: IMP },
        { kind: 'lamp', at: bt(-20, 0), opts: IMP },
      ],
    },
    {
      id: 'river',
      name: 'The Charon River',
      at: tw(polar(118, 1.1)),
      r: 30,
      about: 'Where the river of fire comes out from under the town and runs off toward the lava flats. The Mandalorian and his friends rode a keelboat down it, out of the sewers, with the Empire behind them.',
      things: [],
    },
    {
      id: 'lava',
      name: 'The lava flats',
      at: FLATS,
      r: 60,
      about: 'A crust of black glass over rivers of fire, and the wreck of a TIE fighter that came down hard. Don’t stop walking.',
      things: [
        // (steam off the vents in the crust, on dry spots round the pool)
        { kind: 'smoke', at: [-40, -40], solid: false, opts: { h: 40, n: 8, color: '#b8bcc2', spread: 0.8 } },
        { kind: 'smoke', at: [70, 0], solid: false, opts: { h: 30, n: 7, color: '#b8bcc2', spread: 0.7 } },
        // Moff Gideon's TIE, where it came down (the first season's end), still smoking
        { kind: 'parked', at: [-58, 4], yaw: 2.1, pitch: 0.45, roll: 1.1, sink: 1.2, solid: false, opts: { kind: 'tie', metres: 7 } },
        { kind: 'smoke', at: [-58, 4], solid: false, opts: { h: 14, n: 10, color: '#3a3a3e', spread: 0.25 } },
        ...grove(41, 12, 18, 60, ['lavarock'], [1.5, 4.5]),
      ],
    },
    {
      id: 'hill',
      name: 'The watch hill',
      at: HILL.at,
      r: 32,
      flat: { r: 14 },
      about: 'A black hill over the city with a watchtower on top: the whole valley from here, the lava running to the flats, and the volcano beyond.',
      things: [
        { kind: 'nevarrotower', at: [0, 0], yaw: 2.3 },
        { kind: 'kmast', at: [9, -5] },
        { kind: 'lamp', at: [-7, 7], opts: LAMP },
      ],
    },
  ],
  things: [
    // the Charon's tunnel mouth under the town's south-east rock, facing
    // down the river, and the keelboat at its foot; the second mouth where
    // the river comes out from under the rock bridge
    { kind: 'charonportal', at: along(-4), yaw: facing(...DOWN), scale: 1.4, abs: true, y: LAVA - 0.5, solid: false },
    { kind: 'keelboat', at: along(12), yaw: r1(facing(...DOWN) + PI / 2), abs: true, y: LAVA - 0.4, solid: false },
    { kind: 'charonportal', at: pastBridge.at, yaw: pastBridge.yaw, scale: 1.2, abs: true, y: LAVA - 0.5, solid: false },
    // the volcano's steam, over its crater
    { kind: 'smoke', at: VOLCANO, abs: true, y: 320, solid: false, opts: { h: 260, n: 12, color: '#c4c8cc', spread: 4 } },
    // the landing yard: a New Republic X-wing down beside the gate, the
    // Guild's cargo, a fuel pump, marker blocks
    { kind: 'parked', at: [24, -46], yaw: 2.6, opts: { kind: 'xwing', metres: 12.5 } },
    { kind: 'vaporator', at: [34, -36] },
    { kind: 'hothconsole', at: [36, -33], yaw: 2.4 },
    { kind: 'cratecube', at: [14, 10], yaw: 0.4 },
    { kind: 'cratecube', at: [15.3, 10.5], yaw: 1.1 },
    { kind: 'barrel', at: [12.5, 12], yaw: 0.2 },
    { kind: 'empirecrate', at: [-16, -8], yaw: 2.3 },
    { kind: 'bevelcrate', at: [52, -10], yaw: 0.3 },
    { kind: 'bevelcrate', at: [38, 30], yaw: 1.3 },
    { kind: 'bevelcrate', at: [-30, 36], yaw: 2.1 },
    { kind: 'lamp', at: [18, 6], opts: LAMP },
    { kind: 'lamp', at: [38, -20], opts: LAMP },
    // the way to the base: Imperial posts along it
    ...[
      [-150, -25],
      [-236, -29],
      [-306, 10],
      [-302, 70],
    ].map((at) => ({ kind: 'lamp', at, opts: IMP })),
  ],
  scatter: [
    { kind: 'lavarock', n: 120, within: [36, 470], scale: [0.35, 1.6], sink: 0.25, solid: 0.6, flat: 0.8 },
    { kind: 'lavarock', n: 40, within: [140, 820], scale: [2, 6], sink: 0.6 },
    { kind: 'lavacrack', n: 420, within: [40, 600], scale: [1.4, 3.2], solid: false },
    { kind: 'basalt', n: 60, within: [60, 560], scale: [0.8, 2.0], flat: 0.85 },
    // (the sulphur flats' stones, the drop's, on mid and up)
    { kind: 'stones', model: 'game:objects/nature/volcanic/_volcanicsulfur/_meshscatter/ms_volcanicsulfur_rockfrailsmall_01/ms_volcanicsulfur_rockfrailsmall_01_mesh', n: 220, within: [10, 420], scale: [0.25, 0.8], solid: false, opts: { color: '#2a2a2e' } },
  ],
  sound: { wind: 0.4, rain: 0, sea: 0, lava: 0.45, critters: 0, city: 0.3, ground: 'sand' },
  zones: [
    {
      id: 'cantina',
      name: 'Greef Karga’s cantina',
      music: 'cantina',
      door: { at: [143, -80.4], r: 2.6, prompt: 'Go into the cantina' },
      back: [143.7, -78],
      inside: { build: 'cantinainside', spawn: [0, 14.6], yaw: Math.PI, exit: { at: [0, 16], r: 1.5 }, bounds: [11.5, 17, 6.6], rooms: [[0, 13.6, 1.6, 3.1, 0, 3.2], [0, 0, 11, 11, 0, 6.6, 'round']], light: { sky: '#8a7a6a', ground: '#201814', ambient: 0.6, fog: '#14100c', density: 0.018 }, lamps: [[0, 3.6, -1, '#ffb070', 34, 16], [0, 3, -8.2, '#9a7dff', 20, 10], [-7, 2.6, 3, '#ff9a50', 16, 12], [7, 2.6, 3, '#ff9a50', 16, 12]] },
      life: [
        { kind: 'villager', id: 'greef', at: [-9.9, -0.8], still: true, face: 1.5, name: 'Greef Karga', named: true, quest: 'puck', says: ['I have a job. It pays well. It’s not for everyone.'] },
        { kind: 'wuher', at: [0, 0.8], still: true, face: 0, name: 'The barkeep', says: ['Guild members only past the bar.'] },
        { kind: 'aqualish', n: 2, at: [4, 4], spread: 2, roam: 2, speed: 0.5, name: 'Bounty hunter', says: ['Took a puck? So did I. Same one, probably.'] },
        { kind: 'twilek', at: [-4, 5], still: true, face: 2.4, name: 'A Twi’lek hunter', says: ['Mandalorians. Never take the helmet off.'] },
      ],
    },
  ],
  life: [
    { kind: 'dindjarin', id: 'mando', at: [48, -160], still: true, face: 2.4, name: 'The Mandalorian', named: true, quest: 'protect', says: ['This is the Way.', 'I can bring you in warm, or I can bring you in cold.'] },
    { kind: 'grogu', at: [44, -156], still: true, face: 2.6, name: 'The Child', says: ['(He holds up a tiny hand, and looks very serious about it.)', '(A small coo.)'] },
    { kind: 'r5', n: 1, at: [12, 6], roam: 6, speed: 0.6, name: 'An R5 unit', says: ['(A sulky beep. Somebody stole its restraining bolt. For the bolt.)'] },
    { kind: 'aqualish', n: 1, at: [-14, -4], still: true, face: 0.8, name: 'Bounty hunter', says: ['Guild business. Keep walking.', 'Cantina’s in town. Karga’s buying. Karga’s never buying.'] },
    // (the beasts of burden: blurrgs on the lava fields, a happabore in town)
    { kind: 'blurrg', n: 2, at: [70, -130], spread: 12, roam: 14, speed: 0.9, r: 1 },
    { kind: 'happabore', n: 1, at: tw(polar(53.5, 2.2)), roam: 4, speed: 0.5, r: 1.8 },
    { kind: 'ig11', at: tw([-6, 8]), roam: 8, speed: 0.8, name: 'IG-11', named: true, says: ['I am a nurse droid. I am programmed to protect the child.'] },
    // the town: its people about the square and down the ring lane (the lane
    // between the rings is 15 m wide: they're kept to it), hunters, a stall-keeper
    { kind: 'villager', n: 3, at: tw([0, 2]), spread: 8, roam: 8, speed: 1, name: 'Nevarro local', says: ['The Guild’s back in business. The Empire’s not.', 'Mind the steps down off the ring lane. They go further than you’d think.'] },
    ...[-2.5, 0.2, 2.6].map((ang) => ({ kind: 'villager', n: 1, at: tw(polar(53.5, ang)), roam: 5, speed: 0.9, name: 'Nevarro local', says: ['Karga runs this town now. Better than the Imperials did.', 'The lava’s under the streets too. You can feel it through your boots.'] })),
    { kind: 'aqualish', n: 2, at: tw([-6, 6]), spread: 8, roam: 8, speed: 0.8, name: 'Bounty hunter', says: ['Took a puck? So did I. Same one, probably.'] },
    { kind: 'bith', at: tw([-15, 0]), still: true, face: r1(TOWN.yaw + PI / 2), name: 'A stall-keeper', says: ['Beskar? Ha. Try the Imperials. They had plenty, once.'] },
    // the covert: the Armorer at her forge, two of the Tribe
    { kind: 'armorer', id: 'armorer', at: tw(polar(COVERT.to + 1, COVERT.ang + 0.06)), still: true, face: r1(TOWN.yaw + facing(-cos(COVERT.ang), -sin(COVERT.ang))), name: 'The Armorer', named: true, says: ['This is the Way.', 'The river of fire runs below these streets. The forge is beside it.', 'We survive by remaining hidden. You were not invited.'] },
    { kind: 'mando', n: 2, at: tw(polar(COVERT.to - 4, COVERT.ang)), spread: 3, roam: 3, speed: 0.8, name: 'Mandalorian', says: ['This is the Way.'] },
    // the yard: a New Republic pilot by the X-wing
    { kind: 'rebelpilot', at: [30, -42], still: true, face: 2.6, name: 'New Republic pilot', says: ['The Republic likes to keep an eye on Nevarro.', 'Watch where you park. The last Mandalorian set down on my fuel line.'] },
    // the base: its garrison in the yard (the puck quest's troops spawn
    // there too), and a pair walking the canyon's lip
    { kind: 'stormtrooper', n: 4, at: BASE.at, spread: 20, roam: 12, speed: 1.2, name: 'Remnant stormtrooper', says: ['Move along. This area is restricted.'] },
    { kind: 'stormtrooper', n: 2, path: [bt(20, -40), bt(20, 40), bt(-20, 40), bt(-20, -40)].map(([x, z]) => [r1(BASE.at[0] + x), r1(BASE.at[1] + z)]), speed: 1.1, name: 'Remnant stormtrooper', says: ['The canyon’s a long way down. Don’t lean on the rail.'] },
  ],
  quests: [
    { id: 'puck', name: 'The bounty puck', giver: 'greef', intro: [['Greef Karga', 'A puck for you: the client wants an asset from the Imperial base. Alive. Questions are extra.']], steps: [{ type: 'reach', at: [-260, 160], r: 40, text: 'Go to the Imperial base' }, { type: 'shoot', tag: 'basetroops', n: 6, text: 'Get past the guards', spawn: troops('basetroops', 6, [-260, 160]) }, { type: 'collect', item: 'asset', n: 1, spots: [[-252, 166]], text: 'Collect the asset' }, { type: 'talk', zone: 'cantina', actor: 'greef', text: 'Take it to Greef Karga' }], done: [['Greef Karga', 'The client is pleased. Here: camtono of beskar. Don’t spend it all at once.']] },
    { id: 'protect', name: 'This is the Way', giver: 'mando', intro: [['The Mandalorian', 'Death troopers. They’ve tracked the kid here. Help me hold them off.']], steps: [{ type: 'shoot', tag: 'death', n: 5, text: 'Protect the Child from the death troopers', spawn: { ...troops('death', 5, [90, -210], 'deathtrooper'), hostile: { ...hostile(45, 2.6, 7), burst: { n: 3, gap: 0.1 }, strafe: { speed: 2.6, every: 2.2, keep: 14 } } } }], done: [['The Mandalorian', 'This is the Way.']] },
  ],
  flyovers: [{ kind: 'tie', n: 2, metres: 7, alt: 90, speed: 100, every: 50 }],
};
